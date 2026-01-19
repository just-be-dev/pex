/**
 * Runtime value types for the PEX VM.
 *
 * Similar to interpreter values but optimized for stack-based VM operations.
 * Values are immutable and designed for efficient stack manipulation.
 */

import type { FunctionTemplate } from "../bytecode/format.ts";

/**
 * Runtime value types supported by the VM.
 */
export type Value =
  | NullValue
  | BooleanValue
  | NumberValue
  | StringValue
  | ArrayValue
  | ObjectValue
  | RegexValue
  | ClosureValue
  | ContinuationValue;

/**
 * Null value.
 */
export interface NullValue {
  type: "null";
}

/**
 * Boolean value (true/false).
 */
export interface BooleanValue {
  type: "boolean";
  value: boolean;
}

/**
 * Numeric value (64-bit float).
 */
export interface NumberValue {
  type: "number";
  value: number;
}

/**
 * String value.
 */
export interface StringValue {
  type: "string";
  value: string;
}

/**
 * Array value (ordered collection).
 */
export interface ArrayValue {
  type: "array";
  elements: Value[];
}

/**
 * Object value (key-value pairs).
 */
export interface ObjectValue {
  type: "object";
  properties: Map<string, Value>;
}

/**
 * Regular expression value.
 */
export interface RegexValue {
  type: "regex";
  pattern: string;
  flags: string;
  regex: RegExp;
}

/**
 * An upvalue captures a variable from an enclosing scope.
 * Used by closures to maintain references to outer variables.
 *
 * Upvalues can be either "open" (pointing to a stack slot) or "closed"
 * (holding a concrete value). This allows recursive functions to work
 * by capturing references that can be updated after closure creation.
 */
export type Upvalue = OpenUpvalue | ClosedUpvalue;

/**
 * Open upvalue - points to a stack slot that can be modified.
 * Used when the captured variable is still on the stack.
 */
export interface OpenUpvalue {
  type: "open";
  stack: Value[]; // Reference to the value stack
  index: number; // Index in the stack where the value lives
}

/**
 * Closed upvalue - holds a concrete value.
 * Used when the captured variable's stack frame has been popped.
 */
export interface ClosedUpvalue {
  type: "closed";
  value: Value;
}

/**
 * Closure value (function with captured variables).
 * References a FunctionTemplate from the bytecode and captures upvalues.
 */
export interface ClosureValue {
  type: "closure";
  template: FunctionTemplate; // Compiled function template from bytecode
  upvalues: Upvalue[]; // Captured variables from enclosing scopes
  name: string | null; // Function name (for debugging/display)
}

/**
 * Call frame for the VM execution stack.
 * Represents a single function invocation.
 */
export interface CallFrame {
  closure: ClosureValue; // The closure being executed
  ip: number; // Instruction pointer (offset in closure's bytecode)
  bp: number; // Base pointer (index in value stack where locals start)
}

/**
 * One-shot continuation for algebraic effects.
 * Captures the VM state when an effect is performed.
 * Can be resumed exactly once with a value.
 */
export interface ContinuationValue {
  type: "continuation";
  frames: CallFrame[]; // Saved call stack
  stack: Value[]; // Saved operand stack
  resumed: boolean; // Guard against double-resume (one-shot enforcement)
}

// =============================================================================
// Factory functions for creating values
// =============================================================================

/**
 * Create a null value.
 */
export function nullValue(): NullValue {
  return { type: "null" };
}

/**
 * Create a boolean value.
 */
export function booleanValue(value: boolean): BooleanValue {
  return { type: "boolean", value };
}

/**
 * Create a number value.
 */
export function numberValue(value: number): NumberValue {
  return { type: "number", value };
}

/**
 * Create a string value.
 */
export function stringValue(value: string): StringValue {
  return { type: "string", value };
}

/**
 * Create an array value.
 */
export function arrayValue(elements: Value[]): ArrayValue {
  return { type: "array", elements };
}

/**
 * Create an object value.
 */
export function objectValue(properties: Map<string, Value>): ObjectValue {
  return { type: "object", properties };
}

/**
 * Create a regex value.
 */
export function regexValue(pattern: string, flags: string): RegexValue {
  return { type: "regex", pattern, flags, regex: new RegExp(pattern, flags) };
}

/**
 * Create a closure value.
 */
export function closureValue(
  template: FunctionTemplate,
  upvalues: Upvalue[],
  name: string | null = null,
): ClosureValue {
  return { type: "closure", template, upvalues, name };
}

/**
 * Create a continuation value.
 */
export function continuationValue(
  frames: CallFrame[],
  stack: Value[],
): ContinuationValue {
  return { type: "continuation", frames, stack, resumed: false };
}

/**
 * Create an open upvalue pointing to a stack slot.
 */
export function openUpvalue(stack: Value[], index: number): OpenUpvalue {
  return { type: "open", stack, index };
}

/**
 * Create a closed upvalue holding a concrete value.
 */
export function closedUpvalue(value: Value): ClosedUpvalue {
  return { type: "closed", value };
}

/**
 * Get the current value from an upvalue (open or closed).
 */
export function getUpvalueValue(upvalue: Upvalue): Value {
  if (upvalue.type === "open") {
    return upvalue.stack[upvalue.index]!;
  }
  return upvalue.value;
}

/**
 * Close an open upvalue by capturing its current value.
 * If already closed, returns it unchanged.
 */
export function closeUpvalue(upvalue: Upvalue): ClosedUpvalue {
  if (upvalue.type === "closed") {
    return upvalue;
  }
  return closedUpvalue(upvalue.stack[upvalue.index]!);
}

// =============================================================================
// Type guards
// =============================================================================

/**
 * Check if a value is null.
 */
export function isNull(value: Value): value is NullValue {
  return value.type === "null";
}

/**
 * Check if a value is a boolean.
 */
export function isBoolean(value: Value): value is BooleanValue {
  return value.type === "boolean";
}

/**
 * Check if a value is a number.
 */
export function isNumber(value: Value): value is NumberValue {
  return value.type === "number";
}

/**
 * Check if a value is a string.
 */
export function isString(value: Value): value is StringValue {
  return value.type === "string";
}

/**
 * Check if a value is an array.
 */
export function isArray(value: Value): value is ArrayValue {
  return value.type === "array";
}

/**
 * Check if a value is an object.
 */
export function isObject(value: Value): value is ObjectValue {
  return value.type === "object";
}

/**
 * Check if a value is a regex.
 */
export function isRegex(value: Value): value is RegexValue {
  return value.type === "regex";
}

/**
 * Check if a value is a closure.
 */
export function isClosure(value: Value): value is ClosureValue {
  return value.type === "closure";
}

/**
 * Check if a value is a continuation.
 */
export function isContinuation(value: Value): value is ContinuationValue {
  return value.type === "continuation";
}

// =============================================================================
// Helper functions
// =============================================================================

/**
 * Check if a value is truthy.
 * Follows JavaScript semantics:
 * - null, false, 0, NaN, "" are falsy
 * - Everything else is truthy
 */
export function isTruthy(value: Value): boolean {
  if (isNull(value)) return false;
  if (isBoolean(value)) return value.value;
  if (isNumber(value)) return value.value !== 0 && !Number.isNaN(value.value);
  if (isString(value)) return value.value.length > 0;
  // Arrays, objects, regex, closures, continuations are always truthy
  return true;
}

/**
 * Check if a value is falsy.
 */
export function isFalsy(value: Value): boolean {
  return !isTruthy(value);
}

/**
 * Deep equality comparison between two values.
 * Arrays and objects are compared recursively.
 * Closures and continuations are compared by reference.
 */
export function valuesEqual(a: Value, b: Value): boolean {
  if (a.type !== b.type) return false;

  switch (a.type) {
    case "null":
      return true;
    case "boolean":
      return a.value === (b as BooleanValue).value;
    case "number":
      return a.value === (b as NumberValue).value;
    case "string":
      return a.value === (b as StringValue).value;
    case "regex":
      return (
        a.pattern === (b as RegexValue).pattern &&
        a.flags === (b as RegexValue).flags
      );
    case "array": {
      const bArray = b as ArrayValue;
      if (a.elements.length !== bArray.elements.length) return false;
      return a.elements.every((elem, i) =>
        valuesEqual(elem, bArray.elements[i]!)
      );
    }
    case "object": {
      const bObject = b as ObjectValue;
      if (a.properties.size !== bObject.properties.size) return false;
      for (const [key, value] of a.properties) {
        const bValue = bObject.properties.get(key);
        if (!bValue || !valuesEqual(value, bValue)) return false;
      }
      return true;
    }
    case "closure":
      // Closures are equal only if they're the same reference
      return a === b;
    case "continuation":
      // Continuations are equal only if they're the same reference
      return a === b;
    default:
      return false;
  }
}

/**
 * Get a human-readable string representation of a value.
 * Used for debugging, error messages, and display.
 */
export function displayValue(value: Value): string {
  switch (value.type) {
    case "null":
      return "null";
    case "boolean":
      return String(value.value);
    case "number":
      return String(value.value);
    case "string":
      return value.value;
    case "regex":
      return `/${value.pattern}/${value.flags}`;
    case "array": {
      const elements = value.elements.map((v) => displayValue(v));
      return `[${elements.join(", ")}]`;
    }
    case "object": {
      const entries = Array.from(value.properties.entries())
        .map(([k, v]) => `${k}: ${displayValue(v)}`)
        .join(", ");
      return `{${entries}}`;
    }
    case "closure":
      return value.name ? `<function ${value.name}>` : "<function>";
    case "continuation":
      return "<continuation>";
    default:
      return "<unknown>";
  }
}

// =============================================================================
// Type coercion functions
// =============================================================================

/**
 * Convert a value to a boolean.
 * Uses truthy/falsy semantics.
 */
export function toBoolean(value: Value): BooleanValue {
  return booleanValue(isTruthy(value));
}

/**
 * Convert a value to a number.
 * - Numbers are returned as-is
 * - Booleans: true -> 1, false -> 0
 * - Strings: parsed as numbers (NaN if invalid)
 * - Null: 0
 * - Everything else: NaN
 */
export function toNumber(value: Value): NumberValue {
  if (isNumber(value)) return value;
  if (isBoolean(value)) return numberValue(value.value ? 1 : 0);
  if (isString(value)) {
    const num = Number(value.value);
    return numberValue(num);
  }
  if (isNull(value)) return numberValue(0);
  return numberValue(NaN);
}

/**
 * Convert a value to a string.
 * Provides human-readable representations for all value types.
 */
export function toString(value: Value): StringValue {
  if (isString(value)) return value;
  return stringValue(displayValue(value));
}
