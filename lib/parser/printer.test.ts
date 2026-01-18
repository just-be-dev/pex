import { describe, test, expect } from "bun:test";
import { print } from "./printer.ts";
import { tokenize } from "./lexer.ts";

describe("Printer", () => {
  describe("Basic tokens", () => {
    test("prints simple identifier", () => {
      const tokens = tokenize("lower");
      expect(print(tokens)).toBe("lower");
    });

    test("prints function call with space", () => {
      const tokens = tokenize("lower email");
      expect(print(tokens)).toBe("lower email");
    });

    test("prints multiple identifiers with spaces", () => {
      const tokens = tokenize("add x y");
      expect(print(tokens)).toBe("add x y");
    });
  });

  describe("Pipes", () => {
    test("prints pipe without extra spaces", () => {
      const tokens = tokenize("email | lower");
      expect(print(tokens)).toBe("email | lower");
    });

    test("prints multiple pipes", () => {
      const tokens = tokenize("email | lower | trim");
      expect(print(tokens)).toBe("email | lower | trim");
    });

    test("prints pipe with function call", () => {
      const tokens = tokenize("add x y | mul 2");
      expect(print(tokens)).toBe("add x y | mul 2");
    });
  });

  describe("Parentheses", () => {
    test("prints parentheses without inner spaces", () => {
      const tokens = tokenize("(lower email)");
      expect(print(tokens)).toBe("(lower email)");
    });

    test("prints nested parentheses", () => {
      const tokens = tokenize("(add (mul x 2) y)");
      expect(print(tokens)).toBe("(add (mul x 2) y)");
    });

    test("prints empty parentheses", () => {
      const tokens = tokenize("()");
      expect(print(tokens)).toBe("()");
    });

    test("prints multiple expressions with parens", () => {
      const tokens = tokenize("(add x y) (mul a b)");
      expect(print(tokens)).toBe("(add x y) (mul a b)");
    });
  });

  describe("Semicolons", () => {
    test("prints semicolon without extra spaces", () => {
      const tokens = tokenize("let: x 10; x");
      expect(print(tokens)).toBe("let: x 10; x");
    });

    test("prints multiple semicolons", () => {
      const tokens = tokenize("let: x 10; let: y 20; add x y");
      expect(print(tokens)).toBe("let: x 10; let: y 20; add x y");
    });
  });

  describe("Commas", () => {
    test("prints comma without extra space before", () => {
      const tokens = tokenize("fn: add x, y");
      expect(print(tokens)).toBe("fn: add x, y");
    });

    test("prints multiple commas", () => {
      const tokens = tokenize("call a, b, c");
      expect(print(tokens)).toBe("call a, b, c");
    });
  });

  describe("Literals", () => {
    test("prints numbers", () => {
      expect(print(tokenize("42"))).toBe("42");
      expect(print(tokenize("3.14"))).toBe("3.14");
      expect(print(tokenize("-10"))).toBe("-10");
      expect(print(tokenize("0"))).toBe("0");
    });

    test("prints strings", () => {
      expect(print(tokenize('"hello"'))).toBe('"hello"');
      expect(print(tokenize("'world'"))).toBe("'world'");
      expect(print(tokenize('"with spaces"'))).toBe('"with spaces"');
      expect(print(tokenize('"with\\"quotes"'))).toBe('"with\\"quotes"');
    });

    test("prints booleans", () => {
      expect(print(tokenize("true"))).toBe("true");
      expect(print(tokenize("false"))).toBe("false");
    });

    test("prints null", () => {
      expect(print(tokenize("null"))).toBe("null");
    });

    test("prints regex", () => {
      expect(print(tokenize("/pattern/"))).toBe("/pattern/");
      expect(print(tokenize("/test/gi"))).toBe("/test/gi");
    });
  });

  describe("Effect identifiers", () => {
    test("prints effect identifier with colon", () => {
      const tokens = tokenize("let: x 10");
      expect(print(tokens)).toBe("let: x 10");
    });

    test("prints multiple effect statements", () => {
      const tokens = tokenize("fn: double x");
      expect(print(tokens)).toBe("fn: double x");
    });
  });

  describe("Source references", () => {
    test("prints pipeline source reference", () => {
      expect(print(tokenize("$"))).toBe("$");
    });

    test("prints program source reference", () => {
      expect(print(tokenize("$$"))).toBe("$$");
    });

    test("prints array source references", () => {
      expect(print(tokenize("$0"))).toBe("$0");
      expect(print(tokenize("$1"))).toBe("$1");
      expect(print(tokenize("$10"))).toBe("$10");
    });
  });

  describe("Complex expressions", () => {
    test("prints conditional expression", () => {
      const tokens = tokenize('(if (> x 10) "big" "small")');
      expect(print(tokens)).toBe('(if (> x 10) "big" "small")');
    });

    test("prints arithmetic expression", () => {
      const tokens = tokenize("(+ (* x 2) (- y 3))");
      expect(print(tokens)).toBe("(+ (* x 2) (- y 3))");
    });

    test("prints mixed pipeline and semicolon", () => {
      const tokens = tokenize("let: x 10; x | mul 2 | add 5");
      expect(print(tokens)).toBe("let: x 10; x | mul 2 | add 5");
    });

    test("prints complex nested structure", () => {
      const tokens = tokenize("let: process (fn: x (x | lower | trim)); process email");
      expect(print(tokens)).toBe("let: process (fn: x (x | lower | trim)); process email");
    });
  });

  describe("Roundtrip tests", () => {
    const testRoundtrip = (source: string, description: string) => {
      test(`roundtrips ${description}`, () => {
        const tokens = tokenize(source);
        const printed = print(tokens);
        const reparsed = tokenize(printed);

        // Remove EOF tokens for comparison
        const originalNoEof = tokens.filter(t => t.type !== "EOF");
        const reparsedNoEof = reparsed.filter(t => t.type !== "EOF");

        // Compare token types and raw values
        expect(reparsedNoEof.length).toBe(originalNoEof.length);
        for (let i = 0; i < originalNoEof.length; i++) {
          expect(reparsedNoEof[i]?.type).toBe(originalNoEof[i]?.type);
          expect(reparsedNoEof[i]?.raw).toBe(originalNoEof[i]?.raw);
        }
      });
    };

    testRoundtrip("lower", "simple identifier");
    testRoundtrip("lower email", "function call");
    testRoundtrip("email | lower | trim", "pipeline");
    testRoundtrip("(lower email)", "parentheses");
    testRoundtrip("let: x 10; x", "effect statement");
    testRoundtrip("42", "number");
    testRoundtrip('"hello"', "string");
    testRoundtrip("true", "boolean");
    testRoundtrip("null", "null");
    testRoundtrip("/test/gi", "regex");
    testRoundtrip('(if (> x 10) "big" "small")', "complex expression");
    testRoundtrip("$", "pipeline source ref");
    testRoundtrip("$$", "program source ref");
    testRoundtrip("$0", "array source ref");
  });

  describe("Empty input", () => {
    test("prints empty string for empty token array", () => {
      expect(print([])).toBe("");
    });

    test("prints empty string for EOF-only token array", () => {
      const tokens = tokenize("");
      expect(print(tokens)).toBe("");
    });
  });

  describe("Whitespace handling", () => {
    test("removes unnecessary whitespace", () => {
      const tokens = tokenize("lower   email");
      expect(print(tokens)).toBe("lower email");
    });

    test("normalizes whitespace around operators", () => {
      const tokens = tokenize("x  |  lower  |  trim");
      expect(print(tokens)).toBe("x | lower | trim");
    });

    test("normalizes whitespace in parentheses", () => {
      const tokens = tokenize("(  lower   email  )");
      expect(print(tokens)).toBe("(lower email)");
    });
  });
});
