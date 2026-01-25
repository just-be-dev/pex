/**
 * @pex/core - PEX Language Compiler and Runtime
 *
 * Public API for the PEX language core library.
 */

// =============================================================================
// VM and Execution
// =============================================================================

export {
  VM,
  VMError,
  Continuation,
  throwingEffectHandler,
  runVM,
  executePEX,
  compilePEX,
  executeBytecode,
  createVM,
  VMRuntimeError,
} from "./vm/index.ts";

export type {
  EffectHandler,
  RunOptions,
  VMBuiltin,
} from "./vm/index.ts";

// =============================================================================
// Value Types and Helpers
// =============================================================================

export type {
  Value,
  NullValue,
  BooleanValue,
  NumberValue,
  StringValue,
  ArrayValue,
  ObjectValue,
  RegexValue,
  ClosureValue,
  ContinuationValue,
  CallFrame,
  Upvalue,
} from "./vm/values.ts";

export {
  nullValue,
  booleanValue,
  numberValue,
  stringValue,
  arrayValue,
  objectValue,
  regexValue,
  closureValue,
  continuationValue,
  isNull,
  isBoolean,
  isNumber,
  isString,
  isArray,
  isObject,
  isRegex,
  isClosure,
  isContinuation,
  isTruthy,
  isFalsy,
  valuesEqual,
  displayValue,
  toBoolean,
  toNumber,
  toString,
} from "./vm/values.ts";

// =============================================================================
// Parser
// =============================================================================

export {
  parse,
  LexerError,
  ParseError,
  TokenType,
  print,
} from "./parser/index.ts";

export type {
  Program,
  SExpr,
  Atom,
  List,
  Pipeline,
  AtomType,
  AtomValue,
  Token,
  SourceRefToken,
  ParseOptions,
} from "./parser/index.ts";

// =============================================================================
// IR
// =============================================================================

export { lowerProgram } from "./ir/lower.ts";
export type { IRModule, IRExpr } from "./ir/types.ts";

// =============================================================================
// Codegen
// =============================================================================

export { generateBytecode } from "./codegen/bytecode.ts";

// =============================================================================
// Bytecode
// =============================================================================

export type { BytecodeFile } from "./bytecode/format.ts";
