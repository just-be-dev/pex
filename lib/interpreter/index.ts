/**
 * PEX Interpreter
 *
 * Main interpreter API for executing PEX code.
 */

import { parse } from "../parser/index.ts";
import type { Program } from "../parser/ast.ts";
import type { Value } from "./value.ts";
import { nullValue, stringValue } from "./value.ts";
import { createGlobalEnvironment } from "./environment.ts";
import { createBuiltins } from "./builtins.ts";
import { evaluateProgram } from "./evaluator.ts";

// ============================================
// High-Level API
// ============================================

export interface InterpreterOptions {
  shellMode?: boolean; // Whether to inject $$ in shell mode
  input?: any; // The program input (becomes $$)
}

/**
 * Execute PEX source code and return the result
 */
export function execute(source: string, options: InterpreterOptions = {}): Value {
  const { shellMode = false, input = null } = options;

  // Convert input to PEX value
  const inputValue = convertInput(input);

  // Step 1: Parse (tokenize, normalize, parse)
  const ast = parse(source, { shellMode });

  // Step 2: Evaluate
  const result = evaluate(ast, inputValue);

  return result;
}

/**
 * Execute PEX source code and return the result as a JavaScript value
 */
export function executeToJS(source: string, options: InterpreterOptions = {}): any {
  const result = execute(source, options);
  return convertOutput(result);
}

// ============================================
// Low-Level API
// ============================================

/**
 * Evaluate a PEX AST with optional input
 */
export function evaluate(ast: Program, input: Value = nullValue()): Value {
  const builtins = createBuiltins();
  const globalEnv = createGlobalEnvironment(builtins);
  return evaluateProgram(ast, globalEnv, input);
}

// ============================================
// Conversion Utilities
// ============================================

/**
 * Convert JavaScript input to PEX value
 */
function convertInput(input: any): Value {
  if (input === null || input === undefined) {
    return nullValue();
  }

  if (typeof input === "boolean") {
    return { type: "boolean", value: input };
  }

  if (typeof input === "number") {
    return { type: "number", value: input };
  }

  if (typeof input === "string") {
    return stringValue(input);
  }

  if (Array.isArray(input)) {
    return {
      type: "array",
      elements: input.map(convertInput),
    };
  }

  if (typeof input === "object") {
    const properties = new Map<string, Value>();
    for (const [key, value] of Object.entries(input)) {
      properties.set(key, convertInput(value));
    }
    return { type: "object", properties };
  }

  // Fallback: convert to string (should rarely happen)
  if (process.env.DEBUG) {
    console.warn(`Warning: Converting unsupported input type to string: ${typeof input}`);
  }
  return stringValue(String(input));
}

/**
 * Convert PEX value to JavaScript value
 */
function convertOutput(value: Value): any {
  switch (value.type) {
    case "null":
      return null;
    case "boolean":
      return value.value;
    case "number":
      return value.value;
    case "string":
      return value.value;
    case "array":
      return value.elements.map(convertOutput);
    case "object": {
      const obj: any = {};
      for (const [key, val] of value.properties) {
        obj[key] = convertOutput(val);
      }
      return obj;
    }
    case "regex":
      return new RegExp(value.pattern, value.flags);
    case "function":
      return `<function ${value.name ?? "anonymous"}>`;
    default:
      return null;
  }
}

// ============================================
// Re-exports
// ============================================

export type { Value } from "./value.ts";
export { RuntimeError } from "./evaluator.ts";
export { Environment, createGlobalEnvironment } from "./environment.ts";
export { createBuiltins } from "./builtins.ts";
export {
  nullValue,
  booleanValue,
  numberValue,
  stringValue,
  arrayValue,
  objectValue,
  regexValue,
  functionValue,
  builtinFunction,
  isNull,
  isBoolean,
  isNumber,
  isString,
  isArray,
  isObject,
  isRegex,
  isFunction,
  isTruthy,
  isFalsy,
  toBoolean,
  toNumber,
  toString,
  valuesEqual,
  displayValue,
} from "./value.ts";
