import { describe, test, expect } from "bun:test";
import { tokenize } from "./lexer.ts";
import { parse, ParseError } from "./parser.ts";
import * as AST from "./ast.ts";

// Helper to parse source code
const parseSource = (source: string) => parse(tokenize(source));

// Helper to parse with shell mode
// Uses shellMode by default for backward compatibility with existing tests
const parseWithShellMode = (source: string) => {
  const tokens = tokenize(source);
  const ast = parse(tokens, { shellMode: true });
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
      // Effects with arguments are now implicit calls (Lists)
      expect(ast.expressions[0]?.type).toBe("List");
      const list = ast.expressions[0] as AST.List;
      expect(list.elements).toHaveLength(3);
      const atom = list.elements[0] as AST.Atom;
      expect(atom.atomType).toBe("effect");
      // EFFECT_IDENT tokens have value without the colon
      expect(atom.value).toBe("let");
    });

    test("parses fn effect as expression", () => {
      const ast = parseSource("fn: double (x) (* x 2)");
      // Effects with arguments are now implicit calls (Lists)
      expect(ast.expressions[0]?.type).toBe("List");
      const list = ast.expressions[0] as AST.List;
      const atom = list.elements[0] as AST.Atom;
      expect(atom.atomType).toBe("effect");
      expect(atom.value).toBe("fn");
    });

    test("parses print effect as expression", () => {
      const ast = parseSource('print: "hello"');
      // Effects with arguments are now implicit calls (Lists)
      expect(ast.expressions[0]?.type).toBe("List");
      const list = ast.expressions[0] as AST.List;
      const atom = list.elements[0] as AST.Atom;
      expect(atom.atomType).toBe("effect");
      expect(atom.value).toBe("print");
    });

    test("parses debug effect as expression", () => {
      const ast = parseSource("debug: $$");
      // Effects with arguments are now implicit calls (Lists)
      expect(ast.expressions[0]?.type).toBe("List");
      const list = ast.expressions[0] as AST.List;
      const atom = list.elements[0] as AST.Atom;
      expect(atom.atomType).toBe("effect");
      expect(atom.value).toBe("debug");
    });

    test("parses assert effect as expression", () => {
      const ast = parseSource("assert: (> x 0)");
      // Effects with arguments are now implicit calls (Lists)
      expect(ast.expressions[0]?.type).toBe("List");
      const list = ast.expressions[0] as AST.List;
      const atom = list.elements[0] as AST.Atom;
      expect(atom.atomType).toBe("effect");
      expect(atom.value).toBe("assert");
    });

    test("parses custom effect as expression", () => {
      const ast = parseSource('custom_effect: arg1 "arg2" 123');
      // Effects with arguments are now implicit calls (Lists)
      expect(ast.expressions[0]?.type).toBe("List");
      const list = ast.expressions[0] as AST.List;
      const atom = list.elements[0] as AST.Atom;
      expect(atom.atomType).toBe("effect");
      expect(atom.value).toBe("custom_effect");
    });
  });

  describe("Pipelines", () => {
    test("parses simple pipeline", () => {
      const ast = parseWithShellMode("a | b");
      // a | b -> Pipeline([$$, List([a]), List([b])])
      expect(ast.expressions[0]?.type).toBe("Pipeline");
      const pipeline = ast.expressions[0] as AST.Pipeline;
      expect(pipeline.stages).toHaveLength(3); // $$, a, b
      expect(AST.isProgramInput(pipeline.stages[0] as AST.Atom)).toBe(true);
    });

    test("parses multi-stage pipeline", () => {
      const ast = parseWithShellMode("a | b | c");
      // a | b | c -> Pipeline([$$, a, b, c])
      expect(ast.expressions[0]?.type).toBe("Pipeline");
      const pipeline = ast.expressions[0] as AST.Pipeline;
      expect(pipeline.stages).toHaveLength(4); // $$, a, b, c
      expect(AST.isProgramInput(pipeline.stages[0] as AST.Atom)).toBe(true);
    });

    test("parses pipeline with explicit call", () => {
      const ast = parseWithShellMode('a | split " "');
      // a | split " " -> Pipeline([$$, List([a]), List([split, " "])])
      expect(ast.expressions[0]?.type).toBe("Pipeline");
      const pipeline = ast.expressions[0] as AST.Pipeline;
      expect(pipeline.stages).toHaveLength(3); // $$, a, split " "
      expect(AST.isProgramInput(pipeline.stages[0] as AST.Atom)).toBe(true);
      // Last stage should be a List with split and arg
      expect(pipeline.stages[2]?.type).toBe("List");
      const splitCall = pipeline.stages[2] as AST.List;
      expect((splitCall.elements[0] as AST.Atom).value).toBe("split");
    });

    test("auto-injects $$ for bare identifier in shell mode", () => {
      const ast = parseWithShellMode("lower");
      // lower -> Pipeline([$$, List([lower])])
      expect(ast.expressions[0]?.type).toBe("Pipeline");
      const pipeline = ast.expressions[0] as AST.Pipeline;
      expect(pipeline.stages).toHaveLength(2); // $$, lower
      expect(AST.isProgramInput(pipeline.stages[0] as AST.Atom)).toBe(true);
      const lowerCall = pipeline.stages[1] as AST.List;
      expect((lowerCall.elements[0] as AST.Atom).value).toBe("lower");
    });

    test("auto-injects $$ for call without source ref", () => {
      const ast = parseWithShellMode('split " "');
      // split " " -> Pipeline([$$, List([split, " "])])
      expect(ast.expressions[0]?.type).toBe("Pipeline");
      const pipeline = ast.expressions[0] as AST.Pipeline;
      expect(pipeline.stages).toHaveLength(2); // $$, split " "
      expect(AST.isProgramInput(pipeline.stages[0] as AST.Atom)).toBe(true);
    });

    test("does not inject $$ when $ present", () => {
      const ast = parseWithShellMode("(lower $)");
      const list = ast.expressions[0] as AST.List;
      expect(list.elements).toHaveLength(2);
      expect(AST.isPipelineRef(list.elements[1] as AST.Atom)).toBe(true);
    });

    test("does not inject $$ when $$ present", () => {
      const ast = parseWithShellMode("(lower $$)");
      const list = ast.expressions[0] as AST.List;
      expect(list.elements).toHaveLength(2);
      expect(AST.isProgramInput(list.elements[1] as AST.Atom)).toBe(true);
    });

    test("does not inject $$ when $0 present", () => {
      const ast = parseWithShellMode('join $0 " " $1');
      const list = ast.expressions[0] as AST.List;
      // Should have exactly 4 elements: join, $0, " ", $1
      expect(list.elements).toHaveLength(4);
    });

    test("parses pipeline inside parentheses", () => {
      const ast = parseSource("(a | b | c)");
      // Inside parens: Pipeline([a, b, c])
      expect(ast.expressions[0]?.type).toBe("Pipeline");
      const pipeline = ast.expressions[0] as AST.Pipeline;
      expect(pipeline.stages).toHaveLength(3);
    });
  });

  describe("Complex expressions", () => {
    test("parses email normalization pipeline", () => {
      const ast = parseWithShellMode("email | lower | trim");
      // email | lower | trim -> Pipeline([$$, email, lower, trim])
      expect(ast.expressions[0]?.type).toBe("Pipeline");
      const pipeline = ast.expressions[0] as AST.Pipeline;
      expect(pipeline.stages).toHaveLength(4); // $$, email, lower, trim
    });

    test("parses conditional with comparison", () => {
      const ast = parseWithShellMode('if (> $$ 100) "long" "short"');
      const list = ast.expressions[0] as AST.List;
      expect((list.elements[0] as AST.Atom).value).toBe("if");
      const cond = list.elements[1] as AST.List;
      expect((cond.elements[0] as AST.Atom).value).toBe(">");
    });

    test("parses array element access", () => {
      const ast = parseWithShellMode('join $0 " " $1');
      const list = ast.expressions[0] as AST.List;
      expect(list.elements).toHaveLength(4);
      expect(AST.getArrayIndex(list.elements[1] as AST.Atom)).toBe(0);
      expect(AST.getArrayIndex(list.elements[3] as AST.Atom)).toBe(1);
    });

    test("parses complex real-world example", () => {
      const source = "let: EMAIL_REGEX /abc/ fn: normalize (email) (email | lower | trim) fn: is_valid (email) (!= (match email EMAIL_REGEX) null) (normalize $$)";
      const ast = parseWithShellMode(source);
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

  describe("AST Type Guards", () => {
    test("isEffect identifies effect atoms", () => {
      const ast = parseSource("let: x 10");
      // Effects with args are now Lists, so get the first element
      const list = ast.expressions[0] as AST.List;
      const atom = list.elements[0] as AST.Atom;
      expect(AST.isEffect(atom)).toBe(true);
      expect(AST.isIdentifier(atom)).toBe(false);
      expect(AST.isLiteral(atom)).toBe(false);
    });

    test("isEffect returns false for identifiers", () => {
      const ast = parseSource("foo");
      const atom = ast.expressions[0] as AST.Atom;
      expect(AST.isEffect(atom)).toBe(false);
      expect(AST.isIdentifier(atom)).toBe(true);
    });

    test("isEffect returns false for literals", () => {
      const ast = parseSource("42");
      const atom = ast.expressions[0] as AST.Atom;
      expect(AST.isEffect(atom)).toBe(false);
      expect(AST.isLiteral(atom)).toBe(true);
    });

    test("isLiteral excludes effects", () => {
      const effectAst = parseSource("print: x");
      // Effects with args are now Lists, so get the first element
      const list = effectAst.expressions[0] as AST.List;
      const effectAtom = list.elements[0] as AST.Atom;
      expect(AST.isLiteral(effectAtom)).toBe(false);
    });

    test("isLiteral includes numbers, strings, booleans, null, regex", () => {
      expect(AST.isLiteral(AST.atom("number", 42))).toBe(true);
      expect(AST.isLiteral(AST.atom("string", "hello"))).toBe(true);
      expect(AST.isLiteral(AST.atom("boolean", true))).toBe(true);
      expect(AST.isLiteral(AST.atom("null", null))).toBe(true);
      expect(AST.isLiteral(AST.atom("regex", /test/))).toBe(true);
    });

    test("isLiteral excludes identifiers and effects", () => {
      expect(AST.isLiteral(AST.atom("identifier", "foo"))).toBe(false);
      expect(AST.isLiteral(AST.atom("effect", "let"))).toBe(false);
    });
  });

  describe("Edge cases", () => {
    test("parses empty program", () => {
      const ast = parseSource("");
      expect(ast.expressions).toHaveLength(0);
    });

    test("parses program with just an effect", () => {
      const ast = parseSource("let: x 10");
      // Effects with arguments are implicit calls (Lists)
      expect(ast.expressions[0]?.type).toBe("List");
      const list = ast.expressions[0] as AST.List;
      // EFFECT_IDENT value is without the colon
      expect((list.elements[0] as AST.Atom).value).toBe("let");
    });

    test("parses empty list", () => {
      const ast = parseSource("()");
      expect(ast.expressions[0]?.type).toBe("List");
      const list = ast.expressions[0] as AST.List;
      expect(list.elements).toHaveLength(0);
    });

    test("parses multiple top-level expressions with semicolons", () => {
      const ast = parseWithShellMode("let: x 10; let: y 20; (+ x y)");
      expect(ast.expressions).toHaveLength(3);

      // First expression: (let: x 10)
      expect(ast.expressions[0]?.type).toBe("List");
      const first = ast.expressions[0] as AST.List;
      expect((first.elements[0] as AST.Atom).value).toBe("let");

      // Second expression: (let: y 20)
      expect(ast.expressions[1]?.type).toBe("List");
      const second = ast.expressions[1] as AST.List;
      expect((second.elements[0] as AST.Atom).value).toBe("let");

      // Third expression: In shell mode, (+ x y) becomes Pipeline([$$, (+ x y)])
      // since it doesn't contain source refs
      expect(ast.expressions[2]?.type).toBe("Pipeline");
      const pipeline = ast.expressions[2] as AST.Pipeline;
      expect(pipeline.stages).toHaveLength(2);
      const third = pipeline.stages[1] as AST.List;
      expect((third.elements[0] as AST.Atom).value).toBe("+");
    });
  });
});
