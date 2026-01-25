/**
 * Bytecode file format structures for PEX.
 *
 * Format layout:
 * +---------------------------+
 * | Header (16 bytes)         |  Magic "PEXB", version, flags, entry point
 * +---------------------------+
 * | Constant Pool             |  null, bool, int32, float64, string, regex
 * +---------------------------+
 * | Name Table                |  Identifier strings (variables, functions)
 * +---------------------------+
 * | Function Templates        |  name, params, locals, upvalues, code offset
 * +---------------------------+
 * | Code Section              |  Bytecode instructions
 * +---------------------------+
 * | Debug Info (optional)     |  Source mappings, local var names
 * +---------------------------+
 */

// Magic number for PEX bytecode files (ASCII "PEXB")
export const MAGIC_NUMBER = 0x50455842; // "PEXB"

// Bytecode format version
export const VERSION_MAJOR = 1;
export const VERSION_MINOR = 0;

// Header flags
export enum HeaderFlags {
  NONE = 0x00,
  HAS_DEBUG_INFO = 0x01, // Debug information section is present
}

/**
 * Bytecode file header (16 bytes fixed size).
 */
export interface BytecodeHeader {
  magic: number; // 4 bytes: 0x50455842 ("PEXB")
  versionMajor: number; // 1 byte
  versionMinor: number; // 1 byte
  flags: HeaderFlags; // 1 byte
  reserved: number; // 1 byte (for alignment)
  entryPoint: number; // 4 bytes: function template index for main entry
  constantPoolOffset: number; // 4 bytes: offset to constant pool section
}

/**
 * Types of constants in the constant pool.
 */
export enum ConstantType {
  NULL = 0x00,
  TRUE = 0x01,
  FALSE = 0x02,
  INT32 = 0x03,
  FLOAT64 = 0x04,
  STRING = 0x05,
  REGEX = 0x06,
}

/**
 * A constant value in the constant pool.
 */
export type Constant =
  | { type: ConstantType.NULL }
  | { type: ConstantType.TRUE }
  | { type: ConstantType.FALSE }
  | { type: ConstantType.INT32; value: number }
  | { type: ConstantType.FLOAT64; value: number }
  | { type: ConstantType.STRING; value: string }
  | { type: ConstantType.REGEX; pattern: string; flags: string };

/**
 * Constant pool section containing all constant values.
 * Each constant is prefixed with its type tag.
 */
export interface ConstantPool {
  constants: Constant[];
}

/**
 * Name table section containing identifier strings.
 * Used for variable names, function names, builtin names, effect names, etc.
 */
export interface NameTable {
  names: string[];
}

/**
 * Upvalue information for closures.
 * Describes which variables from enclosing scopes are captured.
 */
export interface Upvalue {
  isLocal: boolean; // true if capturing from parent frame, false if from parent closure
  index: number; // local index (if isLocal) or upvalue index (if not)
}

/**
 * Function template describing a compiled function.
 * This is the compiled representation before creating a closure at runtime.
 */
export interface FunctionTemplate {
  nameIndex: number; // Index into name table (or -1 for anonymous)
  paramCount: number; // Number of parameters
  localCount: number; // Number of local variables (including params)
  upvalues: Upvalue[]; // Captured variables from enclosing scopes
  codeOffset: number; // Byte offset into code section where function bytecode starts
  codeLength: number; // Length of function bytecode in bytes
}

/**
 * Function templates section.
 */
export interface FunctionTemplates {
  templates: FunctionTemplate[];
}

/**
 * Code section containing all bytecode instructions.
 * This is a flat array of bytes that contains all function bytecode.
 * Each function's code is located at its template's codeOffset.
 */
export interface CodeSection {
  code: Uint8Array;
}

/**
 * Source location mapping for debug information.
 */
export interface SourceLocation {
  line: number;
  column: number;
}

/**
 * Debug information for a single instruction.
 */
export interface InstructionDebugInfo {
  byteOffset: number; // Byte offset in code section
  sourceLocation: SourceLocation;
}

/**
 * Debug information for a function.
 */
export interface FunctionDebugInfo {
  functionIndex: number; // Index into function templates
  localNames: string[]; // Names of local variables (including params)
  instructions: InstructionDebugInfo[];
}

/**
 * Optional debug information section.
 * Can be stripped for production builds.
 */
export interface DebugInfo {
  functions: FunctionDebugInfo[];
}

/**
 * Complete bytecode file structure.
 */
export interface BytecodeFile {
  header: BytecodeHeader;
  constantPool: ConstantPool;
  nameTable: NameTable;
  functionTemplates: FunctionTemplates;
  codeSection: CodeSection;
  debugInfo?: DebugInfo;
}

/**
 * Helper to create an empty bytecode file.
 */
export function createEmptyBytecodeFile(): BytecodeFile {
  return {
    header: {
      magic: MAGIC_NUMBER,
      versionMajor: VERSION_MAJOR,
      versionMinor: VERSION_MINOR,
      flags: HeaderFlags.NONE,
      reserved: 0,
      entryPoint: 0,
      constantPoolOffset: 0,
    },
    constantPool: {
      constants: [],
    },
    nameTable: {
      names: [],
    },
    functionTemplates: {
      templates: [],
    },
    codeSection: {
      code: new Uint8Array(0),
    },
  };
}

/**
 * Helper to add debug info to a bytecode file.
 */
export function addDebugInfo(file: BytecodeFile, debugInfo: DebugInfo): void {
  file.header.flags |= HeaderFlags.HAS_DEBUG_INFO;
  file.debugInfo = debugInfo;
}

/**
 * Helper to check if a bytecode file has debug info.
 */
export function hasDebugInfo(file: BytecodeFile): boolean {
  return (file.header.flags & HeaderFlags.HAS_DEBUG_INFO) !== 0;
}
