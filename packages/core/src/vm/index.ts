/**
 * PEX Bytecode VM Public API
 *
 * This module provides the public API for executing PEX code on the bytecode VM.
 * It includes:
 * - VM execution with algebraic effects support
 * - Value types and helpers for working with VM values
 * - Builtin function management
 * - Effect handler types and utilities
 * - High-level helpers for running PEX code
 * - Full pipeline execution (parse -> lower -> codegen -> run)
 */

// =============================================================================
// Core VM
// =============================================================================

export { VM, VMError, Continuation } from "./vm.ts";
export type { EffectHandler } from "./vm.ts";
export { throwingEffectHandler, runVM } from "./vm.ts";

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
} from "./values.ts";

// Factory functions for creating values
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
} from "./values.ts";

// Type guards
export {
  isNull,
  isBoolean,
  isNumber,
  isString,
  isArray,
  isObject,
  isRegex,
  isClosure,
  isContinuation,
} from "./values.ts";

// Helper functions
export {
  isTruthy,
  isFalsy,
  valuesEqual,
  displayValue,
  toBoolean,
  toNumber,
  toString,
} from "./values.ts";

// =============================================================================
// Builtin Functions
// =============================================================================

export type { VMBuiltin } from "./builtins.ts";
export { createVMBuiltins, VMRuntimeError } from "./builtins.ts";

// =============================================================================
// Effect System (re-exports for convenience)
// =============================================================================

export type { EffectHandler as EffectHandlerType } from "./effects.ts";
export { throwingEffectHandler as defaultEffectHandler, Continuation as EffectContinuation } from "./effects.ts";

// =============================================================================
// High-Level API
// =============================================================================

import type { Value } from "./values.ts";
import { nullValue } from "./values.ts";
import type { VMBuiltin } from "./builtins.ts";
import type { EffectHandler } from "./vm.ts";
import { VM, throwingEffectHandler } from "./vm.ts";
import type { BytecodeFile } from "../bytecode/format.ts";
import { parse } from "../parser/index.ts";
import { lowerProgram } from "../ir/lower.ts";
import { generateBytecode } from "../codegen/bytecode.ts";

/**
 * Options for running PEX code on the VM.
 */
export interface RunOptions {
  /**
   * Input value passed to the PEX program.
   * Defaults to null if not provided.
   */
  input?: Value;

  /**
   * Effect handler for processing algebraic effects.
   * Defaults to throwingEffectHandler which throws on any effect.
   */
  effectHandler?: EffectHandler;

  /**
   * Custom builtin functions to override or extend the default builtins.
   * Map from builtin name to implementation.
   */
  builtinOverrides?: Map<string, VMBuiltin>;
}

/**
 * Execute PEX source code on the bytecode VM.
 *
 * This is a high-level function that performs the complete compilation and
 * execution pipeline:
 * 1. Parse source code to AST
 * 2. Lower AST to IR
 * 3. Generate bytecode from IR
 * 4. Execute bytecode on VM
 *
 * @param source PEX source code to execute
 * @param options Execution options (input, effect handler, builtin overrides)
 * @returns The result value from executing the program
 *
 * @example
 * ```typescript
 * import { executePEX, stringValue } from "./lib/vm/index.ts";
 *
 * // Simple example
 * const result = executePEX("(+ 1 2)");
 * // result: { type: "number", value: 3 }
 *
 * // With input
 * const result2 = executePEX("(split $$ \" \")", {
 *   input: stringValue("hello world")
 * });
 * // result2: { type: "array", elements: [{ type: "string", value: "hello" }, ...] }
 *
 * // With effects
 * const result3 = executePEX(
 *   '(effect "log" "Hello, world!")',
 *   {
 *     effectHandler: (name, args, cont) => {
 *       if (name === "log") {
 *         console.log(...args.map(v => displayValue(v)));
 *         cont.resume(nullValue());
 *       }
 *     }
 *   }
 * );
 * ```
 */
export function executePEX(source: string, options: RunOptions = {}): Value {
  // Step 1: Parse source to AST
  const ast = parse(source);

  // Step 2: Lower AST to IR
  const ir = lowerProgram(ast);

  // Step 3: Generate bytecode from IR
  const bytecode = generateBytecode(ir);

  // Step 4: Execute on VM
  const input = options.input ?? nullValue();
  const effectHandler = options.effectHandler ?? throwingEffectHandler;
  const vm = new VM(bytecode, effectHandler, options.builtinOverrides);

  return vm.run(input);
}

/**
 * Compile PEX source code to bytecode without executing it.
 *
 * This allows you to compile once and execute multiple times with different
 * inputs or effect handlers.
 *
 * @param source PEX source code to compile
 * @returns Compiled bytecode ready for execution
 *
 * @example
 * ```typescript
 * import { compilePEX, executeBytecode, stringValue } from "./lib/vm/index.ts";
 *
 * // Compile once
 * const bytecode = compilePEX("(split $$ \" \")");
 *
 * // Execute multiple times with different inputs
 * const result1 = executeBytecode(bytecode, {
 *   input: stringValue("hello world")
 * });
 * const result2 = executeBytecode(bytecode, {
 *   input: stringValue("foo bar baz")
 * });
 * ```
 */
export function compilePEX(source: string): BytecodeFile {
  // Step 1: Parse source to AST
  const ast = parse(source);

  // Step 2: Lower AST to IR
  const ir = lowerProgram(ast);

  // Step 3: Generate bytecode from IR
  return generateBytecode(ir);
}

/**
 * Execute pre-compiled bytecode on the VM.
 *
 * Use this with compilePEX() to compile once and execute multiple times.
 *
 * @param bytecode Compiled bytecode file
 * @param options Execution options (input, effect handler, builtin overrides)
 * @returns The result value from executing the program
 */
export function executeBytecode(
  bytecode: BytecodeFile,
  options: RunOptions = {}
): Value {
  const input = options.input ?? nullValue();
  const effectHandler = options.effectHandler ?? throwingEffectHandler;
  const vm = new VM(bytecode, effectHandler, options.builtinOverrides);

  return vm.run(input);
}

/**
 * Create a reusable VM instance for executing bytecode multiple times.
 *
 * This is the most efficient way to execute the same bytecode repeatedly,
 * as the VM only needs to be constructed once.
 *
 * @param bytecode Compiled bytecode file
 * @param effectHandler Effect handler for processing algebraic effects
 * @param builtinOverrides Optional custom builtin functions
 * @returns A VM instance ready to execute the bytecode
 *
 * @example
 * ```typescript
 * import { compilePEX, createVM, stringValue } from "./lib/vm/index.ts";
 *
 * const bytecode = compilePEX("(split $$ \" \")");
 * const vm = createVM(bytecode);
 *
 * // Execute multiple times
 * const result1 = vm.run(stringValue("hello world"));
 * const result2 = vm.run(stringValue("foo bar baz"));
 * ```
 */
export function createVM(
  bytecode: BytecodeFile,
  effectHandler: EffectHandler = throwingEffectHandler,
  builtinOverrides?: Map<string, VMBuiltin>
): VM {
  return new VM(bytecode, effectHandler, builtinOverrides);
}

// =============================================================================
// Re-export Bytecode Types (for advanced usage)
// =============================================================================

export type { BytecodeFile } from "../bytecode/format.ts";
