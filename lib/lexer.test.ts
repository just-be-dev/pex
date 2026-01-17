import { describe, test, expect } from "bun:test";
import { tokenize, TokenType, LexerError } from "./lexer.ts";

describe("Lexer", () => {
  describe("Numbers", () => {
    test("tokenizes integers", () => {
      const tokens = tokenize("42");
      expect(tokens).toHaveLength(2); // number + EOF
      expect(tokens[0]?.type).toBe(TokenType.NUMBER);
      expect(tokens[0]?.value).toBe(42);
      expect(tokens[0]?.raw).toBe("42");
    });

    test("tokenizes floats", () => {
      const tokens = tokenize("3.14");
      expect(tokens[0]?.type).toBe(TokenType.NUMBER);
      expect(tokens[0]?.value).toBe(3.14);
      expect(tokens[0]?.raw).toBe("3.14");
    });

    test("tokenizes negative numbers", () => {
      const tokens = tokenize("-10");
      expect(tokens[0]?.type).toBe(TokenType.NUMBER);
      expect(tokens[0]?.value).toBe(-10);
      expect(tokens[0]?.raw).toBe("-10");
    });

    test("tokenizes negative floats", () => {
      const tokens = tokenize("-3.14");
      expect(tokens[0]?.type).toBe(TokenType.NUMBER);
      expect(tokens[0]?.value).toBe(-3.14);
    });

    test("tokenizes zero", () => {
      const tokens = tokenize("0");
      expect(tokens[0]?.type).toBe(TokenType.NUMBER);
      expect(tokens[0]?.value).toBe(0);
    });
  });

  describe("Strings", () => {
    test("tokenizes double-quoted strings", () => {
      const tokens = tokenize('"hello world"');
      expect(tokens[0]?.type).toBe(TokenType.STRING);
      expect(tokens[0]?.value).toBe("hello world");
      expect(tokens[0]?.raw).toBe('"hello world"');
    });

    test("tokenizes single-quoted strings", () => {
      const tokens = tokenize("'hello world'");
      expect(tokens[0]?.type).toBe(TokenType.STRING);
      expect(tokens[0]?.value).toBe("hello world");
      expect(tokens[0]?.raw).toBe("'hello world'");
    });

    test("tokenizes empty strings", () => {
      const tokens = tokenize('""');
      expect(tokens[0]?.type).toBe(TokenType.STRING);
      expect(tokens[0]?.value).toBe("");
    });

    test("handles escape sequences", () => {
      const tokens = tokenize('"hello\\nworld\\t!"');
      expect(tokens[0]?.value).toBe("hello\nworld\t!");
    });

    test("handles escaped quotes", () => {
      const tokens = tokenize('"say \\"hello\\""');
      expect(tokens[0]?.value).toBe('say "hello"');
    });

    test("throws on unterminated string", () => {
      expect(() => tokenize('"hello')).toThrow(LexerError);
    });
  });

  describe("Regex", () => {
    test("tokenizes basic regex", () => {
      const tokens = tokenize("/pattern/");
      expect(tokens[0]?.type).toBe(TokenType.REGEX);
      expect(tokens[0]?.value).toBe("/pattern/");
    });

    test("tokenizes regex with flags", () => {
      const tokens = tokenize("/pattern/gi");
      expect(tokens[0]?.type).toBe(TokenType.REGEX);
      expect(tokens[0]?.value).toBe("/pattern/gi");
    });

    test("tokenizes regex with escaped characters", () => {
      const tokens = tokenize("/\\d+/");
      expect(tokens[0]?.type).toBe(TokenType.REGEX);
      expect(tokens[0]?.value).toBe("/\\d+/");
    });

    test("tokenizes complex regex", () => {
      const tokens = tokenize("/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/");
      expect(tokens[0]?.type).toBe(TokenType.REGEX);
      expect(tokens[0]?.value).toBe("/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/");
    });

    test("distinguishes regex from division", () => {
      const tokens = tokenize("x / 2");
      expect(tokens[0]?.type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1]?.type).toBe(TokenType.SLASH);
      expect(tokens[2]?.type).toBe(TokenType.NUMBER);
    });

    test("throws on unterminated regex", () => {
      expect(() => tokenize("/pattern")).toThrow(LexerError);
    });
  });

  describe("Booleans and Null", () => {
    test("tokenizes true", () => {
      const tokens = tokenize("true");
      expect(tokens[0]?.type).toBe(TokenType.BOOLEAN);
      expect(tokens[0]?.value).toBe(true);
    });

    test("tokenizes false", () => {
      const tokens = tokenize("false");
      expect(tokens[0]?.type).toBe(TokenType.BOOLEAN);
      expect(tokens[0]?.value).toBe(false);
    });

    test("tokenizes null", () => {
      const tokens = tokenize("null");
      expect(tokens[0]?.type).toBe(TokenType.NULL);
      expect(tokens[0]?.value).toBe(null);
    });
  });

  describe("Identifiers", () => {
    test("tokenizes simple identifiers", () => {
      const tokens = tokenize("foo");
      expect(tokens[0]?.type).toBe(TokenType.IDENTIFIER);
      expect(tokens[0]?.value).toBe("foo");
    });

    test("tokenizes identifiers with underscores", () => {
      const tokens = tokenize("foo_bar");
      expect(tokens[0]?.type).toBe(TokenType.IDENTIFIER);
      expect(tokens[0]?.value).toBe("foo_bar");
    });

    test("tokenizes identifiers with numbers", () => {
      const tokens = tokenize("var123");
      expect(tokens[0]?.type).toBe(TokenType.IDENTIFIER);
      expect(tokens[0]?.value).toBe("var123");
    });

    test("tokenizes $ as identifier", () => {
      const tokens = tokenize("$");
      expect(tokens[0]?.type).toBe(TokenType.IDENTIFIER);
      expect(tokens[0]?.value).toBe("$");
    });

    test("tokenizes $$ as identifier", () => {
      const tokens = tokenize("$$");
      expect(tokens[0]?.type).toBe(TokenType.IDENTIFIER);
      expect(tokens[0]?.value).toBe("$$");
    });

    test("tokenizes $0 as identifier", () => {
      const tokens = tokenize("$0");
      expect(tokens[0]?.type).toBe(TokenType.IDENTIFIER);
      expect(tokens[0]?.value).toBe("$0");
    });
  });

  describe("Keywords", () => {
    test("tokenizes let", () => {
      const tokens = tokenize("let");
      expect(tokens[0]?.type).toBe(TokenType.LET);
    });

    test("tokenizes fn", () => {
      const tokens = tokenize("fn");
      expect(tokens[0]?.type).toBe(TokenType.FN);
    });

    test("tokenizes if", () => {
      const tokens = tokenize("if");
      expect(tokens[0]?.type).toBe(TokenType.IF);
    });

    test("tokenizes and", () => {
      const tokens = tokenize("and");
      expect(tokens[0]?.type).toBe(TokenType.AND);
    });

    test("tokenizes or", () => {
      const tokens = tokenize("or");
      expect(tokens[0]?.type).toBe(TokenType.OR);
    });

    test("tokenizes not", () => {
      const tokens = tokenize("not");
      expect(tokens[0]?.type).toBe(TokenType.NOT);
    });
  });

  describe("Operators", () => {
    test("tokenizes pipe", () => {
      const tokens = tokenize("|");
      expect(tokens[0]?.type).toBe(TokenType.PIPE);
    });

    test("tokenizes semicolon", () => {
      const tokens = tokenize(";");
      expect(tokens[0]?.type).toBe(TokenType.SEMICOLON);
    });

    test("tokenizes parentheses", () => {
      const tokens = tokenize("()");
      expect(tokens[0]?.type).toBe(TokenType.LPAREN);
      expect(tokens[1]?.type).toBe(TokenType.RPAREN);
    });

    test("tokenizes comma", () => {
      const tokens = tokenize(",");
      expect(tokens[0]?.type).toBe(TokenType.COMMA);
    });

    test("tokenizes arithmetic operators", () => {
      const tokens = tokenize("+ - * / %");
      expect(tokens[0]?.type).toBe(TokenType.PLUS);
      expect(tokens[1]?.type).toBe(TokenType.MINUS);
      expect(tokens[2]?.type).toBe(TokenType.STAR);
      expect(tokens[3]?.type).toBe(TokenType.SLASH);
      expect(tokens[4]?.type).toBe(TokenType.PERCENT);
    });

    test("tokenizes comparison operators", () => {
      const tokens = tokenize("== != < > <= >=");
      expect(tokens[0]?.type).toBe(TokenType.EQ);
      expect(tokens[1]?.type).toBe(TokenType.NE);
      expect(tokens[2]?.type).toBe(TokenType.LT);
      expect(tokens[3]?.type).toBe(TokenType.GT);
      expect(tokens[4]?.type).toBe(TokenType.LE);
      expect(tokens[5]?.type).toBe(TokenType.GE);
    });

    test("tokenizes nullish coalescing", () => {
      const tokens = tokenize("??");
      expect(tokens[0]?.type).toBe(TokenType.NULLISH);
    });

    test("throws on single =", () => {
      expect(() => tokenize("=")).toThrow(LexerError);
    });

    test("throws on single !", () => {
      expect(() => tokenize("!")).toThrow(LexerError);
    });

    test("throws on single ?", () => {
      expect(() => tokenize("?")).toThrow(LexerError);
    });
  });

  describe("Comments", () => {
    test("skips single-line comments", () => {
      const tokens = tokenize(";; this is a comment\n42");
      expect(tokens).toHaveLength(2); // number + EOF
      expect(tokens[0]?.type).toBe(TokenType.NUMBER);
      expect(tokens[0]?.value).toBe(42);
    });

    test("skips comments at end of file", () => {
      const tokens = tokenize("42 ;; comment");
      expect(tokens).toHaveLength(2); // number + EOF
    });

    test("distinguishes semicolon from comment", () => {
      const tokens = tokenize("let x 10;");
      expect(tokens[3]?.type).toBe(TokenType.SEMICOLON);
    });
  });

  describe("Complex expressions", () => {
    test("tokenizes pipeline", () => {
      const tokens = tokenize("email | lower | trim");
      expect(tokens).toHaveLength(6); // 3 identifiers + 2 pipes + EOF
      expect(tokens[0]?.value).toBe("email");
      expect(tokens[1]?.type).toBe(TokenType.PIPE);
      expect(tokens[2]?.value).toBe("lower");
      expect(tokens[3]?.type).toBe(TokenType.PIPE);
      expect(tokens[4]?.value).toBe("trim");
    });

    test("tokenizes function call", () => {
      const tokens = tokenize('split "hello" " "');
      expect(tokens[0]?.value).toBe("split");
      expect(tokens[1]?.value).toBe("hello");
      expect(tokens[2]?.value).toBe(" ");
    });

    test("tokenizes let statement", () => {
      const tokens = tokenize("let x 10;");
      expect(tokens[0]?.type).toBe(TokenType.LET);
      expect(tokens[1]?.value).toBe("x");
      expect(tokens[2]?.value).toBe(10);
      expect(tokens[3]?.type).toBe(TokenType.SEMICOLON);
    });

    test("tokenizes function definition", () => {
      const tokens = tokenize("fn double (x) * x 2;");
      expect(tokens[0]?.type).toBe(TokenType.FN);
      expect(tokens[1]?.value).toBe("double");
      expect(tokens[2]?.type).toBe(TokenType.LPAREN);
      expect(tokens[3]?.value).toBe("x");
      expect(tokens[4]?.type).toBe(TokenType.RPAREN);
      expect(tokens[5]?.type).toBe(TokenType.STAR);
      expect(tokens[6]?.value).toBe("x");
      expect(tokens[7]?.value).toBe(2);
      expect(tokens[8]?.type).toBe(TokenType.SEMICOLON);
    });

    test("tokenizes conditional", () => {
      const tokens = tokenize('if (> $ 10) "big" "small"');
      expect(tokens[0]?.type).toBe(TokenType.IF);
      expect(tokens[1]?.type).toBe(TokenType.LPAREN);
      expect(tokens[2]?.type).toBe(TokenType.GT);
      expect(tokens[3]?.value).toBe("$");
      expect(tokens[4]?.value).toBe(10);
      expect(tokens[5]?.type).toBe(TokenType.RPAREN);
      expect(tokens[6]?.value).toBe("big");
      expect(tokens[7]?.value).toBe("small");
    });

    test("tokenizes array indexing", () => {
      const tokens = tokenize("join $0 \" \" $1");
      expect(tokens[0]?.value).toBe("join");
      expect(tokens[1]?.value).toBe("$0");
      expect(tokens[2]?.value).toBe(" ");
      expect(tokens[3]?.value).toBe("$1");
    });

    test("tokenizes complex email normalization", () => {
      const source = "let EMAIL_REGEX /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;\nfn normalize (email) lower email | trim;";
      const tokens = tokenize(source);

      // Verify key tokens exist
      expect(tokens.find(t => t.type === TokenType.LET)).toBeDefined();
      expect(tokens.find(t => t.value === "EMAIL_REGEX")).toBeDefined();
      expect(tokens.find(t => t.type === TokenType.REGEX)).toBeDefined();
      expect(tokens.find(t => t.type === TokenType.FN)).toBeDefined();
      expect(tokens.find(t => t.value === "normalize")).toBeDefined();
    });
  });

  describe("Position tracking", () => {
    test("tracks line numbers", () => {
      const tokens = tokenize("foo\nbar\nbaz");
      expect(tokens[0]?.line).toBe(1);
      expect(tokens[1]?.line).toBe(2);
      expect(tokens[2]?.line).toBe(3);
    });

    test("tracks column numbers", () => {
      const tokens = tokenize("foo bar");
      expect(tokens[0]?.column).toBe(1);
      expect(tokens[1]?.column).toBe(5);
    });

    test("resets column on newline", () => {
      const tokens = tokenize("foo\nbar");
      expect(tokens[1]?.line).toBe(2);
      expect(tokens[1]?.column).toBe(1);
    });
  });

  describe("Whitespace handling", () => {
    test("skips spaces", () => {
      const tokens = tokenize("   42   ");
      expect(tokens).toHaveLength(2); // number + EOF
    });

    test("skips tabs", () => {
      const tokens = tokenize("\t\t42\t\t");
      expect(tokens).toHaveLength(2);
    });

    test("skips newlines", () => {
      const tokens = tokenize("\n\n42\n\n");
      expect(tokens).toHaveLength(2);
    });

    test("handles mixed whitespace", () => {
      const tokens = tokenize(" \t\n 42 \n\t ");
      expect(tokens).toHaveLength(2);
    });
  });

  describe("Error handling", () => {
    test("provides line and column in error", () => {
      try {
        tokenize("foo\nbar\n=");
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(LexerError);
        if (error instanceof LexerError) {
          expect(error.line).toBe(3);
          expect(error.column).toBe(1);
          expect(error.message).toContain("line 3");
          expect(error.message).toContain("column 1");
        }
      }
    });

    test("handles unexpected characters", () => {
      expect(() => tokenize("@")).toThrow(LexerError);
      expect(() => tokenize("#")).toThrow(LexerError);
      expect(() => tokenize("&")).toThrow(LexerError);
    });
  });

  describe("EOF token", () => {
    test("always ends with EOF", () => {
      const tokens = tokenize("42");
      expect(tokens[tokens.length - 1]?.type).toBe(TokenType.EOF);
    });

    test("EOF for empty input", () => {
      const tokens = tokenize("");
      expect(tokens).toHaveLength(1);
      expect(tokens[0]?.type).toBe(TokenType.EOF);
    });

    test("EOF for whitespace only", () => {
      const tokens = tokenize("   \n\t  ");
      expect(tokens).toHaveLength(1);
      expect(tokens[0]?.type).toBe(TokenType.EOF);
    });
  });
});
