/**
 * Tests for the VM public API exports and structure.
 *
 * These tests verify that the API is correctly exported and types are accessible.
 * Full end-to-end integration tests are in lib/integration.test.ts.
 */

import { describe, it, expect } from "bun:test";
import * as vmApi from "./index.ts";

describe("VM Public API - Exports", () => {
  it("exports VM class", () => {
    expect(vmApi.VM).toBeDefined();
    expect(typeof vmApi.VM).toBe("function");
  });

  it("exports VMError class", () => {
    expect(vmApi.VMError).toBeDefined();
    expect(typeof vmApi.VMError).toBe("function");
  });

  it("exports Continuation class", () => {
    expect(vmApi.Continuation).toBeDefined();
    expect(typeof vmApi.Continuation).toBe("function");
  });

  it("exports EffectHandler type", () => {
    // Type exports can't be tested directly, but we can verify the throwingEffectHandler
    expect(vmApi.throwingEffectHandler).toBeDefined();
    expect(typeof vmApi.throwingEffectHandler).toBe("function");
  });

  it("exports value factory functions", () => {
    expect(vmApi.nullValue).toBeDefined();
    expect(vmApi.booleanValue).toBeDefined();
    expect(vmApi.numberValue).toBeDefined();
    expect(vmApi.stringValue).toBeDefined();
    expect(vmApi.arrayValue).toBeDefined();
    expect(vmApi.objectValue).toBeDefined();
    expect(vmApi.regexValue).toBeDefined();
    expect(vmApi.closureValue).toBeDefined();
    expect(vmApi.continuationValue).toBeDefined();
  });

  it("exports type guards", () => {
    expect(vmApi.isNull).toBeDefined();
    expect(vmApi.isBoolean).toBeDefined();
    expect(vmApi.isNumber).toBeDefined();
    expect(vmApi.isString).toBeDefined();
    expect(vmApi.isArray).toBeDefined();
    expect(vmApi.isObject).toBeDefined();
    expect(vmApi.isRegex).toBeDefined();
    expect(vmApi.isClosure).toBeDefined();
    expect(vmApi.isContinuation).toBeDefined();
  });

  it("exports helper functions", () => {
    expect(vmApi.isTruthy).toBeDefined();
    expect(vmApi.isFalsy).toBeDefined();
    expect(vmApi.valuesEqual).toBeDefined();
    expect(vmApi.displayValue).toBeDefined();
    expect(vmApi.toBoolean).toBeDefined();
    expect(vmApi.toNumber).toBeDefined();
    expect(vmApi.toString).toBeDefined();
  });

  it("exports builtin-related functions", () => {
    expect(vmApi.createVMBuiltins).toBeDefined();
    expect(vmApi.VMRuntimeError).toBeDefined();
  });

  it("exports high-level API functions", () => {
    expect(vmApi.executePEX).toBeDefined();
    expect(vmApi.compilePEX).toBeDefined();
    expect(vmApi.executeBytecode).toBeDefined();
    expect(vmApi.createVM).toBeDefined();
  });

  it("exports runVM helper", () => {
    expect(vmApi.runVM).toBeDefined();
    expect(typeof vmApi.runVM).toBe("function");
  });
});

describe("VM Public API - Value Creation", () => {
  it("creates null value", () => {
    const value = vmApi.nullValue();
    expect(value.type).toBe("null");
    expect(vmApi.isNull(value)).toBe(true);
  });

  it("creates boolean values", () => {
    const trueValue = vmApi.booleanValue(true);
    const falseValue = vmApi.booleanValue(false);

    expect(trueValue.type).toBe("boolean");
    expect(falseValue.type).toBe("boolean");
    expect(vmApi.isBoolean(trueValue)).toBe(true);
    expect(vmApi.isBoolean(falseValue)).toBe(true);
  });

  it("creates number values", () => {
    const value = vmApi.numberValue(42);
    expect(value.type).toBe("number");
    expect(value.value).toBe(42);
    expect(vmApi.isNumber(value)).toBe(true);
  });

  it("creates string values", () => {
    const value = vmApi.stringValue("hello");
    expect(value.type).toBe("string");
    expect(value.value).toBe("hello");
    expect(vmApi.isString(value)).toBe(true);
  });

  it("creates array values", () => {
    const elements = [vmApi.numberValue(1), vmApi.numberValue(2)];
    const value = vmApi.arrayValue(elements);
    expect(value.type).toBe("array");
    expect(value.elements).toHaveLength(2);
    expect(vmApi.isArray(value)).toBe(true);
  });

  it("creates object values", () => {
    const props = new Map([["key", vmApi.stringValue("value")]]);
    const value = vmApi.objectValue(props);
    expect(value.type).toBe("object");
    expect(vmApi.isObject(value)).toBe(true);
  });

  it("creates regex values", () => {
    const value = vmApi.regexValue("\\d+", "g");
    expect(value.type).toBe("regex");
    expect(value.pattern).toBe("\\d+");
    expect(value.flags).toBe("g");
    expect(vmApi.isRegex(value)).toBe(true);
  });
});

describe("VM Public API - Value Helpers", () => {
  it("checks truthiness", () => {
    expect(vmApi.isTruthy(vmApi.booleanValue(true))).toBe(true);
    expect(vmApi.isTruthy(vmApi.booleanValue(false))).toBe(false);
    expect(vmApi.isTruthy(vmApi.nullValue())).toBe(false);
    expect(vmApi.isTruthy(vmApi.numberValue(0))).toBe(false);
    expect(vmApi.isTruthy(vmApi.numberValue(42))).toBe(true);
    expect(vmApi.isTruthy(vmApi.stringValue(""))).toBe(false);
    expect(vmApi.isTruthy(vmApi.stringValue("hello"))).toBe(true);
  });

  it("checks falsiness", () => {
    expect(vmApi.isFalsy(vmApi.booleanValue(false))).toBe(true);
    expect(vmApi.isFalsy(vmApi.booleanValue(true))).toBe(false);
    expect(vmApi.isFalsy(vmApi.nullValue())).toBe(true);
  });

  it("compares values for equality", () => {
    expect(vmApi.valuesEqual(vmApi.numberValue(42), vmApi.numberValue(42))).toBe(true);
    expect(vmApi.valuesEqual(vmApi.numberValue(42), vmApi.numberValue(43))).toBe(false);
    expect(vmApi.valuesEqual(vmApi.stringValue("a"), vmApi.stringValue("a"))).toBe(true);
    expect(vmApi.valuesEqual(vmApi.stringValue("a"), vmApi.stringValue("b"))).toBe(false);
  });

  it("displays values", () => {
    expect(vmApi.displayValue(vmApi.nullValue())).toBe("null");
    expect(vmApi.displayValue(vmApi.booleanValue(true))).toBe("true");
    expect(vmApi.displayValue(vmApi.numberValue(42))).toBe("42");
    expect(vmApi.displayValue(vmApi.stringValue("hello"))).toBe("hello");
  });

  it("converts to boolean", () => {
    const result = vmApi.toBoolean(vmApi.numberValue(42));
    expect(result.type).toBe("boolean");
    expect(result.value).toBe(true);
  });

  it("converts to number", () => {
    const result = vmApi.toNumber(vmApi.stringValue("42"));
    expect(result.type).toBe("number");
    expect(result.value).toBe(42);
  });

  it("converts to string", () => {
    const result = vmApi.toString(vmApi.numberValue(42));
    expect(result.type).toBe("string");
    expect(result.value).toBe("42");
  });
});

describe("VM Public API - Builtins", () => {
  it("creates builtin map", () => {
    const builtins = vmApi.createVMBuiltins();
    expect(builtins).toBeInstanceOf(Map);
    expect(builtins.size).toBeGreaterThan(0);
    expect(builtins.has("upper")).toBe(true);
    expect(builtins.has("lower")).toBe(true);
    expect(builtins.has("split")).toBe(true);
  });

  it("creates VMRuntimeError", () => {
    const error = new vmApi.VMRuntimeError("test error");
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("test error");
    expect(error.name).toBe("VMRuntimeError");
  });
});
