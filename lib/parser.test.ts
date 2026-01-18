import { describe, test, expect } from "bun:test";
import { tokenize } from "./lexer.ts";
import { parse, ParseError } from "./parser.ts";
import { normalizeTokens } from "./tokenNormalizer.ts";
import * as AST from "./ast.ts";

// Helper to parse source code
const parseSource = (source: string) => parse(tokenize(source));

// Helper to get normalized and parsed expression
// Order: tokenize -> normalize tokens -> parse
const parseAndNormalize = (source: string) => {
  const tokens = tokenize(source);
  const normalizedTokens = normalizeTokens(tokens);
  const ast = parse(normalizedTokens);
  return ast;
};

describe("Parser", () => {
  describe("Literals", () => {
    test("parses number literal", () => {
      const ast = parseSource("42");
      expect(ast.expressions[0]?.type).toBe("Atom");
      const atom = ast.expressions[0] as AST.Atom;
      expect(atom.atomType).toBe("number");
      expect(atom.value).toBe(42);
    });

    test("parses negative number", () => {
      const ast = parseSource("-3.14");
      const atom = ast.expressions[0] as AST.Atom;
      expect(atom.atomType).toBe("number");
      expect(atom.value).toBe(-3.14);
    });

    test("parses string literal", () => {
      const ast = parseSource('"hello"');
      const atom = ast.expressions[0] as AST.Atom;
      expect(atom.atomType).toBe("string");
      expect(atom.value).toBe("hello");
    });

    test("parses single-quoted string", () => {
      const ast = parseSource("'world'");
      const atom = ast.expressions[0] as AST.Atom;
      expect(atom.atomType).toBe("string");
      expect(atom.value).toBe("world");
    });

    test("parses regex literal", () => {
      const ast = parseSource("/\\d+/g");
      const atom = ast.expressions[0] as AST.Atom;
      expect(atom.atomType).toBe("regex");
      expect(atom.value).toBeInstanceOf(RegExp);
      const regex = atom.value as RegExp;
      expect(regex.source).toBe("\\d+");
      expect(regex.flags).toBe("g");
    });

    test("parses boolean true", () => {
      const ast = parseSource("true");
      const atom = ast.expressions[0] as AST.Atom;
      expect(atom.atomType).toBe("boolean");
      expect(atom.value).toBe(true);
    });

    test("parses boolean false", () => {
      const ast = parseSource("false");
      const atom = ast.expressions[0] as AST.Atom;
      expect(atom.atomType).toBe("boolean");
      expect(atom.value).toBe(false);
    });

    test("parses null literal", () => {
      const ast = parseSource("null");
      const atom = ast.expressions[0] as AST.Atom;
      expect(atom.atomType).toBe("null");
      expect(atom.value).toBe(null);
    });
  });

  describe("Identifiers", () => {
    test("parses simple identifier", () => {
      const ast = parseSource("foo");
      const atom = ast.expressions[0] as AST.Atom;
      expect(atom.atomType).toBe("identifier");
      expect(atom.value).toBe("foo");
    });

    test("parses identifier with underscore", () => {
      const ast = parseSource("foo_bar");
      const atom = ast.expressions[0] as AST.Atom;
      expect(atom.value).toBe("foo_bar");
    });

    test("parses $ as pipeline ref", () => {
      const ast = parseSource("$");
      const atom = ast.expressions[0] as AST.Atom;
      expect(atom.value).toBe("$");
      expect(AST.isPipelineRef(atom)).toBe(true);
      expect(AST.isSourceRef(atom)).toBe(true);
    });

    test("parses $$ as program input", () => {
      const ast = parseSource("$$");
      const atom = ast.expressions[0] as AST.Atom;
      expect(atom.value).toBe("$$");
      expect(AST.isProgramInput(atom)).toBe(true);
      expect(AST.isSourceRef(atom)).toBe(true);
    });

    test("parses $0 as array ref", () => {
      const ast = parseSource("$0");
      const atom = ast.expressions[0] as AST.Atom;
      expect(atom.value).toBe("$0");
      expect(AST.isArrayRef(atom)).toBe(true);
      expect(AST.getArrayIndex(atom)).toBe(0);
    });

    test("parses $1, $2 as array refs", () => {
      const ast1 = parseSource("$1");
      const ast2 = parseSource("$2");
      expect(AST.getArrayIndex(ast1.expressions[0] as AST.Atom)).toBe(1);
      expect(AST.getArrayIndex(ast2.expressions[0] as AST.Atom)).toBe(2);
    });
  });

  describe("Lists (Calls)", () => {
    test("parses simple call with one arg", () => {
      const ast = parseSource("(lower email)");
      expect(ast.expressions[0]?.type).toBe("List");
      const list = ast.expressions[0] as AST.List;
      expect(list.elements).toHaveLength(2);
      expect((list.elements[0] as AST.Atom).value).toBe("lower");
      expect((list.elements[1] as AST.Atom).value).toBe("email");
    });

    test("parses call with multiple args", () => {
      const ast = parseSource('(split email " ")');
      const list = ast.expressions[0] as AST.List;
      expect(list.elements).toHaveLength(3);
      expect((list.elements[0] as AST.Atom).value).toBe("split");
    });

    test("parses call with numeric arg", () => {
      const ast = parseSource("(get arr 0)");
      const list = ast.expressions[0] as AST.List;
      expect(list.elements).toHaveLength(3);
      expect((list.elements[2] as AST.Atom).value).toBe(0);
    });

    test("parses operator as function", () => {
      const ast = parseSource("(* x 2)");
      const list = ast.expressions[0] as AST.List;
      expect((list.elements[0] as AST.Atom).value).toBe("*");
      expect(list.elements).toHaveLength(3);
    });

    test("parses + operator", () => {
      const ast = parseSource("(+ 1 2 3)");
      const list = ast.expressions[0] as AST.List;
      expect((list.elements[0] as AST.Atom).value).toBe("+");
      expect(list.elements).toHaveLength(4);
    });

    test("parses comparison operator", () => {
      const ast = parseSource("(> x 10)");
      const list = ast.expressions[0] as AST.List;
      expect((list.elements[0] as AST.Atom).value).toBe(">");
    });

    test("parses nested list as argument", () => {
      const ast = parseSource("(foo (bar baz))");
      const list = ast.expressions[0] as AST.List;
      expect(list.elements[1]?.type).toBe("List");
      const nested = list.elements[1] as AST.List;
      expect((nested.elements[0] as AST.Atom).value).toBe("bar");
    });

    test("parses and/or/not as operators", () => {
      const ast1 = parseSource("(and a b)");
      const ast2 = parseSource("(or a b)");
      const ast3 = parseSource("(not a)");
      expect(((ast1.expressions[0] as AST.List).elements[0] as AST.Atom).value).toBe("and");
      expect(((ast2.expressions[0] as AST.List).elements[0] as AST.Atom).value).toBe("or");
      expect(((ast3.expressions[0] as AST.List).elements[0] as AST.Atom).value).toBe("not");
    });

    test("parses ?? nullish operator", () => {
      const ast = parseSource('(?? value "default")');
      const list = ast.expressions[0] as AST.List;
      expect((list.elements[0] as AST.Atom).value).toBe("??");
      expect(list.elements).toHaveLength(3);
    });
  });

  describe("If expressions", () => {
    test("parses basic if", () => {
      const ast = parseSource('(if true "yes" "no")');
      expect(ast.expressions[0]?.type).toBe("List");
      const list = ast.expressions[0] as AST.List;
      expect((list.elements[0] as AST.Atom).value).toBe("if");
      expect((list.elements[1] as AST.Atom).value).toBe(true);
      expect((list.elements[2] as AST.Atom).value).toBe("yes");
      expect((list.elements[3] as AST.Atom).value).toBe("no");
    });

    test("parses if with nested condition", () => {
      const ast = parseSource('(if (> x 10) "big" "small")');
      const list = ast.expressions[0] as AST.List;
      expect((list.elements[0] as AST.Atom).value).toBe("if");
      expect(list.elements[1]?.type).toBe("List");
      const condition = list.elements[1] as AST.List;
      expect((condition.elements[0] as AST.Atom).value).toBe(">");
    });

    test("parses if with identifier results", () => {
      const ast = parseSource("(if cond a b)");
      const list = ast.expressions[0] as AST.List;
      expect((list.elements[0] as AST.Atom).value).toBe("if");
      expect((list.elements[2] as AST.Atom).value).toBe("a");
      expect((list.elements[3] as AST.Atom).value).toBe("b");
    });
  });

  describe("Nested lists", () => {
    test("parses single element list", () => {
      const ast = parseSource("(foo)");
      expect(ast.expressions[0]?.type).toBe("List");
      const list = ast.expressions[0] as AST.List;
      expect(list.elements).toHaveLength(1);
      expect((list.elements[0] as AST.Atom).value).toBe("foo");
    });

    test("parses nested lists", () => {
      const ast = parseSource("((foo))");
      const outer = ast.expressions[0] as AST.List;
      expect(outer.elements).toHaveLength(1);
      expect(outer.elements[0]?.type).toBe("List");
      const inner = outer.elements[0] as AST.List;
      expect((inner.elements[0] as AST.Atom).value).toBe("foo");
    });

    test("parses deeply nested lists", () => {
      const ast = parseSource("(((foo)))");
      let expr: AST.SExpr | null | undefined = ast.expressions[0];
      for (let i = 0; i < 3; i++) {
        expect(expr?.type).toBe("List");
        expr = (expr as AST.List).elements[0];
      }
      expect((expr as AST.Atom).value).toBe("foo");
    });
  });

  describe("Effects (as expressions)", () => {
    test("parses let effect as expression", () => {
      const ast = parseSource("let: x 10");
      expect(ast.expressions[0]?.type).toBe("Atom");
      // EFFECT_IDENT tokens have value without the colon
      expect((ast.expressions[0] as AST.Atom).value).toBe("let");
    });

    test("parses fn effect as expression", () => {
      const ast = parseSource("fn: double (x) (* x 2)");
      expect(ast.expressions[0]?.type).toBe("Atom");
      expect((ast.expressions[0] as AST.Atom).value).toBe("fn");
    });

    test("parses print effect as expression", () => {
      const ast = parseSource('print: "hello"');
      expect(ast.expressions[0]?.type).toBe("Atom");
      expect((ast.expressions[0] as AST.Atom).value).toBe("print");
    });

    test("parses debug effect as expression", () => {
      const ast = parseSource("debug: $$");
      expect(ast.expressions[0]?.type).toBe("Atom");
      expect((ast.expressions[0] as AST.Atom).value).toBe("debug");
    });

    test("parses assert effect as expression", () => {
      const ast = parseSource("assert: (> x 0)");
      expect(ast.expressions[0]?.type).toBe("Atom");
      expect((ast.expressions[0] as AST.Atom).value).toBe("assert");
    });

    test("parses custom effect as expression", () => {
      const ast = parseSource('custom_effect: arg1 "arg2" 123');
      expect(ast.expressions[0]?.type).toBe("Atom");
      expect((ast.expressions[0] as AST.Atom).value).toBe("custom_effect");
    });
  });

  describe("Normalization", () => {
    test("normalizes simple pipeline to nested calls", () => {
      const ast = parseAndNormalize("a | b");
      // a | b -> (b a $$)
      expect(ast.expressions[0]?.type).toBe("List");
      const list = ast.expressions[0] as AST.List;
      expect((list.elements[0] as AST.Atom).value).toBe("b");
      expect(list.elements).toHaveLength(3);
      expect((list.elements[1] as AST.Atom).value).toBe("a");
      expect(AST.isProgramInput(list.elements[2] as AST.Atom)).toBe(true);
    });

    test("normalizes multi-stage pipeline", () => {
      const ast = parseAndNormalize("a | b | c");
      // a | b | c -> (c b a $$)
      const list = ast.expressions[0] as AST.List;
      expect((list.elements[0] as AST.Atom).value).toBe("c");
      expect(list.elements).toHaveLength(4);
      expect((list.elements[1] as AST.Atom).value).toBe("b");
      expect((list.elements[2] as AST.Atom).value).toBe("a");
      expect(AST.isProgramInput(list.elements[3] as AST.Atom)).toBe(true);
    });

    test("normalizes pipeline with call stage", () => {
      const ast = parseAndNormalize('a | split " "');
      // a | split " " -> (split a $$ " ")
      const list = ast.expressions[0] as AST.List;
      expect((list.elements[0] as AST.Atom).value).toBe("split");
      expect(list.elements).toHaveLength(4);
      expect((list.elements[1] as AST.Atom).value).toBe("a");
      expect(AST.isProgramInput(list.elements[2] as AST.Atom)).toBe(true);
      expect((list.elements[3] as AST.Atom).value).toBe(" ");
    });

    test("auto-injects $$ for bare identifier", () => {
      const ast = parseAndNormalize("lower");
      // lower -> (lower $$)
      expect(ast.expressions[0]?.type).toBe("List");
      const list = ast.expressions[0] as AST.List;
      expect((list.elements[0] as AST.Atom).value).toBe("lower");
      expect(list.elements).toHaveLength(2);
      expect(AST.isProgramInput(list.elements[1] as AST.Atom)).toBe(true);
    });

    test("auto-injects $$ for call without source ref", () => {
      const ast = parseAndNormalize('split " "');
      // split " " -> (split $$ " ")
      const list = ast.expressions[0] as AST.List;
      expect(list.elements).toHaveLength(3);
      expect((list.elements[0] as AST.Atom).value).toBe("split");
      expect(AST.isProgramInput(list.elements[1] as AST.Atom)).toBe(true);
      expect((list.elements[2] as AST.Atom).value).toBe(" ");
    });

    test("does not inject $$ when $ present", () => {
      const ast = parseAndNormalize("(lower $)");
      const list = ast.expressions[0] as AST.List;
      expect(list.elements).toHaveLength(2);
      expect(AST.isPipelineRef(list.elements[1] as AST.Atom)).toBe(true);
    });

    test("does not inject $$ when $$ present", () => {
      const ast = parseAndNormalize("(lower $$)");
      const list = ast.expressions[0] as AST.List;
      expect(list.elements).toHaveLength(2);
      expect(AST.isProgramInput(list.elements[1] as AST.Atom)).toBe(true);
    });

    test("does not inject $$ when $0 present", () => {
      const ast = parseAndNormalize('join $0 " " $1');
      const list = ast.expressions[0] as AST.List;
      // Should have exactly 4 elements: join, $0, " ", $1
      expect(list.elements).toHaveLength(4);
    });

    test("normalizes pipeline in effect body", () => {
      const ast = parseAndNormalize("fn: normalize (email) (email | lower | trim)");
      // With effects as expressions, this parses as a List: (fn normalize (email) (trim lower email))
      expect(ast.expressions[0]?.type).toBe("List");
      const list = ast.expressions[0] as AST.List;
      // First element is fn (without colon in value)
      expect((list.elements[0] as AST.Atom).value).toBe("fn");
      // Body should be normalized (trim lower email)
      const body = list.elements[3] as AST.List;
      expect((body.elements[0] as AST.Atom).value).toBe("trim");
    });
  });

  describe("Complex expressions", () => {
    test("parses email normalization pipeline", () => {
      const ast = parseAndNormalize("email | lower | trim");
      // email | lower | trim normalizes to (trim lower email $$)
      const list = ast.expressions[0] as AST.List;
      expect(list.type).toBe("List");
      expect((list.elements[0] as AST.Atom).value).toBe("trim");
    });

    test("parses conditional with comparison", () => {
      const ast = parseAndNormalize('if (> $$ 100) "long" "short"');
      const list = ast.expressions[0] as AST.List;
      expect((list.elements[0] as AST.Atom).value).toBe("if");
      const cond = list.elements[1] as AST.List;
      expect((cond.elements[0] as AST.Atom).value).toBe(">");
    });

    test("parses array element access", () => {
      const ast = parseAndNormalize('join $0 " " $1');
      const list = ast.expressions[0] as AST.List;
      expect(list.elements).toHaveLength(4);
      expect(AST.getArrayIndex(list.elements[1] as AST.Atom)).toBe(0);
      expect(AST.getArrayIndex(list.elements[3] as AST.Atom)).toBe(1);
    });

    test("parses complex real-world example", () => {
      const source = "let: EMAIL_REGEX /abc/ fn: normalize (email) (email | lower | trim) fn: is_valid (email) (!= (match email EMAIL_REGEX) null) (normalize $$)";
      const ast = parseAndNormalize(source);
      // With effects as expressions, the entire source is one expression
      expect(ast.expressions[0]?.type).toBe("List");
    });
  });

  describe("Error handling", () => {
    test("throws on unexpected token", () => {
      expect(() => parseSource(")")).toThrow(ParseError);
    });

    test("throws on unclosed paren", () => {
      expect(() => parseSource("(foo")).toThrow(ParseError);
    });

    test("includes position in error", () => {
      try {
        parseSource("let: ");
      } catch (e) {
        expect(e).toBeInstanceOf(ParseError);
        expect((e as ParseError).line).toBe(1);
      }
    });
  });

  describe("Edge cases", () => {
    test("parses empty program", () => {
      const ast = parseSource("");
      expect(ast.expressions).toHaveLength(0);
    });

    test("parses program with just an effect", () => {
      const ast = parseSource("let: x 10");
      // Effect is just a regular expression now (an atom identifier)
      expect(ast.expressions[0]?.type).toBe("Atom");
      // EFFECT_IDENT value is without the colon
      expect((ast.expressions[0] as AST.Atom).value).toBe("let");
    });

    test("parses empty list", () => {
      const ast = parseSource("()");
      expect(ast.expressions[0]?.type).toBe("List");
      const list = ast.expressions[0] as AST.List;
      expect(list.elements).toHaveLength(0);
    });

    test("parses multiple top-level expressions with semicolons", () => {
      const ast = parseAndNormalize("let: x 10; let: y 20; (+ x y)");
      expect(ast.expressions).toHaveLength(3);

      // First expression: (let: x 10)
      expect(ast.expressions[0]?.type).toBe("List");
      const first = ast.expressions[0] as AST.List;
      expect((first.elements[0] as AST.Atom).value).toBe("let");

      // Second expression: (let: y 20)
      expect(ast.expressions[1]?.type).toBe("List");
      const second = ast.expressions[1] as AST.List;
      expect((second.elements[0] as AST.Atom).value).toBe("let");

      // Third expression: (+ x y)
      expect(ast.expressions[2]?.type).toBe("List");
      const third = ast.expressions[2] as AST.List;
      expect((third.elements[0] as AST.Atom).value).toBe("+");
    });
  });
});
