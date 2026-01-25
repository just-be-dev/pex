/**
 * Bytecode code generator for PEX.
 *
 * Transforms IR expressions into bytecode instructions for the stack-based VM.
 *
 * ## Key Responsibilities
 *
 * - **Transform IRModule to BytecodeFile**: Convert high-level IR to binary bytecode format
 * - **Generate bytecode instructions**: Map IR expressions to stack-based operations
 * - **Build constant pool**: Deduplicate and index all constant values
 * - **Build name table**: Deduplicate and index all identifier strings
 * - **Generate function templates**: Compile functions with closure analysis
 * - **Handle control flow**: Convert structured if/seq to jumps with backpatching
 * - **Handle variables**: Map named variables to locals/upvalues
 * - **Select opcodes**: Choose optimal variants (u8/u16/u32) based on operand size
 *
 * ## Design Decisions
 *
 * ### Stack-Based Execution Model
 * All operations work with an operand stack. For example, `(+ 1 2)` becomes:
 * ```
 * CONST_ONE     ; push 1
 * CONST_U8 2    ; push 2
 * ADD           ; pop 2, pop 1, push 3
 * ```
 *
 * ### Constant Pool Deduplication
 * Identical constants are stored once and referenced by index. This reduces
 * bytecode size and enables efficient constant loading.
 *
 * ### Local Variables and Upvalues
 * - **Locals**: Function parameters and let-bound variables in the current frame
 * - **Upvalues**: Variables captured from enclosing scopes (closures)
 *
 * Locals are indexed from 0 (parameters first, then let-bound vars).
 * Upvalues reference either parent frame locals (isLocal=true) or parent
 * closure upvalues (isLocal=false), enabling multi-level closures.
 *
 * ### Recursive Functions
 * For `let f (fn ...)`, we allocate the local for `f` before compiling the
 * function body, so recursive references resolve correctly.
 *
 * ### Control Flow with Backpatching
 * Structured control flow (if/seq) is converted to jumps:
 * - Generate labels for branch targets
 * - Emit jump instructions with placeholder offsets
 * - Resolve labels to byte offsets in a second pass (backpatching)
 *
 * ### Builtin Optimization
 * Common operations like `+`, `-`, `*`, `/`, `==`, `<` have dedicated opcodes
 * instead of going through CALL_BUILTIN. This reduces instruction count and
 * enables faster execution.
 *
 * ### Opcode Variant Selection
 * Most opcodes have u8/u16/u32 variants based on operand size:
 * - CONST_U8 for constant pool indices 0-255
 * - LOAD_LOCAL_U8 for local variables 0-255
 * - JUMP_U8 for relative jumps within 127 bytes
 *
 * This minimizes bytecode size while supporting large programs.
 *
 * ## IR → Bytecode Mapping
 *
 * | IR Expression | Bytecode Pattern |
 * |---------------|------------------|
 * | `(const 42)` | `CONST_U8 <idx>` or specialized `CONST_ZERO`, `CONST_ONE` |
 * | `(var x)` | `LOAD_LOCAL <idx>` or `LOAD_UPVALUE <idx>` |
 * | `(let x v body)` | `<compile v>; STORE_LOCAL <idx>; <compile body>` |
 * | `(if c t e)` | `<compile c>; JUMP_IF_FALSE else; <compile t>; JUMP end; else: <compile e>; end:` |
 * | `(seq a b c)` | `<compile a>; POP; <compile b>; POP; <compile c>` |
 * | `(call f a b)` | `<compile f>; <compile a>; <compile b>; CALL 2` |
 * | `(fn (x) body)` | `MAKE_CLOSURE <func_idx>` |
 * | `(effect "name" args...)` | `<compile args...>; EFFECT <name_idx> <arg_count>` |
 *
 * ## Usage
 *
 * ```typescript
 * import { generateBytecode } from "./bytecode.ts";
 * import { irModule, irConst } from "../ir/types.ts";
 *
 * const module = irModule(irConst(42));
 * const bytecode = generateBytecode(module);
 *
 * // bytecode.header contains metadata
 * // bytecode.constantPool contains deduplicated constants
 * // bytecode.functionTemplates contains function metadata
 * // bytecode.codeSection.code contains the bytecode instructions
 * ```
 *
 * ## Error Handling
 *
 * Throws `CodegenError` for:
 * - Undefined variables (not in scope, not a builtin)
 * - Undefined labels (internal compiler bug)
 * - Invalid IR structures
 */

import type {
  IRExpr,
  IRConst,
  IRVar,
  IRIf,
  IRLet,
  IRSeq,
  IRCall,
  IRFn,
  IREffect,
  IRModule,
  ConstValue,
} from "../ir/types.ts";
import {
  isConst,
  isVar,
  isIf,
  isLet,
  isSeq,
  isCall,
  isFn,
  isEffect,
} from "../ir/types.ts";
import type {
  BytecodeFile,
  Constant,
  FunctionTemplate,
  Upvalue,
} from "../bytecode/format.ts";
import {
  createEmptyBytecodeFile,
  ConstantType,
} from "../bytecode/format.ts";
import { Opcode } from "../bytecode/opcodes.ts";

// ============================================
// Error Types
// ============================================

export class CodegenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CodegenError";
  }
}

// ============================================
// Instruction Builder
// ============================================

/**
 * Represents an instruction that may need backpatching.
 */
interface Instruction {
  opcode: Opcode;
  operand?: number;
  // For two-operand instructions (CALL_BUILTIN, EFFECT)
  operand2?: number;
  // For jump instructions, this will be patched later
  patchLabel?: string;
}

/**
 * Builds a sequence of instructions with support for labels and backpatching.
 */
class InstructionBuilder {
  private instructions: Instruction[] = [];
  private labels: Map<string, number> = new Map();
  private nextLabelId = 0;

  /**
   * Emit an instruction with no operand.
   */
  emit(opcode: Opcode): void {
    this.instructions.push({ opcode });
  }

  /**
   * Emit an instruction with an operand.
   */
  emitWithOperand(opcode: Opcode, operand: number): void {
    this.instructions.push({ opcode, operand });
  }

  /**
   * Emit an instruction with two operands (e.g., CALL_BUILTIN, EFFECT).
   */
  emitWithTwoOperands(opcode: Opcode, operand: number, operand2: number): void {
    this.instructions.push({ opcode, operand, operand2 });
  }

  /**
   * Emit a jump instruction that will be patched later.
   */
  emitJump(opcode: Opcode, label: string): void {
    this.instructions.push({ opcode, patchLabel: label });
  }

  /**
   * Mark the current position with a label.
   */
  markLabel(label: string): void {
    this.labels.set(label, this.instructions.length);
  }

  /**
   * Generate a unique label.
   */
  generateLabel(prefix: string = "L"): string {
    return `${prefix}${this.nextLabelId++}`;
  }

  /**
   * Get the current instruction offset.
   */
  currentOffset(): number {
    return this.instructions.length;
  }

  /**
   * Convert instructions to bytecode with backpatching.
   * Returns the bytecode bytes.
   */
  toBytes(): Uint8Array {
    // First pass: resolve labels to byte offsets
    const byteOffsets: number[] = [];
    let currentByteOffset = 0;

    for (const instr of this.instructions) {
      byteOffsets.push(currentByteOffset);
      currentByteOffset += 1; // opcode byte

      if (instr.operand !== undefined || instr.patchLabel !== undefined) {
        // Determine operand size from opcode
        const operandSize = getOperandSizeFromOpcode(instr.opcode);
        currentByteOffset += operandSize;
      }

      // Handle second operand for two-operand instructions
      if (instr.operand2 !== undefined) {
        currentByteOffset += 1; // operand2 is always u8
      }
    }

    // Resolve label byte offsets
    const labelByteOffsets = new Map<string, number>();
    for (const [label, instrIndex] of this.labels) {
      labelByteOffsets.set(label, byteOffsets[instrIndex]!);
    }

    // Second pass: emit bytecode with resolved jumps
    const bytes: number[] = [];

    for (let i = 0; i < this.instructions.length; i++) {
      const instr = this.instructions[i]!;
      bytes.push(instr.opcode);

      let operand = instr.operand;

      // Patch jump instructions
      if (instr.patchLabel !== undefined) {
        const targetByteOffset = labelByteOffsets.get(instr.patchLabel);
        if (targetByteOffset === undefined) {
          throw new CodegenError(
            `Undefined label: ${instr.patchLabel}`
          );
        }
        const currentByteOffset = byteOffsets[i]!;
        // Jump offset is relative to the start of the next instruction
        // The next instruction offset is already correctly calculated in byteOffsets
        const nextInstrIndex = i + 1;
        const nextInstrOffset = nextInstrIndex < byteOffsets.length
          ? byteOffsets[nextInstrIndex]!
          : currentByteOffset + 1 + getOperandSizeFromOpcode(instr.opcode);
        operand = targetByteOffset - nextInstrOffset;
      }

      // Emit operand if present
      if (operand !== undefined) {
        const operandSize = getOperandSizeFromOpcode(instr.opcode);

        if (operandSize === 1) {
          bytes.push(operand & 0xff);
        } else if (operandSize === 2) {
          bytes.push(operand & 0xff);
          bytes.push((operand >> 8) & 0xff);
        } else if (operandSize === 4) {
          bytes.push(operand & 0xff);
          bytes.push((operand >> 8) & 0xff);
          bytes.push((operand >> 16) & 0xff);
          bytes.push((operand >> 24) & 0xff);
        }
      }

      // Emit second operand if present (always u8)
      if (instr.operand2 !== undefined) {
        bytes.push(instr.operand2 & 0xff);
      }
    }

    return new Uint8Array(bytes);
  }
}

/**
 * Get operand size from opcode.
 */
function getOperandSizeFromOpcode(opcode: Opcode): number {
  if (opcode <= 0x3f) return 0;
  if (opcode <= 0x7f) return 1;
  if (opcode <= 0xbf) return 2;
  return 4;
}

// ============================================
// Compilation Context
// ============================================

/**
 * Variable resolution result.
 */
interface ResolvedVar {
  type: "local" | "upvalue";
  index: number;
}

/**
 * Context for compiling a function.
 */
class FunctionContext {
  name: string | null;
  params: string[];
  locals: Map<string, number> = new Map(); // name -> local index
  localCount = 0;
  upvalues: Upvalue[] = [];
  upvalueMap: Map<string, number> = new Map(); // name -> upvalue index
  instructions: InstructionBuilder = new InstructionBuilder();
  parent: FunctionContext | null;
  code: Uint8Array | null = null; // Compiled code (set when exiting)

  constructor(
    name: string | null,
    params: string[],
    parent: FunctionContext | null
  ) {
    this.name = name;
    this.params = params;
    this.parent = parent;

    // Parameters are the first locals
    for (const param of params) {
      this.locals.set(param, this.localCount++);
    }
  }

  /**
   * Allocate a new local variable.
   */
  allocLocal(name: string): number {
    const index = this.localCount++;
    this.locals.set(name, index);
    return index;
  }

  /**
   * Resolve a variable reference.
   */
  resolveVar(name: string): ResolvedVar | null {
    // Check locals
    const localIndex = this.locals.get(name);
    if (localIndex !== undefined) {
      return { type: "local", index: localIndex };
    }

    // Check upvalues (already captured)
    const upvalueIndex = this.upvalueMap.get(name);
    if (upvalueIndex !== undefined) {
      return { type: "upvalue", index: upvalueIndex };
    }

    // Try to capture from parent
    if (this.parent) {
      const parentResolved = this.parent.resolveVar(name);
      if (parentResolved) {
        // Add as upvalue
        const upvalueIndex = this.upvalues.length;
        const isLocal = parentResolved.type === "local";
        this.upvalues.push({
          isLocal,
          index: parentResolved.index,
        });
        this.upvalueMap.set(name, upvalueIndex);
        return { type: "upvalue", index: upvalueIndex };
      }
    }

    return null;
  }
}

/**
 * Global compilation context.
 */
class CompilationContext {
  constants: Constant[] = [];
  constantMap: Map<string, number> = new Map(); // serialized constant -> index
  names: string[] = [];
  nameMap: Map<string, number> = new Map();
  functionTemplates: FunctionTemplate[] = [];
  functionCodes: Uint8Array[] = []; // Compiled code for each function
  currentFunction: FunctionContext;

  constructor() {
    // Initialize with a top-level function (main entry point)
    this.currentFunction = new FunctionContext(null, ["input"], null);
  }

  /**
   * Add a constant to the constant pool (with deduplication).
   */
  addConstant(value: ConstValue): number {
    const key = serializeConstant(value);
    const existing = this.constantMap.get(key);
    if (existing !== undefined) {
      return existing;
    }

    const index = this.constants.length;
    this.constants.push(constValueToConstant(value));
    this.constantMap.set(key, index);
    return index;
  }

  /**
   * Add a name to the name table (with deduplication).
   */
  addName(name: string): number {
    const existing = this.nameMap.get(name);
    if (existing !== undefined) {
      return existing;
    }

    const index = this.names.length;
    this.names.push(name);
    this.nameMap.set(name, index);
    return index;
  }

  /**
   * Add a function template with its compiled code.
   */
  addFunctionTemplate(template: FunctionTemplate, code: Uint8Array): number {
    const index = this.functionTemplates.length;
    this.functionTemplates.push(template);
    this.functionCodes.push(code);
    return index;
  }

  /**
   * Enter a new function scope.
   */
  enterFunction(name: string | null, params: string[]): void {
    const newFunction = new FunctionContext(name, params, this.currentFunction);
    this.currentFunction = newFunction;
  }

  /**
   * Exit the current function scope and return the compiled function index.
   */
  exitFunction(): number {
    const func = this.currentFunction;
    const code = func.instructions.toBytes();

    const nameIndex = func.name ? this.addName(func.name) : -1;

    const template: FunctionTemplate = {
      nameIndex,
      paramCount: func.params.length,
      localCount: func.localCount,
      upvalues: func.upvalues,
      codeOffset: 0, // Will be set when building final bytecode
      codeLength: code.length,
    };

    const funcIndex = this.addFunctionTemplate(template, code);

    // Restore parent context
    if (func.parent === null) {
      throw new CodegenError("Cannot exit top-level function");
    }
    this.currentFunction = func.parent;

    return funcIndex;
  }
}

// ============================================
// Code Generation
// ============================================

/**
 * Generate bytecode from an IR module.
 */
export function generateBytecode(module: IRModule): BytecodeFile {
  const ctx = new CompilationContext();

  // Compile the main program body
  compileExpr(module.body, ctx);

  // Main function should return the result
  ctx.currentFunction.instructions.emit(Opcode.RETURN);

  // Finalize main function
  const mainCode = ctx.currentFunction.instructions.toBytes();
  const mainTemplate: FunctionTemplate = {
    nameIndex: -1, // Anonymous main
    paramCount: 1, // Takes "input"
    localCount: ctx.currentFunction.localCount,
    upvalues: [],
    codeOffset: 0,
    codeLength: mainCode.length,
  };

  // Build final bytecode file
  const file = createEmptyBytecodeFile();
  file.constantPool.constants = ctx.constants;
  file.nameTable.names = ctx.names;

  // Add all function templates
  const allTemplates = [mainTemplate, ...ctx.functionTemplates];
  const allCodes = [mainCode, ...ctx.functionCodes];
  file.functionTemplates.templates = allTemplates;

  // Build code section by concatenating all function code
  let codeOffset = 0;

  for (let i = 0; i < allTemplates.length; i++) {
    allTemplates[i]!.codeOffset = codeOffset;
    codeOffset += allCodes[i]!.length;
  }

  // Concatenate all code
  const codeArray = new Uint8Array(codeOffset);
  let offset = 0;
  for (const code of allCodes) {
    codeArray.set(code, offset);
    offset += code.length;
  }
  file.codeSection.code = codeArray;

  file.header.entryPoint = 0; // Main function is at index 0

  return file;
}

/**
 * Compile an IR expression to bytecode.
 */
function compileExpr(expr: IRExpr, ctx: CompilationContext): void {
  if (isConst(expr)) {
    compileConst(expr, ctx);
  } else if (isVar(expr)) {
    compileVar(expr, ctx);
  } else if (isIf(expr)) {
    compileIf(expr, ctx);
  } else if (isLet(expr)) {
    compileLet(expr, ctx);
  } else if (isSeq(expr)) {
    compileSeq(expr, ctx);
  } else if (isCall(expr)) {
    compileCall(expr, ctx);
  } else if (isFn(expr)) {
    compileFn(expr, ctx);
  } else if (isEffect(expr)) {
    compileEffect(expr, ctx);
  } else {
    throw new CodegenError(`Unknown IR expression type: ${(expr as any).type}`);
  }
}

/**
 * Compile a constant expression.
 */
function compileConst(expr: IRConst, ctx: CompilationContext): void {
  const { value } = expr;
  const instr = ctx.currentFunction.instructions;

  // Use specialized opcodes for common constants
  if (value === null) {
    instr.emit(Opcode.CONST_NULL);
  } else if (value === true) {
    instr.emit(Opcode.CONST_TRUE);
  } else if (value === false) {
    instr.emit(Opcode.CONST_FALSE);
  } else if (value === 0) {
    instr.emit(Opcode.CONST_ZERO);
  } else if (value === 1) {
    instr.emit(Opcode.CONST_ONE);
  } else {
    // Add to constant pool
    const constIndex = ctx.addConstant(value);
    const opcode = selectConstOpcode(constIndex);
    instr.emitWithOperand(opcode, constIndex);
  }
}

/**
 * Compile a variable reference.
 */
function compileVar(expr: IRVar, ctx: CompilationContext): void {
  const { name } = expr;
  const instr = ctx.currentFunction.instructions;

  const resolved = ctx.currentFunction.resolveVar(name);
  if (resolved) {
    if (resolved.type === "local") {
      const opcode = selectLoadLocalOpcode(resolved.index);
      instr.emitWithOperand(opcode, resolved.index);
    } else {
      const opcode = selectLoadUpvalueOpcode(resolved.index);
      instr.emitWithOperand(opcode, resolved.index);
    }
  } else {
    // Unknown variable - treat as builtin reference
    // This will be resolved at runtime
    throw new CodegenError(`Undefined variable: ${name}`);
  }
}

/**
 * Compile an if expression.
 */
function compileIf(expr: IRIf, ctx: CompilationContext): void {
  const instr = ctx.currentFunction.instructions;

  const elseLabel = instr.generateLabel("else");
  const endLabel = instr.generateLabel("endif");

  // Compile condition
  compileExpr(expr.cond, ctx);

  // Jump to else if false
  const jumpOpcode = selectJumpIfFalseOpcode(0); // Will be patched
  instr.emitJump(jumpOpcode, elseLabel);

  // Compile then branch
  compileExpr(expr.thenBranch, ctx);

  // Jump to end
  const jumpEndOpcode = selectJumpOpcode(0); // Will be patched
  instr.emitJump(jumpEndOpcode, endLabel);

  // Else branch
  instr.markLabel(elseLabel);
  compileExpr(expr.else, ctx);

  // End
  instr.markLabel(endLabel);
}

/**
 * Compile a let expression.
 */
function compileLet(expr: IRLet, ctx: CompilationContext): void {
  const { name, value, body } = expr;
  const instr = ctx.currentFunction.instructions;

  // For recursive functions, allocate the local first
  // so it's available during compilation of the function body
  if (isFn(value)) {
    // Allocate local variable first
    const localIndex = ctx.currentFunction.allocLocal(name);

    // Compile the function (which may reference itself)
    compileExpr(value, ctx);

    // Store to local
    const storeOpcode = selectStoreLocalOpcode(localIndex);
    instr.emitWithOperand(storeOpcode, localIndex);
  } else {
    // Compile the value expression
    compileExpr(value, ctx);

    // Allocate local variable
    const localIndex = ctx.currentFunction.allocLocal(name);

    // Store to local
    const storeOpcode = selectStoreLocalOpcode(localIndex);
    instr.emitWithOperand(storeOpcode, localIndex);
  }

  // Compile body (result is left on stack)
  compileExpr(body, ctx);
}

/**
 * Compile a sequence expression.
 */
function compileSeq(expr: IRSeq, ctx: CompilationContext): void {
  const { exprs } = expr;
  const instr = ctx.currentFunction.instructions;

  if (exprs.length === 0) {
    // Empty sequence returns null
    instr.emit(Opcode.CONST_NULL);
    return;
  }

  // For mutual recursion support: pre-allocate locals for consecutive let-bound functions
  // This allows functions to reference each other regardless of definition order
  const preallocated = new Set<string>();
  let i = 0;
  while (i < exprs.length) {
    const e = exprs[i]!;
    if (e.type === "let" && isFn(e.value)) {
      // Allocate the local for this function
      ctx.currentFunction.allocLocal(e.name);
      preallocated.add(e.name);
      i++;
    } else {
      break;
    }
  }

  // Now compile all expressions
  for (let i = 0; i < exprs.length; i++) {
    const e = exprs[i]!;

    // Special handling for let with function value that was pre-allocated (mutual recursion)
    if (e.type === "let" && isFn(e.value) && preallocated.has(e.name)) {
      // Local was already allocated above, so just compile and store
      const localIndex = ctx.currentFunction.locals.get(e.name)!;
      // Compile the function value
      compileExpr(e.value, ctx);
      // Store to the pre-allocated local
      const storeOpcode = selectStoreLocalOpcode(localIndex);
      instr.emitWithOperand(storeOpcode, localIndex);
      // Compile body (which just returns the local)
      compileExpr(e.body, ctx);
    } else {
      compileExpr(e, ctx);
    }

    // Pop intermediate results (except the last one)
    if (i < exprs.length - 1) {
      instr.emit(Opcode.POP);
    }
  }
}

/**
 * Compile a function call.
 */
function compileCall(expr: IRCall, ctx: CompilationContext): void {
  const { func, args } = expr;
  const instr = ctx.currentFunction.instructions;

  // Check if this is a builtin operation that has a dedicated opcode
  if (isVar(func)) {
    const builtinOpcode = getBuiltinOpcode(func.name, args.length);
    if (builtinOpcode) {
      // Compile arguments
      for (const arg of args) {
        compileExpr(arg, ctx);
      }
      // Emit the builtin opcode
      instr.emit(builtinOpcode);
      return;
    }

    // Check if it's a general builtin call
    const builtinNameIndex = tryGetBuiltinNameIndex(func.name, ctx);
    if (builtinNameIndex !== null) {
      // Compile arguments
      for (const arg of args) {
        compileExpr(arg, ctx);
      }
      // Emit CALL_BUILTIN with two operands
      emitCallBuiltin(instr, builtinNameIndex, args.length);
      return;
    }
  }

  // Regular function call
  // Compile function expression
  compileExpr(func, ctx);

  // Compile arguments
  for (const arg of args) {
    compileExpr(arg, ctx);
  }

  // Emit CALL
  const opcode = selectCallOpcode(args.length);
  instr.emitWithOperand(opcode, args.length);
}

/**
 * Compile a function expression.
 */
function compileFn(expr: IRFn, ctx: CompilationContext): void {
  const { params, body } = expr;
  const instr = ctx.currentFunction.instructions;

  // Enter new function scope
  ctx.enterFunction(null, params);

  // Compile function body
  compileExpr(body, ctx);

  // Emit return
  ctx.currentFunction.instructions.emit(Opcode.RETURN);

  // Exit function scope and get function index
  const funcIndex = ctx.exitFunction();

  // Emit MAKE_CLOSURE
  // Add 1 to account for the main template being prepended at index 0
  const adjustedIndex = funcIndex + 1;
  const opcode = selectMakeClosureOpcode(adjustedIndex);
  instr.emitWithOperand(opcode, adjustedIndex);
}

/**
 * Compile an effect expression.
 */
function compileEffect(expr: IREffect, ctx: CompilationContext): void {
  const { name, args } = expr;
  const instr = ctx.currentFunction.instructions;

  // Compile arguments
  for (const arg of args) {
    compileExpr(arg, ctx);
  }

  // Add effect name to name table
  const nameIndex = ctx.addName(name);

  // Emit EFFECT with two operands
  emitEffect(instr, nameIndex, args.length);
}

// ============================================
// Opcode Emission Helpers
// ============================================

/**
 * Emit a CALL_BUILTIN instruction with two operands (name index and arg count).
 */
function emitCallBuiltin(
  instr: InstructionBuilder,
  nameIndex: number,
  argCount: number
): void {
  if (nameIndex <= 0xff) {
    // CALL_BUILTIN_U8_U8: opcode (1 byte) + name index (1 byte) + arg count (1 byte)
    instr.emitWithTwoOperands(Opcode.CALL_BUILTIN_U8_U8, nameIndex, argCount);
  } else if (nameIndex <= 0xffff) {
    // CALL_BUILTIN_U16_U8: opcode (1 byte) + name index (2 bytes) + arg count (1 byte)
    instr.emitWithTwoOperands(Opcode.CALL_BUILTIN_U16_U8, nameIndex, argCount);
  } else {
    // CALL_BUILTIN_U32_U8: opcode (1 byte) + name index (4 bytes) + arg count (1 byte)
    instr.emitWithTwoOperands(Opcode.CALL_BUILTIN_U32_U8, nameIndex, argCount);
  }
}

/**
 * Emit an EFFECT instruction with two operands (name index and arg count).
 */
function emitEffect(
  instr: InstructionBuilder,
  nameIndex: number,
  argCount: number
): void {
  if (nameIndex <= 0xff) {
    instr.emitWithTwoOperands(Opcode.EFFECT_U8_U8, nameIndex, argCount);
  } else if (nameIndex <= 0xffff) {
    instr.emitWithTwoOperands(Opcode.EFFECT_U16_U8, nameIndex, argCount);
  } else {
    instr.emitWithTwoOperands(Opcode.EFFECT_U32_U8, nameIndex, argCount);
  }
}

// ============================================
// Opcode Selection Helpers
// ============================================

/**
 * Select the appropriate CONST opcode variant based on index.
 */
function selectConstOpcode(index: number): Opcode {
  if (index <= 0xff) return Opcode.CONST_U8;
  if (index <= 0xffff) return Opcode.CONST_U16;
  return Opcode.CONST_U32;
}

/**
 * Select LOAD_LOCAL opcode variant.
 */
function selectLoadLocalOpcode(index: number): Opcode {
  if (index <= 0xff) return Opcode.LOAD_LOCAL_U8;
  if (index <= 0xffff) return Opcode.LOAD_LOCAL_U16;
  return Opcode.LOAD_LOCAL_U32;
}

/**
 * Select STORE_LOCAL opcode variant.
 */
function selectStoreLocalOpcode(index: number): Opcode {
  if (index <= 0xff) return Opcode.STORE_LOCAL_U8;
  if (index <= 0xffff) return Opcode.STORE_LOCAL_U16;
  return Opcode.STORE_LOCAL_U32;
}

/**
 * Select LOAD_UPVALUE opcode variant.
 */
function selectLoadUpvalueOpcode(index: number): Opcode {
  if (index <= 0xff) return Opcode.LOAD_UPVALUE_U8;
  if (index <= 0xffff) return Opcode.LOAD_UPVALUE_U16;
  return Opcode.LOAD_UPVALUE_U32;
}

/**
 * Select JUMP opcode variant.
 */
function selectJumpOpcode(_offset: number): Opcode {
  // For now, always use U8 - will be upgraded if needed during backpatching
  return Opcode.JUMP_U8;
}

/**
 * Select JUMP_IF_FALSE opcode variant.
 */
function selectJumpIfFalseOpcode(_offset: number): Opcode {
  return Opcode.JUMP_IF_FALSE_U8;
}

/**
 * Select MAKE_CLOSURE opcode variant.
 */
function selectMakeClosureOpcode(index: number): Opcode {
  if (index <= 0xff) return Opcode.MAKE_CLOSURE_U8;
  if (index <= 0xffff) return Opcode.MAKE_CLOSURE_U16;
  return Opcode.MAKE_CLOSURE_U32;
}

/**
 * Select CALL opcode variant.
 */
function selectCallOpcode(argCount: number): Opcode {
  if (argCount <= 0xff) return Opcode.CALL_U8;
  if (argCount <= 0xffff) return Opcode.CALL_U16;
  return Opcode.CALL_U32;
}


// ============================================
// Builtin Recognition
// ============================================

/**
 * Get the dedicated opcode for a builtin operation, if it exists.
 * Returns null if the builtin should be called via CALL_BUILTIN.
 */
function getBuiltinOpcode(name: string, argCount: number): Opcode | null {
  // Arithmetic operations
  if (name === "+" && argCount === 2) return Opcode.ADD;
  if (name === "-" && argCount === 2) return Opcode.SUB;
  if (name === "*" && argCount === 2) return Opcode.MUL;
  if (name === "/" && argCount === 2) return Opcode.DIV;
  if (name === "%" && argCount === 2) return Opcode.MOD;
  if (name === "-" && argCount === 1) return Opcode.NEG;

  // Comparison operations
  if (name === "==" && argCount === 2) return Opcode.EQ;
  if (name === "!=" && argCount === 2) return Opcode.NE;
  if (name === "<" && argCount === 2) return Opcode.LT;
  if (name === ">" && argCount === 2) return Opcode.GT;
  if (name === "<=" && argCount === 2) return Opcode.LE;
  if (name === ">=" && argCount === 2) return Opcode.GE;

  // Logic operations
  if (name === "not" && argCount === 1) return Opcode.NOT;
  if (name === "??" && argCount === 2) return Opcode.NULL_COALESCE;

  // Array operations
  if (name === "get" && argCount === 2) return Opcode.GET_INDEX;

  return null;
}

/**
 * Check if a name is a known builtin and return its name index.
 * Returns null if not a builtin.
 */
function tryGetBuiltinNameIndex(name: string, ctx: CompilationContext): number | null {
  const builtins = [
    // String operations
    "split", "join", "trim", "upper", "lower", "replace", "substring", "len",
    // Type conversion
    "int", "float", "string", "bool",
    // Array operations
    "first", "last", "get",
    // Regex operations
    "match", "test",
  ];

  if (builtins.includes(name)) {
    return ctx.addName(name);
  }

  return null;
}

// ============================================
// Constant Serialization
// ============================================

/**
 * Serialize a constant value to a unique string key for deduplication.
 */
function serializeConstant(value: ConstValue): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return `bool:${value}`;
  if (typeof value === "number") return `num:${value}`;
  if (typeof value === "string") return `str:${value}`;
  if (typeof value === "object" && "type" in value && value.type === "regex") {
    return `regex:${value.pattern}:${value.flags}`;
  }
  throw new CodegenError(`Cannot serialize constant: ${JSON.stringify(value)}`);
}

/**
 * Convert IR constant value to bytecode constant.
 */
function constValueToConstant(value: ConstValue): Constant {
  if (value === null) {
    return { type: ConstantType.NULL };
  }
  if (typeof value === "boolean") {
    return value
      ? { type: ConstantType.TRUE }
      : { type: ConstantType.FALSE };
  }
  if (typeof value === "number") {
    // Distinguish between int32 and float64
    if (Number.isInteger(value) && value >= -2147483648 && value <= 2147483647) {
      return { type: ConstantType.INT32, value };
    }
    return { type: ConstantType.FLOAT64, value };
  }
  if (typeof value === "string") {
    return { type: ConstantType.STRING, value };
  }
  if (typeof value === "object" && "type" in value && value.type === "regex") {
    return {
      type: ConstantType.REGEX,
      pattern: value.pattern,
      flags: value.flags,
    };
  }
  throw new CodegenError(`Unknown constant type: ${JSON.stringify(value)}`);
}
