import { describe, expect, test } from "bun:test";
import { execute, executeToJS, RuntimeError } from "./index.ts";

describe("PEX Interpreter", () => {
  describe("Literals", () => {
    test("null", () => {
      expect(executeToJS("null")).toBe(null);
    });

    test("boolean", () => {
      expect(executeToJS("true")).toBe(true);
      expect(executeToJS("false")).toBe(false);
    });

    test("number", () => {
      expect(executeToJS("42")).toBe(42);
      expect(executeToJS("3.14")).toBe(3.14);
      expect(executeToJS("-10")).toBe(-10);
    });

    test("string", () => {
      expect(executeToJS('"hello"')).toBe("hello");
      expect(executeToJS("'world'")).toBe("world");
    });
  });

  describe("Source Variables", () => {
    test("$$ - program input", () => {
      expect(executeToJS("$$", { input: "test" })).toBe("test");
      expect(executeToJS("$$", { input: 42 })).toBe(42);
      expect(executeToJS("$$", { input: null })).toBe(null);
    });

    test("$ - pipeline value", () => {
      expect(executeToJS("$$ | upper $", { input: "hello" })).toBe("HELLO");
    });

    test("$0, $1 - array elements", () => {
      expect(executeToJS("$0", { input: ["a", "b", "c"] })).toBe("a");
      expect(executeToJS("$1", { input: ["a", "b", "c"] })).toBe("b");
      expect(executeToJS("$2", { input: ["a", "b", "c"] })).toBe("c");
      expect(executeToJS("$5", { input: ["a", "b", "c"] })).toBe(null);
    });
  });

  describe("String Operations", () => {
    test("upper", () => {
      expect(executeToJS('upper "hello"')).toBe("HELLO");
    });

    test("lower", () => {
      expect(executeToJS('lower "HELLO"')).toBe("hello");
    });

    test("trim", () => {
      expect(executeToJS('trim "  hello  "')).toBe("hello");
    });

    test("join", () => {
      expect(executeToJS('join "hello" " " "world"')).toBe("hello world");
    });

    test("split", () => {
      expect(executeToJS('split "a,b,c" ","')).toEqual(["a", "b", "c"]);
    });

    test("replace", () => {
      expect(executeToJS('replace "hello" "l" "L"')).toBe("heLlo");
      expect(executeToJS('replace "hello" /l/g "L"')).toBe("heLLo");
    });

    test("substring", () => {
      expect(executeToJS('substring "hello" 1 3')).toBe("el");
      expect(executeToJS('substring "hello" 2')).toBe("llo");
    });

    test("len", () => {
      expect(executeToJS('len "hello"')).toBe(5);
    });
  });

  describe("Type Conversion", () => {
    test("int", () => {
      expect(executeToJS('int "42"')).toBe(42);
      expect(executeToJS('int "3.14"')).toBe(3);
      expect(executeToJS('int "invalid"')).toBe(0);
    });

    test("float", () => {
      expect(executeToJS('float "3.14"')).toBe(3.14);
      expect(executeToJS('float "42"')).toBe(42);
      expect(executeToJS('float "invalid"')).toBe(0);
    });

    test("string", () => {
      expect(executeToJS("string 42")).toBe("42");
      expect(executeToJS("string true")).toBe("true");
    });

    test("bool", () => {
      expect(executeToJS("bool 1")).toBe(true);
      expect(executeToJS("bool 0")).toBe(false);
      expect(executeToJS('bool "hello"')).toBe(true);
      expect(executeToJS('bool ""')).toBe(false);
    });
  });

  describe("Array Operations", () => {
    test("first", () => {
      const result = executeToJS("first $$", { input: ["a", "b", "c"] });
      expect(result).toBe("a");
    });

    test("last", () => {
      const result = executeToJS("last $$", { input: ["a", "b", "c"] });
      expect(result).toBe("c");
    });

    test("get", () => {
      const result = executeToJS("get $$ 1", { input: ["a", "b", "c"] });
      expect(result).toBe("b");
      const defaultResult = executeToJS('get $$ 10 "default"', {
        input: ["a", "b", "c"],
      });
      expect(defaultResult).toBe("default");
    });

    test("len", () => {
      const result = executeToJS("len $$", { input: ["a", "b", "c"] });
      expect(result).toBe(3);
    });
  });

  describe("Math Operations", () => {
    test("+", () => {
      expect(executeToJS("+ 1 2 3")).toBe(6);
      expect(executeToJS("+ 10 5")).toBe(15);
    });

    test("-", () => {
      expect(executeToJS("- 10 3")).toBe(7);
    });

    test("*", () => {
      expect(executeToJS("* 2 3 4")).toBe(24);
    });

    test("/", () => {
      expect(executeToJS("/ 10 2")).toBe(5);
      expect(() => executeToJS("/ 10 0")).toThrow(RuntimeError);
    });

    test("%", () => {
      expect(executeToJS("% 10 3")).toBe(1);
    });
  });

  describe("Comparison Operations", () => {
    test("==", () => {
      expect(executeToJS("== 1 1")).toBe(true);
      expect(executeToJS("== 1 2")).toBe(false);
    });

    test("!=", () => {
      expect(executeToJS("!= 1 2")).toBe(true);
      expect(executeToJS("!= 1 1")).toBe(false);
    });

    test("<", () => {
      expect(executeToJS("< 1 2")).toBe(true);
      expect(executeToJS("< 2 1")).toBe(false);
    });

    test(">", () => {
      expect(executeToJS("> 2 1")).toBe(true);
      expect(executeToJS("> 1 2")).toBe(false);
    });

    test("<=", () => {
      expect(executeToJS("<= 1 2")).toBe(true);
      expect(executeToJS("<= 2 2")).toBe(true);
      expect(executeToJS("<= 3 2")).toBe(false);
    });

    test(">=", () => {
      expect(executeToJS(">= 2 1")).toBe(true);
      expect(executeToJS(">= 2 2")).toBe(true);
      expect(executeToJS(">= 1 2")).toBe(false);
    });
  });

  describe("Logic Operations", () => {
    test("and", () => {
      expect(executeToJS("and true true")).toBe(true);
      expect(executeToJS("and true false")).toBe(false);
      expect(executeToJS("and 1 2")).toBe(2);
    });

    test("or", () => {
      expect(executeToJS("or false true")).toBe(true);
      expect(executeToJS("or false false")).toBe(false);
      expect(executeToJS("or 0 5")).toBe(5);
    });

    test("not", () => {
      expect(executeToJS("not true")).toBe(false);
      expect(executeToJS("not false")).toBe(true);
    });
  });

  describe("Null Handling", () => {
    test("??", () => {
      expect(executeToJS("?? null 42")).toBe(42);
      expect(executeToJS("?? 10 42")).toBe(10);
    });
  });

  describe("Regex Operations", () => {
    test("match", () => {
      const result = executeToJS('match "hello123" /\\d+/');
      expect(result).toEqual(["123"]);
    });

    test("test", () => {
      expect(executeToJS('test "hello123" /\\d+/')).toBe(true);
      expect(executeToJS('test "hello" /\\d+/')).toBe(false);
    });
  });

  describe("Special Forms", () => {
    test("if - true branch", () => {
      expect(executeToJS('if true "yes" "no"')).toBe("yes");
    });

    test("if - false branch", () => {
      expect(executeToJS('if false "yes" "no"')).toBe("no");
    });

    test("if with comparison", () => {
      expect(executeToJS('if (> 5 3) "bigger" "smaller"')).toBe("bigger");
    });
  });

  describe("Effects", () => {
    test("let:", () => {
      const result = executeToJS('let: x 42; x');
      expect(result).toBe(42);
    });

    test("let: with expression", () => {
      const result = executeToJS('let: x (+ 10 5); * x 2');
      expect(result).toBe(30);
    });

    test("fn: definition and call", () => {
      const result = executeToJS("fn: double (x) * x 2; double 5");
      expect(result).toBe(10);
    });

    test("fn: with multiple parameters", () => {
      const result = executeToJS("fn: add (a b) + a b; add 3 4");
      expect(result).toBe(7);
    });

    test("assert: success", () => {
      expect(() => executeToJS("assert: true")).not.toThrow();
    });

    test("assert: failure", () => {
      expect(() => executeToJS("assert: false")).toThrow(RuntimeError);
    });
  });

  describe("Pipelines", () => {
    test("simple pipeline", () => {
      expect(executeToJS('$$ | upper | trim', { input: "  hello  " })).toBe(
        "HELLO",
      );
    });

    test("pipeline with $ reference", () => {
      expect(executeToJS('$$ | join "prefix-" $', { input: "test" })).toBe(
        "prefix-test",
      );
    });

    test("multi-stage pipeline", () => {
      expect(
        executeToJS('$$ | lower | trim | upper', { input: "  HELLO  " }),
      ).toBe("HELLO");
    });
  });

  describe("Shell Mode", () => {
    test("auto-inject $$ in last expression", () => {
      expect(executeToJS("upper", { shellMode: true, input: "hello" })).toBe(
        "HELLO",
      );
    });

    test("no injection when $$ is present", () => {
      expect(
        executeToJS("upper $$", { shellMode: true, input: "hello" }),
      ).toBe("HELLO");
    });

    test("pipeline in shell mode", () => {
      expect(
        executeToJS("lower | trim", { shellMode: true, input: "  HELLO  " }),
      ).toBe("hello");
    });
  });

  describe("Complex Examples", () => {
    test("email normalization", () => {
      const source = `
        fn: normalize (email) (lower email | trim);

        normalize $$
      `;
      expect(executeToJS(source, { input: "  USER@EXAMPLE.COM  " })).toBe(
        "user@example.com",
      );
    });

    test("temperature conversion", () => {
      const source = `
        let: FREEZING 32;
        let: RATIO 1.8;

        fn: c_to_f (c)
          + (* c RATIO) FREEZING;

        c_to_f $$
      `;
      expect(executeToJS(source, { input: 100 })).toBe(212);
    });

    test("conditional with source variable", () => {
      const source = 'if (> $$ 10) "big" "small"';
      expect(executeToJS(source, { input: 15 })).toBe("big");
      expect(executeToJS(source, { input: 5 })).toBe("small");
    });

    test("array processing with $0, $1", () => {
      const source = 'join $0 " " $1';
      expect(executeToJS(source, { input: ["John", "Doe"] })).toBe("John Doe");
    });
  });

  describe("Error Handling", () => {
    test("undefined variable", () => {
      expect(() => executeToJS("undefined_var")).toThrow(RuntimeError);
    });

    test("calling non-function", () => {
      expect(() => executeToJS("42 1 2 3")).toThrow(RuntimeError);
    });

    test("wrong argument count", () => {
      expect(() => executeToJS("(upper)")).toThrow(RuntimeError);
      expect(() => executeToJS('upper "a" "b"')).toThrow(RuntimeError);
    });

    test("array reference on non-array", () => {
      expect(() => executeToJS("$0", { input: "not an array" })).toThrow(
        RuntimeError,
      );
    });
  });
});
