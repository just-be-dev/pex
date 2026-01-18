/**
 * Built-in functions for the PEX interpreter
 */

import type { Value, BuiltinFunction } from "./value.ts";
import {
  nullValue,
  booleanValue,
  numberValue,
  stringValue,
  arrayValue,
  builtinFunction,
  isNull,
  isString,
  isArray,
  isRegex,
  toNumber,
  toString,
  toBoolean,
  valuesEqual,
} from "./value.ts";
import { RuntimeError } from "./evaluator.ts";

// Helper to check argument count
function checkArity(
  name: string,
  args: Value[],
  expected: number | [number, number],
): void {
  if (typeof expected === "number") {
    if (args.length !== expected) {
      throw new RuntimeError(
        `${name} expects ${expected} argument${expected !== 1 ? "s" : ""}, got ${args.length}`,
      );
    }
  } else {
    const [min, max] = expected;
    if (args.length < min || args.length > max) {
      throw new RuntimeError(
        `${name} expects ${min}-${max} arguments, got ${args.length}`,
      );
    }
  }
}

// Helper to expect a specific type
function expectType(
  name: string,
  value: Value,
  expectedType: string,
  argIndex?: number,
): void {
  if (value.type !== expectedType) {
    const position = argIndex !== undefined ? ` (argument ${argIndex + 1})` : "";
    throw new RuntimeError(
      `${name} expects ${expectedType}${position}, got ${value.type}`,
    );
  }
}

// ============================================
// String Operations
// ============================================

const split: BuiltinFunction = (args) => {
  checkArity("split", args, [2, 3]);
  expectType("split", args[0]!, "string", 0);

  const str = (args[0] as any).value as string;
  const delimiter = toString(args[1]!).value;
  const limit = args[2] ? toNumber(args[2]).value : undefined;

  let parts: string[];
  if (delimiter === "") {
    parts = str.split("");
  } else {
    parts = str.split(delimiter);
  }

  if (limit !== undefined && !Number.isNaN(limit) && limit > 0) {
    parts = parts.slice(0, Math.floor(limit));
  }

  return arrayValue(parts.map((s) => stringValue(s)));
};

const join: BuiltinFunction = (args) => {
  if (args.length === 0) {
    return stringValue("");
  }

  const parts = args.map((arg) => toString(arg).value);
  return stringValue(parts.join(""));
};

const trim: BuiltinFunction = (args) => {
  checkArity("trim", args, 1);
  const str = toString(args[0]!).value;
  return stringValue(str.trim());
};

const upper: BuiltinFunction = (args) => {
  checkArity("upper", args, 1);
  const str = toString(args[0]!).value;
  return stringValue(str.toUpperCase());
};

const lower: BuiltinFunction = (args) => {
  checkArity("lower", args, 1);
  const str = toString(args[0]!).value;
  return stringValue(str.toLowerCase());
};

const replace: BuiltinFunction = (args) => {
  checkArity("replace", args, 3);
  const str = toString(args[0]!).value;
  const pattern = args[1]!;
  const replacement = toString(args[2]!).value;

  let result: string;
  if (isRegex(pattern)) {
    result = str.replace(pattern.regex, replacement);
  } else {
    const searchStr = toString(pattern).value;
    result = str.replace(searchStr, replacement);
  }

  return stringValue(result);
};

const substring: BuiltinFunction = (args) => {
  checkArity("substring", args, [2, 3]);
  expectType("substring", args[0]!, "string", 0);

  const str = (args[0] as any).value as string;
  const start = Math.floor(toNumber(args[1]!).value);
  const end = args[2] ? Math.floor(toNumber(args[2]).value) : undefined;

  return stringValue(str.substring(start, end));
};

const len: BuiltinFunction = (args) => {
  checkArity("len", args, 1);
  const value = args[0]!;

  if (isString(value)) {
    return numberValue(value.value.length);
  }
  if (isArray(value)) {
    return numberValue(value.elements.length);
  }

  throw new RuntimeError(`len expects string or array, got ${value.type}`);
};

// ============================================
// Type Conversion
// ============================================

const int: BuiltinFunction = (args) => {
  checkArity("int", args, 1);
  const num = toNumber(args[0]!).value;
  // Convert NaN to 0 for consistency - invalid inputs become zero
  // This matches common behavior in many languages (e.g., parseInt("invalid") -> NaN -> 0)
  return numberValue(Number.isNaN(num) ? 0 : Math.floor(num));
};

const float: BuiltinFunction = (args) => {
  checkArity("float", args, 1);
  const num = toNumber(args[0]!).value;
  // Convert NaN to 0 for consistency - invalid inputs become zero
  return numberValue(Number.isNaN(num) ? 0.0 : num);
};

const string: BuiltinFunction = (args) => {
  checkArity("string", args, 1);
  return toString(args[0]!);
};

const bool: BuiltinFunction = (args) => {
  checkArity("bool", args, 1);
  return toBoolean(args[0]!);
};

// ============================================
// Array Operations
// ============================================

const first: BuiltinFunction = (args) => {
  checkArity("first", args, 1);
  expectType("first", args[0]!, "array", 0);

  const arr = args[0] as any;
  return arr.elements.length > 0 ? arr.elements[0]! : nullValue();
};

const last: BuiltinFunction = (args) => {
  checkArity("last", args, 1);
  expectType("last", args[0]!, "array", 0);

  const arr = args[0] as any;
  return arr.elements.length > 0
    ? arr.elements[arr.elements.length - 1]!
    : nullValue();
};

const get: BuiltinFunction = (args) => {
  checkArity("get", args, [2, 3]);
  expectType("get", args[0]!, "array", 0);

  const arr = args[0] as any;
  const index = Math.floor(toNumber(args[1]!).value);
  const defaultValue = args[2] ?? nullValue();

  if (index < 0 || index >= arr.elements.length) {
    return defaultValue;
  }

  return arr.elements[index]!;
};

// ============================================
// Logic & Comparison
// ============================================
// Note: and/or are now special forms in the evaluator for proper short-circuit evaluation

const not: BuiltinFunction = (args) => {
  checkArity("not", args, 1);
  return booleanValue(!toBoolean(args[0]!).value);
};

const eq: BuiltinFunction = (args) => {
  checkArity("==", args, 2);
  return booleanValue(valuesEqual(args[0]!, args[1]!));
};

const ne: BuiltinFunction = (args) => {
  checkArity("!=", args, 2);
  return booleanValue(!valuesEqual(args[0]!, args[1]!));
};

const lt: BuiltinFunction = (args) => {
  checkArity("<", args, 2);
  const a = toNumber(args[0]!).value;
  const b = toNumber(args[1]!).value;
  return booleanValue(a < b);
};

const gt: BuiltinFunction = (args) => {
  checkArity(">", args, 2);
  const a = toNumber(args[0]!).value;
  const b = toNumber(args[1]!).value;
  return booleanValue(a > b);
};

const le: BuiltinFunction = (args) => {
  checkArity("<=", args, 2);
  const a = toNumber(args[0]!).value;
  const b = toNumber(args[1]!).value;
  return booleanValue(a <= b);
};

const ge: BuiltinFunction = (args) => {
  checkArity(">=", args, 2);
  const a = toNumber(args[0]!).value;
  const b = toNumber(args[1]!).value;
  return booleanValue(a >= b);
};

// ============================================
// Math Operations
// ============================================

const add: BuiltinFunction = (args) => {
  let sum = 0;
  for (const arg of args) {
    sum += toNumber(arg).value;
  }
  return numberValue(sum);
};

const sub: BuiltinFunction = (args) => {
  checkArity("-", args, 2);
  const a = toNumber(args[0]!).value;
  const b = toNumber(args[1]!).value;
  return numberValue(a - b);
};

const mul: BuiltinFunction = (args) => {
  let product = 1;
  for (const arg of args) {
    product *= toNumber(arg).value;
  }
  return numberValue(product);
};

const div: BuiltinFunction = (args) => {
  checkArity("/", args, 2);
  const a = toNumber(args[0]!).value;
  const b = toNumber(args[1]!).value;
  if (b === 0) {
    throw new RuntimeError("Division by zero");
  }
  return numberValue(a / b);
};

const mod: BuiltinFunction = (args) => {
  checkArity("%", args, 2);
  const a = toNumber(args[0]!).value;
  const b = toNumber(args[1]!).value;
  return numberValue(a % b);
};

// ============================================
// Null Handling
// ============================================

const nullCoalesce: BuiltinFunction = (args) => {
  checkArity("??", args, 2);
  return isNull(args[0]!) ? args[1]! : args[0]!;
};

// ============================================
// Regex Operations
// ============================================

const match: BuiltinFunction = (args) => {
  checkArity("match", args, 2);
  const str = toString(args[0]!).value;
  const pattern = args[1]!;

  if (!isRegex(pattern)) {
    throw new RuntimeError("match expects a regex as second argument");
  }

  const result = str.match(pattern.regex);
  if (result === null) {
    return nullValue();
  }

  return arrayValue(Array.from(result).map((s) => stringValue(s)));
};

const test: BuiltinFunction = (args) => {
  checkArity("test", args, 2);
  const str = toString(args[0]!).value;
  const pattern = args[1]!;

  if (!isRegex(pattern)) {
    throw new RuntimeError("test expects a regex as second argument");
  }

  return booleanValue(pattern.regex.test(str));
};

// ============================================
// Export All Built-ins
// ============================================

export function createBuiltins(): Map<string, Value> {
  const builtins = new Map<string, Value>();

  // String operations
  builtins.set("split", builtinFunction("split", split));
  builtins.set("join", builtinFunction("join", join));
  builtins.set("trim", builtinFunction("trim", trim));
  builtins.set("upper", builtinFunction("upper", upper));
  builtins.set("lower", builtinFunction("lower", lower));
  builtins.set("replace", builtinFunction("replace", replace));
  builtins.set("substring", builtinFunction("substring", substring));
  builtins.set("len", builtinFunction("len", len));

  // Type conversion
  builtins.set("int", builtinFunction("int", int));
  builtins.set("float", builtinFunction("float", float));
  builtins.set("string", builtinFunction("string", string));
  builtins.set("bool", builtinFunction("bool", bool));

  // Array operations
  builtins.set("first", builtinFunction("first", first));
  builtins.set("last", builtinFunction("last", last));
  builtins.set("get", builtinFunction("get", get));

  // Logic operations
  // Note: and/or are special forms, not built-in functions
  builtins.set("not", builtinFunction("not", not));

  // Comparison operations
  builtins.set("==", builtinFunction("==", eq));
  builtins.set("!=", builtinFunction("!=", ne));
  builtins.set("<", builtinFunction("<", lt));
  builtins.set(">", builtinFunction(">", gt));
  builtins.set("<=", builtinFunction("<=", le));
  builtins.set(">=", builtinFunction(">=", ge));

  // Math operations
  builtins.set("+", builtinFunction("+", add));
  builtins.set("-", builtinFunction("-", sub));
  builtins.set("*", builtinFunction("*", mul));
  builtins.set("/", builtinFunction("/", div));
  builtins.set("%", builtinFunction("%", mod));

  // Null handling
  builtins.set("??", builtinFunction("??", nullCoalesce));

  // Regex operations
  builtins.set("match", builtinFunction("match", match));
  builtins.set("test", builtinFunction("test", test));

  return builtins;
}
