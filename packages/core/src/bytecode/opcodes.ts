/**
 * Opcode definitions and metadata for PEX bytecode.
 *
 * Variable-length encoding based on opcode high bits:
 * - 0x00-0x3F: No operand (1 byte total)
 * - 0x40-0x7F: u8 operand (2 bytes total)
 * - 0x80-0xBF: u16 operand (3 bytes total)
 * - 0xC0-0xFF: u32 operand (5 bytes total)
 */

/**
 * Operand type for an opcode.
 */
export enum OperandType {
  NONE = 0, // No operand
  U8 = 1, // 8-bit unsigned integer
  U16 = 2, // 16-bit unsigned integer
  U32 = 3, // 32-bit unsigned integer
}

/**
 * Opcode categories for organization.
 */
export enum OpcodeCategory {
  STACK = "Stack",
  CONSTANTS = "Constants",
  VARIABLES = "Variables",
  ARITHMETIC = "Arithmetic",
  COMPARISON = "Comparison",
  LOGIC = "Logic",
  CONTROL = "Control",
  FUNCTIONS = "Functions",
  BUILTINS = "Builtins",
  EFFECTS = "Effects",
  ARRAYS = "Arrays",
}

/**
 * All PEX bytecode opcodes.
 */
export enum Opcode {
  // Stack operations (0x00-0x0F)
  NOP = 0x00, // No operation
  POP = 0x01, // Pop top of stack
  DUP = 0x02, // Duplicate top of stack
  SWAP = 0x03, // Swap top two stack values

  // Constants (0x10-0x1F for no-operand, 0x40-0x4F for indexed)
  CONST_NULL = 0x10, // Push null
  CONST_TRUE = 0x11, // Push true
  CONST_FALSE = 0x12, // Push false
  CONST_ZERO = 0x13, // Push 0
  CONST_ONE = 0x14, // Push 1

  CONST_U8 = 0x40, // Push constant at index (u8)
  CONST_U16 = 0x80, // Push constant at index (u16)
  CONST_U32 = 0xc0, // Push constant at index (u32)

  // Variables (0x41-0x44 for u8, 0x81-0x84 for u16, 0xc1-0xc4 for u32)
  LOAD_LOCAL_U8 = 0x41, // Load local variable (u8 index)
  STORE_LOCAL_U8 = 0x42, // Store to local variable (u8 index)
  LOAD_UPVALUE_U8 = 0x43, // Load upvalue (u8 index)
  STORE_UPVALUE_U8 = 0x44, // Store to upvalue (u8 index)

  LOAD_LOCAL_U16 = 0x81, // Load local variable (u16 index)
  STORE_LOCAL_U16 = 0x82, // Store to local variable (u16 index)
  LOAD_UPVALUE_U16 = 0x83, // Load upvalue (u16 index)
  STORE_UPVALUE_U16 = 0x84, // Store to upvalue (u16 index)

  LOAD_LOCAL_U32 = 0xc1, // Load local variable (u32 index)
  STORE_LOCAL_U32 = 0xc2, // Store to local variable (u32 index)
  LOAD_UPVALUE_U32 = 0xc3, // Load upvalue (u32 index)
  STORE_UPVALUE_U32 = 0xc4, // Store to upvalue (u32 index)

  // Arithmetic (0x20-0x2F)
  ADD = 0x20, // Pop b, pop a, push a + b
  SUB = 0x21, // Pop b, pop a, push a - b
  MUL = 0x22, // Pop b, pop a, push a * b
  DIV = 0x23, // Pop b, pop a, push a / b
  MOD = 0x24, // Pop b, pop a, push a % b
  NEG = 0x25, // Pop a, push -a

  // Comparison (0x26-0x2B)
  EQ = 0x26, // Pop b, pop a, push a == b
  NE = 0x27, // Pop b, pop a, push a != b
  LT = 0x28, // Pop b, pop a, push a < b
  GT = 0x29, // Pop b, pop a, push a > b
  LE = 0x2a, // Pop b, pop a, push a <= b
  GE = 0x2b, // Pop b, pop a, push a >= b

  // Logic (0x2C-0x2F)
  NOT = 0x2c, // Pop a, push !a (logical not)
  NULL_COALESCE = 0x2d, // Pop b, pop a, push (a ?? b)

  // Control flow (0x45-0x47 for u8, 0x85-0x87 for u16, 0xc5-0xc7 for u32)
  JUMP_U8 = 0x45, // Unconditional jump (u8 offset)
  JUMP_IF_FALSE_U8 = 0x46, // Pop condition, jump if false (u8 offset)
  JUMP_IF_TRUE_U8 = 0x47, // Pop condition, jump if true (u8 offset)

  JUMP_U16 = 0x85, // Unconditional jump (u16 offset)
  JUMP_IF_FALSE_U16 = 0x86, // Pop condition, jump if false (u16 offset)
  JUMP_IF_TRUE_U16 = 0x87, // Pop condition, jump if true (u16 offset)

  JUMP_U32 = 0xc5, // Unconditional jump (u32 offset)
  JUMP_IF_FALSE_U32 = 0xc6, // Pop condition, jump if false (u32 offset)
  JUMP_IF_TRUE_U32 = 0xc7, // Pop condition, jump if true (u32 offset)

  // Functions (0x48-0x4A for u8, 0x88-0x8A for u16, 0xc8-0xca for u32)
  MAKE_CLOSURE_U8 = 0x48, // Create closure (u8 function template index)
  CALL_U8 = 0x49, // Call function (u8 arg count)
  RETURN = 0x30, // Return from function

  MAKE_CLOSURE_U16 = 0x88, // Create closure (u16 function template index)
  CALL_U16 = 0x89, // Call function (u16 arg count)

  MAKE_CLOSURE_U32 = 0xc8, // Create closure (u32 function template index)
  CALL_U32 = 0xc9, // Call function (u32 arg count)

  // Builtins (0x4B-0x4C for u8, 0x8B-0x8C for u16, 0xcb-0xcc for u32)
  // Format: CALL_BUILTIN <name_idx> <arg_count>
  // These are special two-operand instructions
  CALL_BUILTIN_U8_U8 = 0x4b, // Call builtin (u8 name index, u8 arg count)
  CALL_BUILTIN_U16_U8 = 0x8b, // Call builtin (u16 name index, u8 arg count)
  CALL_BUILTIN_U32_U8 = 0xcb, // Call builtin (u32 name index, u8 arg count)

  // Effects (0x4D-0x4E for u8, 0x8D-0x8E for u16, 0xcd-0xce for u32)
  // Format: EFFECT <name_idx> <arg_count>
  // Suspends VM, captures continuation, calls host effect handler
  EFFECT_U8_U8 = 0x4d, // Perform effect (u8 name index, u8 arg count)
  EFFECT_U16_U8 = 0x8d, // Perform effect (u16 name index, u8 arg count)
  EFFECT_U32_U8 = 0xcd, // Perform effect (u32 name index, u8 arg count)

  // Arrays (0x4F-0x50 for u8, 0x8F-0x90 for u16, 0xcf-0xd0 for u32)
  MAKE_ARRAY_U8 = 0x4f, // Create array (u8 element count)
  GET_INDEX = 0x31, // Pop index, pop array, push array[index]

  MAKE_ARRAY_U16 = 0x8f, // Create array (u16 element count)
  MAKE_ARRAY_U32 = 0xcf, // Create array (u32 element count)
}

/**
 * Metadata about an opcode.
 */
export interface OpcodeMetadata {
  name: string;
  operandType: OperandType;
  category: OpcodeCategory;
  description: string;
  stackEffect?: string; // Human-readable stack effect (e.g., "a, b -> a+b")
}

/**
 * Opcode metadata table.
 */
export const OPCODE_METADATA: Record<Opcode, OpcodeMetadata> = {
  // Stack operations
  [Opcode.NOP]: {
    name: "NOP",
    operandType: OperandType.NONE,
    category: OpcodeCategory.STACK,
    description: "No operation",
    stackEffect: "->",
  },
  [Opcode.POP]: {
    name: "POP",
    operandType: OperandType.NONE,
    category: OpcodeCategory.STACK,
    description: "Pop and discard top of stack",
    stackEffect: "a ->",
  },
  [Opcode.DUP]: {
    name: "DUP",
    operandType: OperandType.NONE,
    category: OpcodeCategory.STACK,
    description: "Duplicate top of stack",
    stackEffect: "a -> a, a",
  },
  [Opcode.SWAP]: {
    name: "SWAP",
    operandType: OperandType.NONE,
    category: OpcodeCategory.STACK,
    description: "Swap top two stack values",
    stackEffect: "a, b -> b, a",
  },

  // Constants
  [Opcode.CONST_NULL]: {
    name: "CONST_NULL",
    operandType: OperandType.NONE,
    category: OpcodeCategory.CONSTANTS,
    description: "Push null constant",
    stackEffect: "-> null",
  },
  [Opcode.CONST_TRUE]: {
    name: "CONST_TRUE",
    operandType: OperandType.NONE,
    category: OpcodeCategory.CONSTANTS,
    description: "Push true constant",
    stackEffect: "-> true",
  },
  [Opcode.CONST_FALSE]: {
    name: "CONST_FALSE",
    operandType: OperandType.NONE,
    category: OpcodeCategory.CONSTANTS,
    description: "Push false constant",
    stackEffect: "-> false",
  },
  [Opcode.CONST_ZERO]: {
    name: "CONST_ZERO",
    operandType: OperandType.NONE,
    category: OpcodeCategory.CONSTANTS,
    description: "Push 0 constant",
    stackEffect: "-> 0",
  },
  [Opcode.CONST_ONE]: {
    name: "CONST_ONE",
    operandType: OperandType.NONE,
    category: OpcodeCategory.CONSTANTS,
    description: "Push 1 constant",
    stackEffect: "-> 1",
  },
  [Opcode.CONST_U8]: {
    name: "CONST",
    operandType: OperandType.U8,
    category: OpcodeCategory.CONSTANTS,
    description: "Push constant from pool",
    stackEffect: "-> const[idx]",
  },
  [Opcode.CONST_U16]: {
    name: "CONST",
    operandType: OperandType.U16,
    category: OpcodeCategory.CONSTANTS,
    description: "Push constant from pool",
    stackEffect: "-> const[idx]",
  },
  [Opcode.CONST_U32]: {
    name: "CONST",
    operandType: OperandType.U32,
    category: OpcodeCategory.CONSTANTS,
    description: "Push constant from pool",
    stackEffect: "-> const[idx]",
  },

  // Variables
  [Opcode.LOAD_LOCAL_U8]: {
    name: "LOAD_LOCAL",
    operandType: OperandType.U8,
    category: OpcodeCategory.VARIABLES,
    description: "Load local variable onto stack",
    stackEffect: "-> local[idx]",
  },
  [Opcode.STORE_LOCAL_U8]: {
    name: "STORE_LOCAL",
    operandType: OperandType.U8,
    category: OpcodeCategory.VARIABLES,
    description: "Pop value and store to local variable",
    stackEffect: "value ->",
  },
  [Opcode.LOAD_UPVALUE_U8]: {
    name: "LOAD_UPVALUE",
    operandType: OperandType.U8,
    category: OpcodeCategory.VARIABLES,
    description: "Load upvalue onto stack",
    stackEffect: "-> upvalue[idx]",
  },
  [Opcode.STORE_UPVALUE_U8]: {
    name: "STORE_UPVALUE",
    operandType: OperandType.U8,
    category: OpcodeCategory.VARIABLES,
    description: "Pop value and store to upvalue",
    stackEffect: "value ->",
  },
  [Opcode.LOAD_LOCAL_U16]: {
    name: "LOAD_LOCAL",
    operandType: OperandType.U16,
    category: OpcodeCategory.VARIABLES,
    description: "Load local variable onto stack",
    stackEffect: "-> local[idx]",
  },
  [Opcode.STORE_LOCAL_U16]: {
    name: "STORE_LOCAL",
    operandType: OperandType.U16,
    category: OpcodeCategory.VARIABLES,
    description: "Pop value and store to local variable",
    stackEffect: "value ->",
  },
  [Opcode.LOAD_UPVALUE_U16]: {
    name: "LOAD_UPVALUE",
    operandType: OperandType.U16,
    category: OpcodeCategory.VARIABLES,
    description: "Load upvalue onto stack",
    stackEffect: "-> upvalue[idx]",
  },
  [Opcode.STORE_UPVALUE_U16]: {
    name: "STORE_UPVALUE",
    operandType: OperandType.U16,
    category: OpcodeCategory.VARIABLES,
    description: "Pop value and store to upvalue",
    stackEffect: "value ->",
  },
  [Opcode.LOAD_LOCAL_U32]: {
    name: "LOAD_LOCAL",
    operandType: OperandType.U32,
    category: OpcodeCategory.VARIABLES,
    description: "Load local variable onto stack",
    stackEffect: "-> local[idx]",
  },
  [Opcode.STORE_LOCAL_U32]: {
    name: "STORE_LOCAL",
    operandType: OperandType.U32,
    category: OpcodeCategory.VARIABLES,
    description: "Pop value and store to local variable",
    stackEffect: "value ->",
  },
  [Opcode.LOAD_UPVALUE_U32]: {
    name: "LOAD_UPVALUE",
    operandType: OperandType.U32,
    category: OpcodeCategory.VARIABLES,
    description: "Load upvalue onto stack",
    stackEffect: "-> upvalue[idx]",
  },
  [Opcode.STORE_UPVALUE_U32]: {
    name: "STORE_UPVALUE",
    operandType: OperandType.U32,
    category: OpcodeCategory.VARIABLES,
    description: "Pop value and store to upvalue",
    stackEffect: "value ->",
  },

  // Arithmetic
  [Opcode.ADD]: {
    name: "ADD",
    operandType: OperandType.NONE,
    category: OpcodeCategory.ARITHMETIC,
    description: "Add two numbers",
    stackEffect: "a, b -> a+b",
  },
  [Opcode.SUB]: {
    name: "SUB",
    operandType: OperandType.NONE,
    category: OpcodeCategory.ARITHMETIC,
    description: "Subtract two numbers",
    stackEffect: "a, b -> a-b",
  },
  [Opcode.MUL]: {
    name: "MUL",
    operandType: OperandType.NONE,
    category: OpcodeCategory.ARITHMETIC,
    description: "Multiply two numbers",
    stackEffect: "a, b -> a*b",
  },
  [Opcode.DIV]: {
    name: "DIV",
    operandType: OperandType.NONE,
    category: OpcodeCategory.ARITHMETIC,
    description: "Divide two numbers",
    stackEffect: "a, b -> a/b",
  },
  [Opcode.MOD]: {
    name: "MOD",
    operandType: OperandType.NONE,
    category: OpcodeCategory.ARITHMETIC,
    description: "Modulo operation",
    stackEffect: "a, b -> a%b",
  },
  [Opcode.NEG]: {
    name: "NEG",
    operandType: OperandType.NONE,
    category: OpcodeCategory.ARITHMETIC,
    description: "Negate number",
    stackEffect: "a -> -a",
  },

  // Comparison
  [Opcode.EQ]: {
    name: "EQ",
    operandType: OperandType.NONE,
    category: OpcodeCategory.COMPARISON,
    description: "Test equality",
    stackEffect: "a, b -> a==b",
  },
  [Opcode.NE]: {
    name: "NE",
    operandType: OperandType.NONE,
    category: OpcodeCategory.COMPARISON,
    description: "Test inequality",
    stackEffect: "a, b -> a!=b",
  },
  [Opcode.LT]: {
    name: "LT",
    operandType: OperandType.NONE,
    category: OpcodeCategory.COMPARISON,
    description: "Test less than",
    stackEffect: "a, b -> a<b",
  },
  [Opcode.GT]: {
    name: "GT",
    operandType: OperandType.NONE,
    category: OpcodeCategory.COMPARISON,
    description: "Test greater than",
    stackEffect: "a, b -> a>b",
  },
  [Opcode.LE]: {
    name: "LE",
    operandType: OperandType.NONE,
    category: OpcodeCategory.COMPARISON,
    description: "Test less than or equal",
    stackEffect: "a, b -> a<=b",
  },
  [Opcode.GE]: {
    name: "GE",
    operandType: OperandType.NONE,
    category: OpcodeCategory.COMPARISON,
    description: "Test greater than or equal",
    stackEffect: "a, b -> a>=b",
  },

  // Logic
  [Opcode.NOT]: {
    name: "NOT",
    operandType: OperandType.NONE,
    category: OpcodeCategory.LOGIC,
    description: "Logical NOT",
    stackEffect: "a -> !a",
  },
  [Opcode.NULL_COALESCE]: {
    name: "NULL_COALESCE",
    operandType: OperandType.NONE,
    category: OpcodeCategory.LOGIC,
    description: "Null coalescing operator",
    stackEffect: "a, b -> a??b",
  },

  // Control flow
  [Opcode.JUMP_U8]: {
    name: "JUMP",
    operandType: OperandType.U8,
    category: OpcodeCategory.CONTROL,
    description: "Unconditional jump",
    stackEffect: "->",
  },
  [Opcode.JUMP_IF_FALSE_U8]: {
    name: "JUMP_IF_FALSE",
    operandType: OperandType.U8,
    category: OpcodeCategory.CONTROL,
    description: "Jump if top of stack is false",
    stackEffect: "cond ->",
  },
  [Opcode.JUMP_IF_TRUE_U8]: {
    name: "JUMP_IF_TRUE",
    operandType: OperandType.U8,
    category: OpcodeCategory.CONTROL,
    description: "Jump if top of stack is true",
    stackEffect: "cond ->",
  },
  [Opcode.JUMP_U16]: {
    name: "JUMP",
    operandType: OperandType.U16,
    category: OpcodeCategory.CONTROL,
    description: "Unconditional jump",
    stackEffect: "->",
  },
  [Opcode.JUMP_IF_FALSE_U16]: {
    name: "JUMP_IF_FALSE",
    operandType: OperandType.U16,
    category: OpcodeCategory.CONTROL,
    description: "Jump if top of stack is false",
    stackEffect: "cond ->",
  },
  [Opcode.JUMP_IF_TRUE_U16]: {
    name: "JUMP_IF_TRUE",
    operandType: OperandType.U16,
    category: OpcodeCategory.CONTROL,
    description: "Jump if top of stack is true",
    stackEffect: "cond ->",
  },
  [Opcode.JUMP_U32]: {
    name: "JUMP",
    operandType: OperandType.U32,
    category: OpcodeCategory.CONTROL,
    description: "Unconditional jump",
    stackEffect: "->",
  },
  [Opcode.JUMP_IF_FALSE_U32]: {
    name: "JUMP_IF_FALSE",
    operandType: OperandType.U32,
    category: OpcodeCategory.CONTROL,
    description: "Jump if top of stack is false",
    stackEffect: "cond ->",
  },
  [Opcode.JUMP_IF_TRUE_U32]: {
    name: "JUMP_IF_TRUE",
    operandType: OperandType.U32,
    category: OpcodeCategory.CONTROL,
    description: "Jump if top of stack is true",
    stackEffect: "cond ->",
  },

  // Functions
  [Opcode.MAKE_CLOSURE_U8]: {
    name: "MAKE_CLOSURE",
    operandType: OperandType.U8,
    category: OpcodeCategory.FUNCTIONS,
    description: "Create closure from function template",
    stackEffect: "-> closure",
  },
  [Opcode.CALL_U8]: {
    name: "CALL",
    operandType: OperandType.U8,
    category: OpcodeCategory.FUNCTIONS,
    description: "Call function with N arguments",
    stackEffect: "func, arg1, ..., argN -> result",
  },
  [Opcode.RETURN]: {
    name: "RETURN",
    operandType: OperandType.NONE,
    category: OpcodeCategory.FUNCTIONS,
    description: "Return from function",
    stackEffect: "value -> (caller stack)",
  },
  [Opcode.MAKE_CLOSURE_U16]: {
    name: "MAKE_CLOSURE",
    operandType: OperandType.U16,
    category: OpcodeCategory.FUNCTIONS,
    description: "Create closure from function template",
    stackEffect: "-> closure",
  },
  [Opcode.CALL_U16]: {
    name: "CALL",
    operandType: OperandType.U16,
    category: OpcodeCategory.FUNCTIONS,
    description: "Call function with N arguments",
    stackEffect: "func, arg1, ..., argN -> result",
  },
  [Opcode.MAKE_CLOSURE_U32]: {
    name: "MAKE_CLOSURE",
    operandType: OperandType.U32,
    category: OpcodeCategory.FUNCTIONS,
    description: "Create closure from function template",
    stackEffect: "-> closure",
  },
  [Opcode.CALL_U32]: {
    name: "CALL",
    operandType: OperandType.U32,
    category: OpcodeCategory.FUNCTIONS,
    description: "Call function with N arguments",
    stackEffect: "func, arg1, ..., argN -> result",
  },

  // Builtins
  [Opcode.CALL_BUILTIN_U8_U8]: {
    name: "CALL_BUILTIN",
    operandType: OperandType.U8,
    category: OpcodeCategory.BUILTINS,
    description: "Call builtin function (name index, arg count)",
    stackEffect: "arg1, ..., argN -> result",
  },
  [Opcode.CALL_BUILTIN_U16_U8]: {
    name: "CALL_BUILTIN",
    operandType: OperandType.U16,
    category: OpcodeCategory.BUILTINS,
    description: "Call builtin function (name index, arg count)",
    stackEffect: "arg1, ..., argN -> result",
  },
  [Opcode.CALL_BUILTIN_U32_U8]: {
    name: "CALL_BUILTIN",
    operandType: OperandType.U32,
    category: OpcodeCategory.BUILTINS,
    description: "Call builtin function (name index, arg count)",
    stackEffect: "arg1, ..., argN -> result",
  },

  // Effects
  [Opcode.EFFECT_U8_U8]: {
    name: "EFFECT",
    operandType: OperandType.U8,
    category: OpcodeCategory.EFFECTS,
    description: "Perform algebraic effect (name index, arg count)",
    stackEffect: "arg1, ..., argN -> (suspended, continuation captured)",
  },
  [Opcode.EFFECT_U16_U8]: {
    name: "EFFECT",
    operandType: OperandType.U16,
    category: OpcodeCategory.EFFECTS,
    description: "Perform algebraic effect (name index, arg count)",
    stackEffect: "arg1, ..., argN -> (suspended, continuation captured)",
  },
  [Opcode.EFFECT_U32_U8]: {
    name: "EFFECT",
    operandType: OperandType.U32,
    category: OpcodeCategory.EFFECTS,
    description: "Perform algebraic effect (name index, arg count)",
    stackEffect: "arg1, ..., argN -> (suspended, continuation captured)",
  },

  // Arrays
  [Opcode.MAKE_ARRAY_U8]: {
    name: "MAKE_ARRAY",
    operandType: OperandType.U8,
    category: OpcodeCategory.ARRAYS,
    description: "Create array from N stack values",
    stackEffect: "elem1, ..., elemN -> array",
  },
  [Opcode.GET_INDEX]: {
    name: "GET_INDEX",
    operandType: OperandType.NONE,
    category: OpcodeCategory.ARRAYS,
    description: "Array index access",
    stackEffect: "array, index -> array[index]",
  },
  [Opcode.MAKE_ARRAY_U16]: {
    name: "MAKE_ARRAY",
    operandType: OperandType.U16,
    category: OpcodeCategory.ARRAYS,
    description: "Create array from N stack values",
    stackEffect: "elem1, ..., elemN -> array",
  },
  [Opcode.MAKE_ARRAY_U32]: {
    name: "MAKE_ARRAY",
    operandType: OperandType.U32,
    category: OpcodeCategory.ARRAYS,
    description: "Create array from N stack values",
    stackEffect: "elem1, ..., elemN -> array",
  },
};

/**
 * Get operand type from opcode byte based on variable-length encoding.
 */
export function getOperandTypeFromOpcode(opcode: number): OperandType {
  if (opcode <= 0x3f) {
    return OperandType.NONE;
  } else if (opcode <= 0x7f) {
    return OperandType.U8;
  } else if (opcode <= 0xbf) {
    return OperandType.U16;
  } else {
    return OperandType.U32;
  }
}

/**
 * Get the size in bytes of an operand type.
 */
export function getOperandSize(type: OperandType): number {
  switch (type) {
    case OperandType.NONE:
      return 0;
    case OperandType.U8:
      return 1;
    case OperandType.U16:
      return 2;
    case OperandType.U32:
      return 4;
  }
}

/**
 * Get the total instruction size (opcode + operand).
 */
export function getInstructionSize(opcode: Opcode): number {
  const operandType = OPCODE_METADATA[opcode].operandType;
  return 1 + getOperandSize(operandType);
}

/**
 * Check if an opcode is valid.
 */
export function isValidOpcode(opcode: number): opcode is Opcode {
  return opcode in OPCODE_METADATA;
}

/**
 * Helper to select the appropriate opcode variant based on operand value.
 * Returns the opcode and whether the value fits.
 */
export function selectOpcodeVariant(
  baseOpcode: Opcode,
  value: number
): { opcode: Opcode; fits: boolean } {
  const metadata = OPCODE_METADATA[baseOpcode];

  // If this is already a specific variant, use it
  if (metadata.operandType !== OperandType.NONE) {
    const maxValue = getMaxOperandValue(metadata.operandType);
    return { opcode: baseOpcode, fits: value <= maxValue };
  }

  // Find the smallest variant that fits
  if (value <= 0xff) {
    // Try to find u8 variant by name pattern
    const u8Variant = findOpcodeVariant(metadata.name, OperandType.U8);
    if (u8Variant !== null) {
      return { opcode: u8Variant, fits: true };
    }
  }

  if (value <= 0xffff) {
    // Try u16 variant
    const u16Variant = findOpcodeVariant(metadata.name, OperandType.U16);
    if (u16Variant !== null) {
      return { opcode: u16Variant, fits: true };
    }
  }

  if (value <= 0xffffffff) {
    // Try u32 variant
    const u32Variant = findOpcodeVariant(metadata.name, OperandType.U32);
    if (u32Variant !== null) {
      return { opcode: u32Variant, fits: true };
    }
  }

  // Value doesn't fit in any variant
  return { opcode: baseOpcode, fits: false };
}

/**
 * Find an opcode variant by name and operand type.
 */
function findOpcodeVariant(
  name: string,
  operandType: OperandType
): Opcode | null {
  for (const [opcodeValue, metadata] of Object.entries(OPCODE_METADATA)) {
    if (metadata.name === name && metadata.operandType === operandType) {
      return parseInt(opcodeValue) as Opcode;
    }
  }
  return null;
}

/**
 * Get the maximum value that can be encoded in an operand type.
 */
function getMaxOperandValue(type: OperandType): number {
  switch (type) {
    case OperandType.NONE:
      return 0;
    case OperandType.U8:
      return 0xff;
    case OperandType.U16:
      return 0xffff;
    case OperandType.U32:
      return 0xffffffff;
  }
}

/**
 * Get all opcodes in a specific category.
 */
export function getOpcodesByCategory(
  category: OpcodeCategory
): Array<{ opcode: Opcode; metadata: OpcodeMetadata }> {
  return Object.entries(OPCODE_METADATA)
    .filter(([_, metadata]) => metadata.category === category)
    .map(([opcode, metadata]) => ({
      opcode: parseInt(opcode) as Opcode,
      metadata,
    }));
}
