/**
 * Runtime value types for the PEX interpreter
 */

import type { SExpr } from "../parser/ast.ts";

// Runtime value types
export type Value =
  | NullValue
  | BooleanValue
  | NumberValue
  | StringValue
  | ArrayValue
  | ObjectValue
  | RegexValue
  | FunctionValue;

export interface NullValue {
  type: "null";
}

export interface BooleanValue {
  type: "boolean";
  value: boolean;
}

export interface NumberValue {
  type: "number";
  value: number;
}

export interface StringValue {
  type: "string";
  value: string;
}

export interface ArrayValue {
  type: "array";
  elements: Value[];
}

export interface ObjectValue {
  type: "object";
  properties: Map<string, Value>;
}

export interface RegexValue {
  type: "regex";
  pattern: string;
  flags: string;
  regex: RegExp;
}

export interface FunctionValue {
  type: "function";
  name: string | null;
  params: string[];
  body: SExpr | null; // SExpr for user-defined functions, null for builtins
  isBuiltin: boolean;
  builtin?: BuiltinFunction;
}

export type BuiltinFunction = (args: Value[]) => Value;

// Factory functions for creating values
export function nullValue(): NullValue {
  return { type: "null" };
}

export function booleanValue(value: boolean): BooleanValue {
  return { type: "boolean", value };
}

export function numberValue(value: number): NumberValue {
  return { type: "number", value };
}

export function stringValue(value: string): StringValue {
  return { type: "string", value };
}

export function arrayValue(elements: Value[]): ArrayValue {
  return { type: "array", elements };
}

export function objectValue(properties: Map<string, Value>): ObjectValue {
  return { type: "object", properties };
}

export function regexValue(pattern: string, flags: string): RegexValue {
  return { type: "regex", pattern, flags, regex: new RegExp(pattern, flags) };
}

export function functionValue(
  name: string | null,
  params: string[],
  body: SExpr,
): FunctionValue {
  return { type: "function", name, params, body, isBuiltin: false };
}

export function builtinFunction(
  name: string,
  builtin: BuiltinFunction,
): FunctionValue {
  return {
    type: "function",
    name,
    params: [],
    body: null,
    isBuiltin: true,
    builtin,
  };
}

// Type guards
export function isNull(value: Value): value is NullValue {
  return value.type === "null";
}

export function isBoolean(value: Value): value is BooleanValue {
  return value.type === "boolean";
}

export function isNumber(value: Value): value is NumberValue {
  return value.type === "number";
}

export function isString(value: Value): value is StringValue {
  return value.type === "string";
}

export function isArray(value: Value): value is ArrayValue {
  return value.type === "array";
}

export function isObject(value: Value): value is ObjectValue {
  return value.type === "object";
}

export function isRegex(value: Value): value is RegexValue {
  return value.type === "regex";
}

export function isFunction(value: Value): value is FunctionValue {
  return value.type === "function";
}

// Truthy/falsy evaluation (following JavaScript semantics)
export function isTruthy(value: Value): boolean {
  if (isNull(value)) return false;
  if (isBoolean(value)) return value.value;
  if (isNumber(value)) return value.value !== 0 && !Number.isNaN(value.value);
  if (isString(value)) return value.value.length > 0;
  return true; // arrays, objects, regex, functions are always truthy
}

export function isFalsy(value: Value): boolean {
  return !isTruthy(value);
}

// Type coercion
export function toBoolean(value: Value): BooleanValue {
  return booleanValue(isTruthy(value));
}

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

export function toString(value: Value): StringValue {
  if (isString(value)) return value;
  if (isNumber(value)) return stringValue(String(value.value));
  if (isBoolean(value)) return stringValue(String(value.value));
  if (isNull(value)) return stringValue("null");
  if (isArray(value)) {
    const elements = value.elements.map((v) => toString(v).value);
    return stringValue(`[${elements.join(", ")}]`);
  }
  if (isObject(value)) {
    const entries = Array.from(value.properties.entries())
      .map(([k, v]) => `${k}: ${toString(v).value}`)
      .join(", ");
    return stringValue(`{${entries}}`);
  }
  if (isRegex(value)) {
    return stringValue(`/${value.pattern}/${value.flags}`);
  }
  if (isFunction(value)) {
    return stringValue(
      value.name ? `<function ${value.name}>` : "<function>",
    );
  }
  return stringValue("<unknown>");
}

// Value equality
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
    case "array":
      const bArray = b as ArrayValue;
      if (a.elements.length !== bArray.elements.length) return false;
      return a.elements.every((elem, i) =>
        valuesEqual(elem, bArray.elements[i]!),
      );
    case "object":
      const bObject = b as ObjectValue;
      if (a.properties.size !== bObject.properties.size) return false;
      for (const [key, value] of a.properties) {
        const bValue = bObject.properties.get(key);
        if (!bValue || !valuesEqual(value, bValue)) return false;
      }
      return true;
    case "function":
      return a === b; // Functions are equal only if they're the same reference
    default:
      return false;
  }
}

// Value display (for debugging/printing)
export function displayValue(value: Value): string {
  return toString(value).value;
}
