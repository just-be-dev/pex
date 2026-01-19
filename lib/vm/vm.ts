/**
 * Stack-based Virtual Machine for PEX with algebraic effects support.
 *
 * The VM executes PEX bytecode using a fetch-decode-execute loop.
 * It maintains:
 * - An operand stack for computation
 * - A call stack for function invocations
 * - Support for closures and upvalues
 * - Algebraic effects with one-shot continuations
 *
 * Algebraic Effects:
 * When an EFFECT opcode is executed, the VM:
 * 1. Captures the current execution state (frames + stack) into a Continuation
 * 2. Suspends execution
 * 3. Calls the host's effect handler with (name, args, continuation)
 * 4. The host can resume the continuation with a value, or abort by discarding it
 *
 * This enables powerful control flow patterns including:
 * - Synchronous/asynchronous I/O
 * - Error handling
 * - Early returns
 * - Custom control flow operators
 */

import type { BytecodeFile, FunctionTemplate, Constant } from "../bytecode/format.ts";
import { Opcode, OPCODE_METADATA, OperandType } from "../bytecode/opcodes.ts";
import { ConstantType } from "../bytecode/format.ts";
import type { Value, CallFrame, Upvalue, OpenUpvalue } from "./values.ts";
import {
  nullValue,
  booleanValue,
  numberValue,
  stringValue,
  arrayValue,
  regexValue,
  closureValue,
  continuationValue,
  openUpvalue,
  closedUpvalue,
  getUpvalueValue,
  closeUpvalue,
  isNull,
  isBoolean,
  isNumber,
  isString,
  isArray,
  isClosure,
  isContinuation,
  isTruthy,
  isFalsy,
  valuesEqual,
  toNumber,
  displayValue,
} from "./values.ts";
import type { VMBuiltin } from "./builtins.ts";
import { createVMBuiltins, VMRuntimeError } from "./builtins.ts";

/**
 * Effect handler function type.
 * The VM calls this when an effect is performed.
 * The handler should eventually call continuation.resume(value) or discard it to abort.
 */
export type EffectHandler = (
  effectName: string,
  args: Value[],
  continuation: Continuation,
) => void;

/**
 * One-shot continuation for algebraic effects.
 * Captures the VM state and allows resumption exactly once.
 */
export class Continuation {
  private frames: CallFrame[];
  private stack: Value[];
  private resumed: boolean = false;
  private readonly vm: VM;

  constructor(vm: VM, frames: CallFrame[], stack: Value[]) {
    this.vm = vm;
    // Deep copy frames and stack to preserve state
    this.frames = frames.map((f) => ({
      closure: f.closure,
      ip: f.ip,
      bp: f.bp,
    }));
    this.stack = stack.slice();
  }

  /**
   * Resume execution with the given value.
   * The value will be pushed onto the stack as the result of the effect.
   * @throws Error if continuation has already been resumed (one-shot enforcement)
   */
  resume(value: Value): void {
    if (this.resumed) {
      throw new Error(
        "Continuation has already been resumed. Continuations are one-shot and cannot be resumed twice."
      );
    }
    this.resumed = true;
    this.vm.restoreContinuation(this.frames, this.stack, value);
  }

  /**
   * Check if this continuation has been resumed.
   */
  isResumed(): boolean {
    return this.resumed;
  }
}

/**
 * VM Runtime Error with optional source location information.
 */
export class VMError extends Error {
  constructor(message: string, public readonly ip?: number) {
    super(message);
    this.name = "VMError";
  }
}

/**
 * Stack limits for safety.
 */
const MAX_STACK_SIZE = 10000;
const MAX_FRAMES = 1000;

/**
 * PEX Virtual Machine.
 * Executes bytecode with support for closures, upvalues, and algebraic effects.
 */
export class VM {
  // Core VM state
  private stack: Value[] = [];
  private frames: CallFrame[] = [];
  private bytecode: BytecodeFile;
  private builtins: Map<string, VMBuiltin>;
  private effectHandler: EffectHandler;

  // Open upvalues tracking (for proper closure semantics)
  // Maps stack index to the open upvalue pointing to it
  private openUpvalues: Map<number, OpenUpvalue> = new Map();

  // Execution state
  private halted: boolean = false;
  private returnValue: Value = nullValue();

  constructor(
    bytecode: BytecodeFile,
    effectHandler: EffectHandler,
    builtinOverrides?: Map<string, VMBuiltin>
  ) {
    this.bytecode = bytecode;
    this.effectHandler = effectHandler;
    this.builtins = createVMBuiltins();

    // Apply builtin overrides if provided
    if (builtinOverrides) {
      for (const [name, impl] of builtinOverrides) {
        this.builtins.set(name, impl);
      }
    }
  }

  /**
   * Run the VM from the entry point with the given input value.
   * @param input The input value passed to the program (typically bound to "input" variable)
   * @returns The result value from the program
   */
  run(input: Value): Value {
    // Reset VM state
    this.stack = [];
    this.frames = [];
    this.halted = false;
    this.returnValue = nullValue();

    // Get entry point function template
    const entryIndex = this.bytecode.header.entryPoint;
    if (
      entryIndex < 0 ||
      entryIndex >= this.bytecode.functionTemplates.templates.length
    ) {
      throw new VMError(`Invalid entry point index: ${entryIndex}`);
    }

    const entryTemplate = this.bytecode.functionTemplates.templates[entryIndex]!;

    // Create entry closure and call frame
    const entryClosure = closureValue(entryTemplate, [], "<main>");

    // Push input as argument
    this.push(input);

    // Reserve space for remaining locals
    const localCount = entryTemplate.localCount;
    for (let i = 1; i < localCount; i++) {
      this.push(nullValue());
    }

    // Create call frame for entry function
    const frame: CallFrame = {
      closure: entryClosure,
      ip: 0,
      bp: 0,
    };
    this.frames.push(frame);

    // Execute
    this.execute();

    return this.returnValue;
  }

  /**
   * Main execution loop - fetch, decode, execute instructions.
   */
  private execute(): void {
    while (!this.halted && this.frames.length > 0) {
      const frame = this.currentFrame();
      const code = this.getCode(frame.closure);

      // Fetch opcode
      if (frame.ip >= code.length) {
        throw new VMError("Instruction pointer out of bounds", frame.ip);
      }

      const opcode = code[frame.ip] as Opcode;
      frame.ip++;

      // Execute instruction
      this.executeInstruction(opcode, frame, code);
    }
  }

  /**
   * Execute a single instruction.
   */
  private executeInstruction(
    opcode: Opcode,
    frame: CallFrame,
    code: Uint8Array
  ): void {
    switch (opcode) {
      // ===================================================================
      // Stack Operations
      // ===================================================================

      case Opcode.NOP:
        // No operation
        break;

      case Opcode.POP:
        this.pop();
        break;

      case Opcode.DUP: {
        const value = this.peek();
        this.push(value);
        break;
      }

      case Opcode.SWAP: {
        const a = this.pop();
        const b = this.pop();
        this.push(a);
        this.push(b);
        break;
      }

      // ===================================================================
      // Constants
      // ===================================================================

      case Opcode.CONST_NULL:
        this.push(nullValue());
        break;

      case Opcode.CONST_TRUE:
        this.push(booleanValue(true));
        break;

      case Opcode.CONST_FALSE:
        this.push(booleanValue(false));
        break;

      case Opcode.CONST_ZERO:
        this.push(numberValue(0));
        break;

      case Opcode.CONST_ONE:
        this.push(numberValue(1));
        break;

      case Opcode.CONST_U8:
      case Opcode.CONST_U16:
      case Opcode.CONST_U32: {
        const index = this.readOperand(opcode, frame, code);
        const value = this.getConstant(index);
        this.push(value);
        break;
      }

      // ===================================================================
      // Variables (Locals and Upvalues)
      // ===================================================================

      case Opcode.LOAD_LOCAL_U8:
      case Opcode.LOAD_LOCAL_U16:
      case Opcode.LOAD_LOCAL_U32: {
        const index = this.readOperand(opcode, frame, code);
        const value = this.getLocal(frame, index);
        this.push(value);
        break;
      }

      case Opcode.STORE_LOCAL_U8:
      case Opcode.STORE_LOCAL_U16:
      case Opcode.STORE_LOCAL_U32: {
        const index = this.readOperand(opcode, frame, code);
        const value = this.pop();
        this.setLocal(frame, index, value);
        break;
      }

      case Opcode.LOAD_UPVALUE_U8:
      case Opcode.LOAD_UPVALUE_U16:
      case Opcode.LOAD_UPVALUE_U32: {
        const index = this.readOperand(opcode, frame, code);
        const value = this.getUpvalue(frame, index);
        this.push(value);
        break;
      }

      case Opcode.STORE_UPVALUE_U8:
      case Opcode.STORE_UPVALUE_U16:
      case Opcode.STORE_UPVALUE_U32: {
        const index = this.readOperand(opcode, frame, code);
        const value = this.pop();
        this.setUpvalue(frame, index, value);
        break;
      }

      // ===================================================================
      // Arithmetic
      // ===================================================================

      case Opcode.ADD: {
        const b = toNumber(this.pop());
        const a = toNumber(this.pop());
        this.push(numberValue(a.value + b.value));
        break;
      }

      case Opcode.SUB: {
        const b = toNumber(this.pop());
        const a = toNumber(this.pop());
        this.push(numberValue(a.value - b.value));
        break;
      }

      case Opcode.MUL: {
        const b = toNumber(this.pop());
        const a = toNumber(this.pop());
        this.push(numberValue(a.value * b.value));
        break;
      }

      case Opcode.DIV: {
        const b = toNumber(this.pop());
        const a = toNumber(this.pop());
        if (b.value === 0) {
          throw new VMError("Division by zero", frame.ip);
        }
        this.push(numberValue(a.value / b.value));
        break;
      }

      case Opcode.MOD: {
        const b = toNumber(this.pop());
        const a = toNumber(this.pop());
        this.push(numberValue(a.value % b.value));
        break;
      }

      case Opcode.NEG: {
        const a = toNumber(this.pop());
        this.push(numberValue(-a.value));
        break;
      }

      // ===================================================================
      // Comparison
      // ===================================================================

      case Opcode.EQ: {
        const b = this.pop();
        const a = this.pop();
        this.push(booleanValue(valuesEqual(a, b)));
        break;
      }

      case Opcode.NE: {
        const b = this.pop();
        const a = this.pop();
        this.push(booleanValue(!valuesEqual(a, b)));
        break;
      }

      case Opcode.LT: {
        const b = toNumber(this.pop());
        const a = toNumber(this.pop());
        this.push(booleanValue(a.value < b.value));
        break;
      }

      case Opcode.GT: {
        const b = toNumber(this.pop());
        const a = toNumber(this.pop());
        this.push(booleanValue(a.value > b.value));
        break;
      }

      case Opcode.LE: {
        const b = toNumber(this.pop());
        const a = toNumber(this.pop());
        this.push(booleanValue(a.value <= b.value));
        break;
      }

      case Opcode.GE: {
        const b = toNumber(this.pop());
        const a = toNumber(this.pop());
        this.push(booleanValue(a.value >= b.value));
        break;
      }

      // ===================================================================
      // Logic
      // ===================================================================

      case Opcode.NOT: {
        const value = this.pop();
        this.push(booleanValue(isFalsy(value)));
        break;
      }

      case Opcode.NULL_COALESCE: {
        const b = this.pop();
        const a = this.pop();
        this.push(isNull(a) ? b : a);
        break;
      }

      // ===================================================================
      // Control Flow
      // ===================================================================

      case Opcode.JUMP_U8:
      case Opcode.JUMP_U16:
      case Opcode.JUMP_U32: {
        const offset = this.readOperandSigned(opcode, frame, code);
        frame.ip += offset;
        break;
      }

      case Opcode.JUMP_IF_FALSE_U8:
      case Opcode.JUMP_IF_FALSE_U16:
      case Opcode.JUMP_IF_FALSE_U32: {
        const offset = this.readOperandSigned(opcode, frame, code);
        const condition = this.pop();
        if (isFalsy(condition)) {
          frame.ip += offset;
        }
        break;
      }

      case Opcode.JUMP_IF_TRUE_U8:
      case Opcode.JUMP_IF_TRUE_U16:
      case Opcode.JUMP_IF_TRUE_U32: {
        const offset = this.readOperandSigned(opcode, frame, code);
        const condition = this.pop();
        if (isTruthy(condition)) {
          frame.ip += offset;
        }
        break;
      }

      // ===================================================================
      // Functions
      // ===================================================================

      case Opcode.MAKE_CLOSURE_U8:
      case Opcode.MAKE_CLOSURE_U16:
      case Opcode.MAKE_CLOSURE_U32: {
        const templateIndex = this.readOperand(opcode, frame, code);
        const template = this.getFunctionTemplate(templateIndex);

        // Capture upvalues from current closure or frame
        const upvalues: Upvalue[] = [];
        for (const upvalueSpec of template.upvalues) {
          if (upvalueSpec.isLocal) {
            // Capture from current frame's locals - create open upvalue
            // pointing to the stack location (for recursion support)
            const stackIndex = frame.bp + upvalueSpec.index;
            // Reuse existing open upvalue if one already exists for this location
            let upvalue = this.openUpvalues.get(stackIndex);
            if (!upvalue) {
              upvalue = openUpvalue(this.stack, stackIndex);
              this.openUpvalues.set(stackIndex, upvalue);
            }
            upvalues.push(upvalue);
          } else {
            // Capture from current closure's upvalues (may be open or closed)
            if (upvalueSpec.index >= frame.closure.upvalues.length) {
              throw new VMError(
                `Upvalue index ${upvalueSpec.index} out of bounds`,
                frame.ip
              );
            }
            upvalues.push(frame.closure.upvalues[upvalueSpec.index]!);
          }
        }

        // Get function name from name table
        const name =
          template.nameIndex >= 0
            ? this.bytecode.nameTable.names[template.nameIndex] ?? null
            : null;

        const closure = closureValue(template, upvalues, name);
        this.push(closure);
        break;
      }

      case Opcode.CALL_U8:
      case Opcode.CALL_U16:
      case Opcode.CALL_U32: {
        const argCount = this.readOperand(opcode, frame, code);

        // Arguments are on stack in order: arg0, arg1, ..., argN-1
        // Below them is the function/closure
        // Stack layout: [..., func, arg0, arg1, ..., argN-1]

        // Get the function from below the arguments
        const funcIndex = this.stack.length - argCount - 1;
        if (funcIndex < 0) {
          throw new VMError("Stack underflow during function call", frame.ip);
        }

        const func = this.stack[funcIndex]!;

        if (!isClosure(func)) {
          throw new VMError(
            `Cannot call non-function value: ${func.type}`,
            frame.ip
          );
        }

        // Check arity
        if (argCount !== func.template.paramCount) {
          const name = func.name ?? "<anonymous>";
          throw new VMError(
            `Function ${name} expects ${func.template.paramCount} arguments, got ${argCount}`,
            frame.ip
          );
        }

        // Create new call frame at current stack position (where func was)
        const newBp = funcIndex;

        // Remove the function value from the stack
        this.stack.splice(funcIndex, 1);

        // Arguments are now at newBp, newBp+1, ..., newBp+argCount-1
        // Reserve space for remaining locals
        const localCount = func.template.localCount;
        for (let i = argCount; i < localCount; i++) {
          this.push(nullValue());
        }

        const newFrame: CallFrame = {
          closure: func,
          ip: 0,
          bp: newBp,
        };

        this.frames.push(newFrame);
        break;
      }

      case Opcode.RETURN: {
        const returnValue = this.pop();

        // Pop current frame
        this.frames.pop();

        if (this.frames.length === 0) {
          // Returned from entry point - halt execution
          this.returnValue = returnValue;
          this.halted = true;
        } else {
          // Close any open upvalues before popping locals
          const oldBp = frame.bp;
          this.closeUpvaluesFrom(oldBp);

          // Pop all locals from the frame we're returning from
          while (this.stack.length > oldBp) {
            this.stack.pop();
          }

          // Push return value for caller
          this.push(returnValue);
        }
        break;
      }

      // ===================================================================
      // Builtins
      // ===================================================================

      case Opcode.CALL_BUILTIN_U8_U8:
      case Opcode.CALL_BUILTIN_U16_U8:
      case Opcode.CALL_BUILTIN_U32_U8: {
        const nameIndex = this.readOperand(opcode, frame, code);
        const argCount = this.readU8(frame, code);

        const name = this.getName(nameIndex);
        const builtin = this.builtins.get(name);

        if (!builtin) {
          throw new VMError(`Unknown builtin function: ${name}`, frame.ip);
        }

        // Pop arguments (in reverse order)
        const args: Value[] = [];
        for (let i = 0; i < argCount; i++) {
          args.unshift(this.pop());
        }

        try {
          const result = builtin(args);
          this.push(result);
        } catch (error) {
          if (error instanceof VMRuntimeError) {
            throw new VMError(error.message, frame.ip);
          }
          throw error;
        }
        break;
      }

      // ===================================================================
      // Effects (Algebraic Effects with Continuations)
      // ===================================================================

      case Opcode.EFFECT_U8_U8:
      case Opcode.EFFECT_U16_U8:
      case Opcode.EFFECT_U32_U8: {
        const nameIndex = this.readOperand(opcode, frame, code);
        const argCount = this.readU8(frame, code);

        const effectName = this.getName(nameIndex);

        // Pop arguments (in reverse order)
        const args: Value[] = [];
        for (let i = 0; i < argCount; i++) {
          args.unshift(this.pop());
        }

        // Capture continuation
        const continuation = new Continuation(this, this.frames, this.stack);

        // Suspend execution
        this.halted = true;

        // Call effect handler
        // The handler is responsible for calling continuation.resume(value)
        this.effectHandler(effectName, args, continuation);
        break;
      }

      // ===================================================================
      // Arrays
      // ===================================================================

      case Opcode.MAKE_ARRAY_U8:
      case Opcode.MAKE_ARRAY_U16:
      case Opcode.MAKE_ARRAY_U32: {
        const elementCount = this.readOperand(opcode, frame, code);

        // Pop elements (in reverse order)
        const elements: Value[] = [];
        for (let i = 0; i < elementCount; i++) {
          elements.unshift(this.pop());
        }

        this.push(arrayValue(elements));
        break;
      }

      case Opcode.GET_INDEX: {
        const index = toNumber(this.pop());
        const array = this.pop();

        if (!isArray(array)) {
          throw new VMError(
            `Cannot index non-array value: ${array.type}`,
            frame.ip
          );
        }

        const idx = Math.floor(index.value);
        if (idx < 0 || idx >= array.elements.length) {
          this.push(nullValue());
        } else {
          this.push(array.elements[idx]!);
        }
        break;
      }

      // ===================================================================
      // Unknown Opcode
      // ===================================================================

      default:
        throw new VMError(`Unknown opcode: 0x${(opcode as number).toString(16)}`, frame.ip);
    }
  }

  /**
   * Restore VM state from a continuation and resume execution.
   * Called by Continuation.resume().
   */
  restoreContinuation(
    frames: CallFrame[],
    stack: Value[],
    value: Value
  ): void {
    // Restore frames and stack
    this.frames = frames.map((f) => ({
      closure: f.closure,
      ip: f.ip,
      bp: f.bp,
    }));
    this.stack = stack.slice();

    // Push the resumed value onto the stack (this becomes the effect's result)
    this.push(value);

    // Resume execution
    this.halted = false;
    this.execute();
  }

  // =====================================================================
  // Helper Methods
  // =====================================================================

  /**
   * Push a value onto the operand stack.
   */
  private push(value: Value): void {
    if (this.stack.length >= MAX_STACK_SIZE) {
      throw new VMError(`Stack overflow (max ${MAX_STACK_SIZE})`);
    }
    this.stack.push(value);
  }

  /**
   * Pop a value from the operand stack.
   */
  private pop(): Value {
    const value = this.stack.pop();
    if (value === undefined) {
      throw new VMError("Stack underflow");
    }
    return value;
  }

  /**
   * Peek at the top of the stack without removing it.
   */
  private peek(): Value {
    if (this.stack.length === 0) {
      throw new VMError("Stack underflow");
    }
    return this.stack[this.stack.length - 1]!;
  }

  /**
   * Get the current call frame.
   */
  private currentFrame(): CallFrame {
    if (this.frames.length === 0) {
      throw new VMError("No active call frame");
    }
    if (this.frames.length > MAX_FRAMES) {
      throw new VMError(`Call stack overflow (max ${MAX_FRAMES})`);
    }
    return this.frames[this.frames.length - 1]!;
  }

  /**
   * Read an operand based on the opcode's operand type.
   */
  private readOperand(opcode: Opcode, frame: CallFrame, code: Uint8Array): number {
    const metadata = OPCODE_METADATA[opcode];
    switch (metadata.operandType) {
      case OperandType.NONE:
        return 0;
      case OperandType.U8:
        return this.readU8(frame, code);
      case OperandType.U16:
        return this.readU16(frame, code);
      case OperandType.U32:
        return this.readU32(frame, code);
    }
  }

  /**
   * Read an operand as a signed integer (for relative jumps).
   */
  private readOperandSigned(opcode: Opcode, frame: CallFrame, code: Uint8Array): number {
    const metadata = OPCODE_METADATA[opcode];
    let value: number;

    switch (metadata.operandType) {
      case OperandType.NONE:
        return 0;
      case OperandType.U8:
        value = this.readU8(frame, code);
        // Sign-extend from 8-bit to 32-bit
        return (value << 24) >> 24;
      case OperandType.U16:
        value = this.readU16(frame, code);
        // Sign-extend from 16-bit to 32-bit
        return (value << 16) >> 16;
      case OperandType.U32:
        value = this.readU32(frame, code);
        // JavaScript bitwise operations treat numbers as 32-bit signed
        return value | 0;
    }
  }

  /**
   * Read a u8 operand from bytecode.
   */
  private readU8(frame: CallFrame, code: Uint8Array): number {
    if (frame.ip >= code.length) {
      throw new VMError("Unexpected end of bytecode", frame.ip);
    }
    const value = code[frame.ip]!;
    frame.ip++;
    return value;
  }

  /**
   * Read a u16 operand from bytecode (little-endian).
   */
  private readU16(frame: CallFrame, code: Uint8Array): number {
    if (frame.ip + 1 >= code.length) {
      throw new VMError("Unexpected end of bytecode", frame.ip);
    }
    const low = code[frame.ip]!;
    const high = code[frame.ip + 1]!;
    frame.ip += 2;
    return low | (high << 8);
  }

  /**
   * Read a u32 operand from bytecode (little-endian).
   */
  private readU32(frame: CallFrame, code: Uint8Array): number {
    if (frame.ip + 3 >= code.length) {
      throw new VMError("Unexpected end of bytecode", frame.ip);
    }
    const b0 = code[frame.ip]!;
    const b1 = code[frame.ip + 1]!;
    const b2 = code[frame.ip + 2]!;
    const b3 = code[frame.ip + 3]!;
    frame.ip += 4;
    return b0 | (b1 << 8) | (b2 << 16) | (b3 << 24);
  }

  /**
   * Get the bytecode for a closure's function.
   */
  private getCode(closure: { template: FunctionTemplate }): Uint8Array {
    const template = closure.template;
    const start = template.codeOffset;
    const end = start + template.codeLength;
    return this.bytecode.codeSection.code.slice(start, end);
  }

  /**
   * Get a constant from the constant pool.
   */
  private getConstant(index: number): Value {
    if (index < 0 || index >= this.bytecode.constantPool.constants.length) {
      throw new VMError(`Constant index ${index} out of bounds`);
    }

    const constant = this.bytecode.constantPool.constants[index]!;
    return this.constantToValue(constant);
  }

  /**
   * Convert a bytecode constant to a runtime value.
   */
  private constantToValue(constant: Constant): Value {
    switch (constant.type) {
      case ConstantType.NULL:
        return nullValue();
      case ConstantType.TRUE:
        return booleanValue(true);
      case ConstantType.FALSE:
        return booleanValue(false);
      case ConstantType.INT32:
      case ConstantType.FLOAT64:
        return numberValue(constant.value);
      case ConstantType.STRING:
        return stringValue(constant.value);
      case ConstantType.REGEX:
        return regexValue(constant.pattern, constant.flags);
    }
  }

  /**
   * Get a name from the name table.
   */
  private getName(index: number): string {
    if (index < 0 || index >= this.bytecode.nameTable.names.length) {
      throw new VMError(`Name index ${index} out of bounds`);
    }
    return this.bytecode.nameTable.names[index]!;
  }

  /**
   * Get a function template.
   */
  private getFunctionTemplate(index: number): FunctionTemplate {
    if (index < 0 || index >= this.bytecode.functionTemplates.templates.length) {
      throw new VMError(`Function template index ${index} out of bounds`);
    }
    return this.bytecode.functionTemplates.templates[index]!;
  }

  /**
   * Get a local variable from a frame.
   */
  private getLocal(frame: CallFrame, index: number): Value {
    const stackIndex = frame.bp + index;
    if (stackIndex < 0 || stackIndex >= this.stack.length) {
      throw new VMError(`Local variable index ${index} out of bounds`);
    }
    return this.stack[stackIndex]!;
  }

  /**
   * Set a local variable in a frame.
   */
  private setLocal(frame: CallFrame, index: number, value: Value): void {
    const stackIndex = frame.bp + index;
    if (stackIndex < 0 || stackIndex >= this.stack.length) {
      throw new VMError(`Local variable index ${index} out of bounds`);
    }
    this.stack[stackIndex] = value;
  }

  /**
   * Get an upvalue from a closure.
   */
  private getUpvalue(frame: CallFrame, index: number): Value {
    if (index < 0 || index >= frame.closure.upvalues.length) {
      throw new VMError(`Upvalue index ${index} out of bounds`);
    }
    return getUpvalueValue(frame.closure.upvalues[index]!);
  }

  /**
   * Set an upvalue in a closure.
   */
  private setUpvalue(frame: CallFrame, index: number, value: Value): void {
    if (index < 0 || index >= frame.closure.upvalues.length) {
      throw new VMError(`Upvalue index ${index} out of bounds`);
    }
    const upvalue = frame.closure.upvalues[index]!;
    if (upvalue.type === "open") {
      // Update the stack location
      upvalue.stack[upvalue.index] = value;
    } else {
      // Update the closed value
      upvalue.value = value;
    }
  }

  /**
   * Close all open upvalues at or above the given stack index.
   * This is called when stack frames are popped to preserve captured values.
   */
  private closeUpvaluesFrom(stackIndex: number): void {
    const toClose: number[] = [];

    // Find all open upvalues at or above the stack index
    for (const [index, upvalue] of this.openUpvalues.entries()) {
      if (index >= stackIndex) {
        // Convert to closed upvalue
        const value = upvalue.stack[upvalue.index]!;
        (upvalue as any).type = "closed";
        (upvalue as any).value = value;
        // Clean up the stack reference
        delete (upvalue as any).stack;
        delete (upvalue as any).index;
        toClose.push(index);
      }
    }

    // Remove from open upvalues map
    for (const index of toClose) {
      this.openUpvalues.delete(index);
    }
  }

  // =====================================================================
  // Debug Helpers
  // =====================================================================

  /**
   * Get a string representation of the current stack (for debugging).
   */
  getStackTrace(): string {
    const lines: string[] = ["Stack:"];
    for (let i = this.stack.length - 1; i >= 0; i--) {
      lines.push(`  [${i}] ${displayValue(this.stack[i]!)}`);
    }
    lines.push("\nFrames:");
    for (let i = this.frames.length - 1; i >= 0; i--) {
      const frame = this.frames[i]!;
      const name = frame.closure.name ?? "<anonymous>";
      lines.push(`  [${i}] ${name} @ ip=${frame.ip}, bp=${frame.bp}`);
    }
    return lines.join("\n");
  }
}

/**
 * Default effect handler that throws on any unhandled effect.
 */
export const throwingEffectHandler: EffectHandler = (
  effectName,
  _args,
  _continuation
) => {
  throw new Error(
    `Unhandled effect: ${effectName}. Please provide an EffectHandler to handle effects.`
  );
};

/**
 * Create and run a VM with the given bytecode and input.
 * Uses a throwing effect handler by default.
 */
export function runVM(
  bytecode: BytecodeFile,
  input: Value,
  effectHandler: EffectHandler = throwingEffectHandler,
  builtinOverrides?: Map<string, VMBuiltin>
): Value {
  const vm = new VM(bytecode, effectHandler, builtinOverrides);
  return vm.run(input);
}
