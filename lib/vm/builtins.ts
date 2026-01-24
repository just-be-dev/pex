/**
 * Built-in functions for the PEX VM
 *
 * This module provides all builtin functions for the bytecode VM.
 * These builtins maintain identical semantics to the interpreter builtins
 * but operate on VM value types.
 */

import type { Value } from "./values.ts";
import {
  nullValue,
  booleanValue,
  numberValue,
  stringValue,
  arrayValue,
  isNull,
  isString,
  isArray,
  isRegex,
  toNumber,
  toString,
  toBoolean,
  valuesEqual,
} from "./values.ts";

/**
 * VM builtin function type.
 * Takes an array of VM values and returns a VM value.
 */
export type VMBuiltin = (args: Value[]) => Value;

/**
 * Runtime error for VM builtin operations.
 */
export class VMRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VMRuntimeError";
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check argument count for a builtin function.
 * Throws VMRuntimeError if the count doesn't match expectations.
 *
 * @param name Builtin function name (for error messages)
 * @param args Arguments passed to the builtin
 * @param expected Expected count (exact number) or range ([min, max])
 */
function checkArity(
  name: string,
  args: Value[],
  expected: number | [number, number],
): void {
  if (typeof expected === "number") {
    if (args.length !== expected) {
      throw new VMRuntimeError(
        `${name} expects ${expected} argument${expected !== 1 ? "s" : ""}, got ${args.length}`,
      );
    }
  } else {
    const [min, max] = expected;
    if (args.length < min || args.length > max) {
      throw new VMRuntimeError(
        `${name} expects ${min}-${max} arguments, got ${args.length}`,
      );
    }
  }
}

/**
 * Check that a value has the expected type.
 * Throws VMRuntimeError if the type doesn't match.
 *
 * @param name Builtin function name (for error messages)
 * @param value Value to check
 * @param expectedType Expected type string
 * @param argIndex Optional argument index for error messages
 */
function expectType(
  name: string,
  value: Value,
  expectedType: string,
  argIndex?: number,
): void {
  if (value.type !== expectedType) {
    const position = argIndex !== undefined ? ` (argument ${argIndex + 1})` : "";
    throw new VMRuntimeError(
      `${name} expects ${expectedType}${position}, got ${value.type}`,
    );
  }
}

// =============================================================================
// String Operations
// =============================================================================

/**
 * split - Split a string into an array of strings
 * Signature: split(str, delimiter, limit?)
 * - str: string to split
 * - delimiter: string to split on (empty string splits into characters)
 * - limit: optional max number of parts to return
 */
const split: VMBuiltin = (args) => {
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

/**
 * join - Join values into a single string
 * Signature: join(value1, value2, ...)
 * - values: any number of values to join (converted to strings)
 * Returns: concatenated string (no separator)
 */
const join: VMBuiltin = (args) => {
  if (args.length === 0) {
    return stringValue("");
  }

  const parts = args.map((arg) => toString(arg).value);
  return stringValue(parts.join(""));
};

/**
 * trim - Remove whitespace from both ends of a string
 * Signature: trim(str)
 */
const trim: VMBuiltin = (args) => {
  checkArity("trim", args, 1);
  const str = toString(args[0]!).value;
  return stringValue(str.trim());
};

/**
 * upper - Convert a string to uppercase
 * Signature: upper(str)
 */
const upper: VMBuiltin = (args) => {
  checkArity("upper", args, 1);
  const str = toString(args[0]!).value;
  return stringValue(str.toUpperCase());
};

/**
 * lower - Convert a string to lowercase
 * Signature: lower(str)
 */
const lower: VMBuiltin = (args) => {
  checkArity("lower", args, 1);
  const str = toString(args[0]!).value;
  return stringValue(str.toLowerCase());
};

/**
 * replace - Replace occurrences in a string
 * Signature: replace(str, pattern, replacement)
 * - str: string to search in
 * - pattern: string or regex to search for
 * - replacement: string to replace with
 * Note: Only replaces first occurrence unless pattern is a regex with 'g' flag
 */
const replace: VMBuiltin = (args) => {
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

/**
 * substring - Extract a substring
 * Signature: substring(str, start, end?)
 * - str: string to extract from
 * - start: starting index (inclusive)
 * - end: ending index (exclusive, optional)
 */
const substring: VMBuiltin = (args) => {
  checkArity("substring", args, [2, 3]);
  expectType("substring", args[0]!, "string", 0);

  const str = (args[0] as any).value as string;
  const start = Math.floor(toNumber(args[1]!).value);
  const end = args[2] ? Math.floor(toNumber(args[2]).value) : undefined;

  return stringValue(str.substring(start, end));
};

/**
 * len - Get the length of a string or array
 * Signature: len(value)
 * - value: string or array
 * Returns: number of characters (string) or elements (array)
 */
const len: VMBuiltin = (args) => {
  checkArity("len", args, 1);
  const value = args[0]!;

  if (isString(value)) {
    return numberValue(value.value.length);
  }
  if (isArray(value)) {
    return numberValue(value.elements.length);
  }

  throw new VMRuntimeError(`len expects string or array, got ${value.type}`);
};

// =============================================================================
// Type Conversion
// =============================================================================

/**
 * int - Convert a value to an integer
 * Signature: int(value)
 * - Floors numbers
 * - Parses strings (invalid strings become 0)
 * - Booleans: true -> 1, false -> 0
 * - null -> 0
 */
const int: VMBuiltin = (args) => {
  checkArity("int", args, 1);
  const num = toNumber(args[0]!).value;
  // Convert NaN to 0 for consistency - invalid inputs become zero
  // This matches common behavior in many languages (e.g., parseInt("invalid") -> NaN -> 0)
  return numberValue(Number.isNaN(num) ? 0 : Math.floor(num));
};

/**
 * float - Convert a value to a float
 * Signature: float(value)
 * - Numbers returned as-is
 * - Parses strings (invalid strings become 0)
 * - Booleans: true -> 1.0, false -> 0.0
 * - null -> 0.0
 */
const float: VMBuiltin = (args) => {
  checkArity("float", args, 1);
  const num = toNumber(args[0]!).value;
  // Convert NaN to 0 for consistency - invalid inputs become zero
  return numberValue(Number.isNaN(num) ? 0.0 : num);
};

/**
 * string - Convert a value to a string
 * Signature: string(value)
 * Returns human-readable string representation
 */
const string: VMBuiltin = (args) => {
  checkArity("string", args, 1);
  return toString(args[0]!);
};

/**
 * bool - Convert a value to a boolean
 * Signature: bool(value)
 * Uses JavaScript truthiness: null, false, 0, NaN, "" are falsy
 */
const bool: VMBuiltin = (args) => {
  checkArity("bool", args, 1);
  return toBoolean(args[0]!);
};

// =============================================================================
// Array Operations
// =============================================================================

/**
 * first - Get the first element of an array
 * Signature: first(array)
 * Returns: first element or null if array is empty
 */
const first: VMBuiltin = (args) => {
  checkArity("first", args, 1);
  expectType("first", args[0]!, "array", 0);

  const arr = args[0] as any;
  return arr.elements.length > 0 ? arr.elements[0]! : nullValue();
};

/**
 * last - Get the last element of an array
 * Signature: last(array)
 * Returns: last element or null if array is empty
 */
const last: VMBuiltin = (args) => {
  checkArity("last", args, 1);
  expectType("last", args[0]!, "array", 0);

  const arr = args[0] as any;
  return arr.elements.length > 0
    ? arr.elements[arr.elements.length - 1]!
    : nullValue();
};

/**
 * get - Get an element from an array by index
 * Signature: get(array, index, default?)
 * - array: array to index into
 * - index: numeric index (floored)
 * - default: optional default value if index is out of bounds
 * Returns: element at index, or default (or null if no default)
 */
const get: VMBuiltin = (args) => {
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

// =============================================================================
// Logic & Comparison
// =============================================================================
// Note: and/or are special forms handled at the compiler level for proper
// short-circuit evaluation. They are not builtin functions.

/**
 * not - Logical negation
 * Signature: not(value)
 * Returns: opposite of value's truthiness
 */
const not: VMBuiltin = (args) => {
  checkArity("not", args, 1);
  return booleanValue(!toBoolean(args[0]!).value);
};

/**
 * == - Equality comparison
 * Signature: ==(a, b)
 * Performs deep equality for arrays and objects
 */
const eq: VMBuiltin = (args) => {
  checkArity("==", args, 2);
  return booleanValue(valuesEqual(args[0]!, args[1]!));
};

/**
 * != - Inequality comparison
 * Signature: !=(a, b)
 * Performs deep inequality for arrays and objects
 */
const ne: VMBuiltin = (args) => {
  checkArity("!=", args, 2);
  return booleanValue(!valuesEqual(args[0]!, args[1]!));
};

/**
 * < - Less than comparison
 * Signature: <(a, b)
 * Converts both values to numbers
 */
const lt: VMBuiltin = (args) => {
  checkArity("<", args, 2);
  const a = toNumber(args[0]!).value;
  const b = toNumber(args[1]!).value;
  return booleanValue(a < b);
};

/**
 * > - Greater than comparison
 * Signature: >(a, b)
 * Converts both values to numbers
 */
const gt: VMBuiltin = (args) => {
  checkArity(">", args, 2);
  const a = toNumber(args[0]!).value;
  const b = toNumber(args[1]!).value;
  return booleanValue(a > b);
};

/**
 * <= - Less than or equal comparison
 * Signature: <=(a, b)
 * Converts both values to numbers
 */
const le: VMBuiltin = (args) => {
  checkArity("<=", args, 2);
  const a = toNumber(args[0]!).value;
  const b = toNumber(args[1]!).value;
  return booleanValue(a <= b);
};

/**
 * >= - Greater than or equal comparison
 * Signature: >=(a, b)
 * Converts both values to numbers
 */
const ge: VMBuiltin = (args) => {
  checkArity(">=", args, 2);
  const a = toNumber(args[0]!).value;
  const b = toNumber(args[1]!).value;
  return booleanValue(a >= b);
};

// =============================================================================
// Math Operations
// =============================================================================

/**
 * + - Addition
 * Signature: +(a, b, c, ...)
 * Sums all arguments (converts to numbers)
 * Can take 0 or more arguments (0 args returns 0)
 */
const add: VMBuiltin = (args) => {
  let sum = 0;
  for (const arg of args) {
    sum += toNumber(arg).value;
  }
  return numberValue(sum);
};

/**
 * - - Subtraction
 * Signature: -(a, b)
 * Subtracts b from a
 */
const sub: VMBuiltin = (args) => {
  checkArity("-", args, 2);
  const a = toNumber(args[0]!).value;
  const b = toNumber(args[1]!).value;
  return numberValue(a - b);
};

/**
 * * - Multiplication
 * Signature: *(a, b, c, ...)
 * Multiplies all arguments (converts to numbers)
 * Can take 0 or more arguments (0 args returns 1)
 */
const mul: VMBuiltin = (args) => {
  let product = 1;
  for (const arg of args) {
    product *= toNumber(arg).value;
  }
  return numberValue(product);
};

/**
 * / - Division
 * Signature: /(a, b)
 * Divides a by b
 * Throws error on division by zero
 */
const div: VMBuiltin = (args) => {
  checkArity("/", args, 2);
  const a = toNumber(args[0]!).value;
  const b = toNumber(args[1]!).value;
  if (b === 0) {
    throw new VMRuntimeError("Division by zero");
  }
  return numberValue(a / b);
};

/**
 * % - Modulo
 * Signature: %(a, b)
 * Returns remainder of a / b
 */
const mod: VMBuiltin = (args) => {
  checkArity("%", args, 2);
  const a = toNumber(args[0]!).value;
  const b = toNumber(args[1]!).value;
  return numberValue(a % b);
};

// =============================================================================
// Null Handling
// =============================================================================

/**
 * ?? - Null coalescing
 * Signature: ??(a, b)
 * Returns a if a is not null, otherwise returns b
 */
const nullCoalesce: VMBuiltin = (args) => {
  checkArity("??", args, 2);
  return isNull(args[0]!) ? args[1]! : args[0]!;
};

// =============================================================================
// Regex Operations
// =============================================================================

/**
 * match - Match a string against a regex
 * Signature: match(str, regex)
 * Returns: array of matches (including capture groups) or null if no match
 */
const match: VMBuiltin = (args) => {
  checkArity("match", args, 2);
  const str = toString(args[0]!).value;
  const pattern = args[1]!;

  if (!isRegex(pattern)) {
    throw new VMRuntimeError("match expects a regex as second argument");
  }

  const result = str.match(pattern.regex);
  if (result === null) {
    return nullValue();
  }

  return arrayValue(Array.from(result).map((s) => stringValue(s)));
};

/**
 * test - Test if a string matches a regex
 * Signature: test(str, regex)
 * Returns: true if string matches pattern, false otherwise
 */
const test: VMBuiltin = (args) => {
  checkArity("test", args, 2);
  const str = toString(args[0]!).value;
  const pattern = args[1]!;

  if (!isRegex(pattern)) {
    throw new VMRuntimeError("test expects a regex as second argument");
  }

  return booleanValue(pattern.regex.test(str));
};

// =============================================================================
// Export All Built-ins
// =============================================================================

/**
 * Create a map of all VM builtin functions.
 * This is used by the VM to resolve builtin calls.
 *
 * @returns Map from builtin name to implementation
 */
export function createVMBuiltins(): Map<string, VMBuiltin> {
  const builtins = new Map<string, VMBuiltin>();

  // String operations
  builtins.set("split", split);
  builtins.set("join", join);
  builtins.set("trim", trim);
  builtins.set("upper", upper);
  builtins.set("lower", lower);
  builtins.set("replace", replace);
  builtins.set("substring", substring);
  builtins.set("len", len);

  // Type conversion
  builtins.set("int", int);
  builtins.set("float", float);
  builtins.set("string", string);
  builtins.set("bool", bool);

  // Array operations
  builtins.set("first", first);
  builtins.set("last", last);
  builtins.set("get", get);

  // Logic operations
  // Note: and/or are special forms, not built-in functions
  builtins.set("not", not);

  // Comparison operations
  builtins.set("==", eq);
  builtins.set("!=", ne);
  builtins.set("<", lt);
  builtins.set(">", gt);
  builtins.set("<=", le);
  builtins.set(">=", ge);

  // Math operations
  builtins.set("+", add);
  builtins.set("-", sub);
  builtins.set("*", mul);
  builtins.set("/", div);
  builtins.set("%", mod);

  // Null handling
  builtins.set("??", nullCoalesce);

  // Regex operations
  builtins.set("match", match);
  builtins.set("test", test);

  return builtins;
}
