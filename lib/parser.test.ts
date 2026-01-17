import { describe, test, expect } from "bun:test";
import { tokenize } from "./lexer.ts";
import { parse, ParseError } from "./parser.ts";
import { normalizeTokens } from "./tokenNormalizer.ts";
import type * as AST from "./ast.ts";

// Helper to parse source code
const parseSource = (source: string) => parse(tokenize(source));

// Helper to get normalized and parsed expression
// Order: tokenize -> normalize tokens -> parse
const parseAndNormalize = (source: string) => {
  const tokens = tokenize(source);
  const normalizedTokens = normalizeTokens(tokens);
  const ast = parse(normalizedTokens);

  // Unwrap top-level GroupExpression added by token normalizer
  if (ast.expression && ast.expression.type === "GroupExpression") {
    return {
      ...ast,
      expression: ast.expression.expression,
    };
  }

  return ast;
};

describe("Parser", () => {
  describe("Literals", () => {
    test("parses number literal", () => {
      const ast = parseSource("42");
      expect(ast.expression?.type).toBe("NumberLiteral");
      expect((ast.expression as AST.NumberLiteral).value).toBe(42);
    });

    test("parses negative number", () => {
      const ast = parseSource("-3.14");
      expect(ast.expression?.type).toBe("NumberLiteral");
      expect((ast.expression as AST.NumberLiteral).value).toBe(-3.14);
    });

    test("parses string literal", () => {
      const ast = parseSource('"hello"');
      expect(ast.expression?.type).toBe("StringLiteral");
      expect((ast.expression as AST.StringLiteral).value).toBe("hello");
    });

    test("parses single-quoted string", () => {
      const ast = parseSource("'world'");
      expect(ast.expression?.type).toBe("StringLiteral");
      expect((ast.expression as AST.StringLiteral).value).toBe("world");
    });

    test("parses regex literal", () => {
      const ast = parseSource("/\\d+/g");
      expect(ast.expression?.type).toBe("RegexLiteral");
      const regex = ast.expression as AST.RegexLiteral;
      expect(regex.pattern).toBe("\\d+");
      expect(regex.flags).toBe("g");
    });

    test("parses boolean true", () => {
      const ast = parseSource("true");
      expect(ast.expression?.type).toBe("BooleanLiteral");
      expect((ast.expression as AST.BooleanLiteral).value).toBe(true);
    });

    test("parses boolean false", () => {
      const ast = parseSource("false");
      expect(ast.expression?.type).toBe("BooleanLiteral");
      expect((ast.expression as AST.BooleanLiteral).value).toBe(false);
    });

    test("parses null literal", () => {
      const ast = parseSource("null");
      expect(ast.expression?.type).toBe("NullLiteral");
    });
  });

  describe("Identifiers", () => {
    test("parses simple identifier", () => {
      const ast = parseSource("foo");
      expect(ast.expression?.type).toBe("Identifier");
      expect((ast.expression as AST.Identifier).name).toBe("foo");
    });

    test("parses identifier with underscore", () => {
      const ast = parseSource("foo_bar");
      expect(ast.expression?.type).toBe("Identifier");
      expect((ast.expression as AST.Identifier).name).toBe("foo_bar");
    });

    test("parses $ as pipeline ref", () => {
      const ast = parseSource("$");
      const id = ast.expression as AST.Identifier;
      expect(id.name).toBe("$");
      expect(id.isPipelineRef).toBe(true);
      expect(id.isSourceRef).toBe(true);
    });

    test("parses $$ as program input", () => {
      const ast = parseSource("$$");
      const id = ast.expression as AST.Identifier;
      expect(id.name).toBe("$$");
      expect(id.isProgramInput).toBe(true);
      expect(id.isSourceRef).toBe(true);
    });

    test("parses $0 as array ref", () => {
      const ast = parseSource("$0");
      const id = ast.expression as AST.Identifier;
      expect(id.name).toBe("$0");
      expect(id.arrayIndex).toBe(0);
      expect(id.isSourceRef).toBe(true);
    });

    test("parses $1, $2 as array refs", () => {
      const ast1 = parseSource("$1");
      const ast2 = parseSource("$2");
      expect((ast1.expression as AST.Identifier).arrayIndex).toBe(1);
      expect((ast2.expression as AST.Identifier).arrayIndex).toBe(2);
    });
  });

  describe("Calls", () => {
    test("parses simple call with one arg", () => {
      const ast = parseSource("lower email");
      expect(ast.expression?.type).toBe("CallExpression");
      const call = ast.expression as AST.CallExpression;
      expect(call.callee.name).toBe("lower");
      expect(call.arguments).toHaveLength(1);
      expect((call.arguments[0] as AST.Identifier).name).toBe("email");
    });

    test("parses call with multiple args", () => {
      const ast = parseSource('split email " "');
      const call = ast.expression as AST.CallExpression;
      expect(call.callee.name).toBe("split");
      expect(call.arguments).toHaveLength(2);
    });

    test("parses call with numeric arg", () => {
      const ast = parseSource("get arr 0");
      const call = ast.expression as AST.CallExpression;
      expect(call.arguments).toHaveLength(2);
      expect((call.arguments[1] as AST.NumberLiteral).value).toBe(0);
    });

    test("parses operator as function", () => {
      const ast = parseSource("* x 2");
      const call = ast.expression as AST.CallExpression;
      expect(call.callee.name).toBe("*");
      expect(call.arguments).toHaveLength(2);
    });

    test("parses + operator", () => {
      const ast = parseSource("+ 1 2 3");
      const call = ast.expression as AST.CallExpression;
      expect(call.callee.name).toBe("+");
      expect(call.arguments).toHaveLength(3);
    });

    test("parses comparison operator", () => {
      const ast = parseSource("> x 10");
      const call = ast.expression as AST.CallExpression;
      expect(call.callee.name).toBe(">");
    });

    test("parses grouped argument", () => {
      const ast = parseSource("foo (bar baz)");
      const call = ast.expression as AST.CallExpression;
      expect(call.arguments[0]?.type).toBe("GroupExpression");
      const group = call.arguments[0] as AST.GroupExpression;
      expect(group.expression.type).toBe("CallExpression");
    });

    test("parses and/or/not as operators", () => {
      const ast1 = parseSource("and a b");
      const ast2 = parseSource("or a b");
      const ast3 = parseSource("not a");
      expect((ast1.expression as AST.CallExpression).callee.name).toBe("and");
      expect((ast2.expression as AST.CallExpression).callee.name).toBe("or");
      expect((ast3.expression as AST.CallExpression).callee.name).toBe("not");
    });

    test("parses ?? nullish operator", () => {
      const ast = parseSource('?? value "default"');
      const call = ast.expression as AST.CallExpression;
      expect(call.callee.name).toBe("??");
      expect(call.arguments).toHaveLength(2);
    });
  });

  describe("If expressions", () => {
    test("parses basic if", () => {
      const ast = parseSource('if true "yes" "no"');
      expect(ast.expression?.type).toBe("IfExpression");
      const ifExpr = ast.expression as AST.IfExpression;
      expect(ifExpr.condition.type).toBe("BooleanLiteral");
      expect((ifExpr.consequent as AST.StringLiteral).value).toBe("yes");
      expect((ifExpr.alternate as AST.StringLiteral).value).toBe("no");
    });

    test("parses if with grouped condition", () => {
      const ast = parseSource('if (> x 10) "big" "small"');
      const ifExpr = ast.expression as AST.IfExpression;
      expect(ifExpr.condition.type).toBe("GroupExpression");
    });

    test("parses if with identifier results", () => {
      const ast = parseSource("if cond a b");
      const ifExpr = ast.expression as AST.IfExpression;
      expect(ifExpr.consequent.type).toBe("Identifier");
      expect(ifExpr.alternate.type).toBe("Identifier");
    });
  });

  describe("Grouped expressions", () => {
    test("parses grouped identifier", () => {
      const ast = parseSource("(foo)");
      expect(ast.expression?.type).toBe("GroupExpression");
      const group = ast.expression as AST.GroupExpression;
      expect(group.expression.type).toBe("Identifier");
    });

    test("parses nested groups", () => {
      const ast = parseSource("((foo))");
      const outer = ast.expression as AST.GroupExpression;
      expect(outer.expression.type).toBe("GroupExpression");
    });

    test("parses grouped call", () => {
      const ast = parseSource("(lower email)");
      const group = ast.expression as AST.GroupExpression;
      expect(group.expression.type).toBe("CallExpression");
    });

    test("parses grouped pipeline", () => {
      const ast = parseAndNormalize("(a | b)");
      // (a | b) normalizes to (b a) - explicit parens prevent $$-injection
      // Redundant double parens are simplified away
      const call = ast.expression as AST.CallExpression;
      expect(call.type).toBe("CallExpression");
      expect(call.callee.name).toBe("b");
      // Has 1 argument: a (no $$ injection due to explicit parens)
      expect(call.arguments).toHaveLength(1);
      expect((call.arguments[0] as AST.Identifier).name).toBe("a");
    });
  });

  describe("Effects (Generic Statements)", () => {
    test("parses let effect", () => {
      const ast = parseSource("let: x 10");
      expect(ast.statements).toHaveLength(1);
      const effect = ast.statements[0] as AST.EffectStatement;
      expect(effect.type).toBe("EffectStatement");
      expect(effect.name).toBe("let");
      expect(effect.arguments).toHaveLength(2);
      expect((effect.arguments[0] as AST.Identifier).name).toBe("x");
      expect((effect.arguments[1] as AST.NumberLiteral).value).toBe(10);
    });

    test("parses let with expression value", () => {
      const ast = parseSource("let: doubled (* x 2)");
      const effect = ast.statements[0] as AST.EffectStatement;
      expect(effect.arguments[1]?.type).toBe("GroupExpression");
    });

    test("parses fn effect", () => {
      // Function body must be grouped to avoid ambiguity with operators
      const ast = parseSource("fn: double (x) (* x 2)");
      expect(ast.statements).toHaveLength(1);
      const effect = ast.statements[0] as AST.EffectStatement;
      expect(effect.type).toBe("EffectStatement");
      expect(effect.name).toBe("fn");
      // Arguments: name, params group, body group
      expect(effect.arguments).toHaveLength(3);
      expect((effect.arguments[0] as AST.Identifier).name).toBe("double");
    });

    test("parses fn with multiple params", () => {
      const ast = parseSource("fn: add (x y) (+ x y)");
      const effect = ast.statements[0] as AST.EffectStatement;
      expect(effect.name).toBe("fn");
      expect(effect.arguments).toHaveLength(3);
    });

    test("parses fn with no params", () => {
      const ast = parseSource("fn: hello () 42");
      const effect = ast.statements[0] as AST.EffectStatement;
      expect(effect.name).toBe("fn");
      expect(effect.arguments.length).toBeGreaterThan(0);
    });

    test("parses print effect", () => {
      const ast = parseSource('print: "hello"');
      expect(ast.statements).toHaveLength(1);
      const effect = ast.statements[0] as AST.EffectStatement;
      expect(effect.type).toBe("EffectStatement");
      expect(effect.name).toBe("print");
      expect(effect.arguments).toHaveLength(1);
    });

    test("parses debug effect", () => {
      const ast = parseSource("debug: $$");
      expect(ast.statements).toHaveLength(1);
      const effect = ast.statements[0] as AST.EffectStatement;
      expect(effect.type).toBe("EffectStatement");
      expect(effect.name).toBe("debug");
    });

    test("parses assert effect", () => {
      const ast = parseSource("assert: (> x 0)");
      expect(ast.statements).toHaveLength(1);
      const effect = ast.statements[0] as AST.EffectStatement;
      expect(effect.type).toBe("EffectStatement");
      expect(effect.name).toBe("assert");
    });

    test("parses custom effect", () => {
      const ast = parseSource('custom_effect: arg1 "arg2" 123');
      expect(ast.statements).toHaveLength(1);
      const effect = ast.statements[0] as AST.EffectStatement;
      expect(effect.type).toBe("EffectStatement");
      expect(effect.name).toBe("custom_effect");
      expect(effect.arguments).toHaveLength(3);
    });

    test("parses multiple effects", () => {
      // Effects consume atoms until the next effect, so expression must come after
      const ast = parseSource("let: x 10 let: y 20");
      expect(ast.statements).toHaveLength(2);
      expect((ast.statements[0] as AST.EffectStatement).arguments).toHaveLength(2);
      expect((ast.statements[1] as AST.EffectStatement).arguments).toHaveLength(2);
    });

    test("parses effects followed by expression", () => {
      // Clear separation: effects then expression
      const ast = parseSource("let: TAX 0.08  let: x 10  + x TAX");
      expect(ast.statements).toHaveLength(2);
      expect(ast.expression?.type).toBe("CallExpression");
    });
  });

  describe("Complex expressions", () => {
    test("parses email normalization pipeline", () => {
      const ast = parseAndNormalize("email | lower | trim");
      // email | lower | trim normalizes to (trim (lower (email $$)))
      const outer = ast.expression as AST.CallExpression;
      expect(outer.type).toBe("CallExpression");
      expect(outer.callee.name).toBe("trim");
    });

    test("parses conditional with comparison", () => {
      const ast = parseSource('if (> $$ 100) "long" "short"');
      const ifExpr = ast.expression as AST.IfExpression;
      const cond = (ifExpr.condition as AST.GroupExpression).expression as AST.CallExpression;
      expect(cond.callee.name).toBe(">");
    });

    test("parses function with pipeline body", () => {
      const ast = parseAndNormalize("fn: normalize (email) (email | lower | trim)");
      const effect = ast.statements[0] as AST.EffectStatement;
      // The pipeline in the body should be normalized to (trim lower email) with no $$
      const body = effect.arguments[2] as AST.GroupExpression;
      // The pipeline is grouped: GroupExpression(CallExpression) - no double nesting
      const call = body.expression as AST.CallExpression;
      expect(call.callee.name).toBe("trim");
      // Explicit parens prevent $$-injection, so no $$ in arguments
      expect(call.arguments).toHaveLength(2);
      expect((call.arguments[0] as AST.Identifier).name).toBe("lower");
      expect((call.arguments[1] as AST.Identifier).name).toBe("email");
    });

    test("parses array element access", () => {
      const ast = parseSource('join $0 " " $1');
      const call = ast.expression as AST.CallExpression;
      expect(call.arguments).toHaveLength(3);
      expect((call.arguments[0] as AST.Identifier).arrayIndex).toBe(0);
      expect((call.arguments[2] as AST.Identifier).arrayIndex).toBe(1);
    });
  });

  describe("Normalization", () => {
    test("normalizes simple pipeline to nested calls", () => {
      const ast = parseAndNormalize("a | b");
      // a | b -> (b a $$) with minimal parens (flattened)
      expect(ast.expression?.type).toBe("CallExpression");
      const call = ast.expression as AST.CallExpression;
      expect(call.callee.name).toBe("b");
      // Now has 2 arguments: a and $$ (unwrapped/flattened)
      expect(call.arguments).toHaveLength(2);
      expect((call.arguments[0] as AST.Identifier).name).toBe("a");
      expect((call.arguments[1] as AST.Identifier).isProgramInput).toBe(true);
    });

    test("normalizes multi-stage pipeline", () => {
      const ast = parseAndNormalize("a | b | c");
      // a | b | c -> (c b a $$) with minimal parens (completely flattened)
      const call = ast.expression as AST.CallExpression;
      expect(call.callee.name).toBe("c");
      // Now has 3 arguments: b, a, and $$ (all flattened)
      expect(call.arguments).toHaveLength(3);
      expect((call.arguments[0] as AST.Identifier).name).toBe("b");
      expect((call.arguments[1] as AST.Identifier).name).toBe("a");
      expect((call.arguments[2] as AST.Identifier).isProgramInput).toBe(true);
    });

    test("normalizes pipeline with call stage", () => {
      const ast = parseAndNormalize('a | split " "');
      // a | split " " -> (split a $$ " ") with minimal parens
      const call = ast.expression as AST.CallExpression;
      expect(call.callee.name).toBe("split");
      // Now has 3 arguments: a, $$, and " " (all flattened)
      expect(call.arguments).toHaveLength(3);
      expect((call.arguments[0] as AST.Identifier).name).toBe("a");
      expect((call.arguments[1] as AST.Identifier).isProgramInput).toBe(true);
      expect((call.arguments[2] as AST.StringLiteral).value).toBe(" ");
    });

    test("auto-injects $$ for bare identifier", () => {
      const ast = parseAndNormalize("lower");
      // lower -> lower($$)
      expect(ast.expression?.type).toBe("CallExpression");
      const call = ast.expression as AST.CallExpression;
      expect(call.callee.name).toBe("lower");
      expect(call.arguments).toHaveLength(1);
      expect((call.arguments[0] as AST.Identifier).isProgramInput).toBe(true);
    });

    test("auto-injects $$ for call without source ref", () => {
      const ast = parseAndNormalize('split " "');
      // split " " -> split($$, " ")
      const call = ast.expression as AST.CallExpression;
      expect(call.arguments).toHaveLength(2);
      expect((call.arguments[0] as AST.Identifier).isProgramInput).toBe(true);
    });

    test("does not inject $$ when $ present", () => {
      const ast = parseAndNormalize("lower $");
      const call = ast.expression as AST.CallExpression;
      expect(call.arguments).toHaveLength(1);
      expect((call.arguments[0] as AST.Identifier).isPipelineRef).toBe(true);
    });

    test("does not inject $$ when $$ present", () => {
      const ast = parseAndNormalize("lower $$");
      const call = ast.expression as AST.CallExpression;
      expect(call.arguments).toHaveLength(1);
      expect((call.arguments[0] as AST.Identifier).isProgramInput).toBe(true);
    });

    test("does not inject $$ when $0 present", () => {
      const ast = parseAndNormalize('join $0 " " $1');
      const call = ast.expression as AST.CallExpression;
      // Should have exactly 3 args, no injection
      expect(call.arguments).toHaveLength(3);
    });

    test("normalizes pipeline in effect body", () => {
      const ast = parseAndNormalize("fn: normalize (email) (email | lower | trim)");
      const effect = ast.statements[0] as AST.EffectStatement;
      // Effect arguments should be normalized
      // The pipeline in the body should be normalized to (trim lower email)
      expect(effect.arguments).toHaveLength(3);
      // Last argument is a group containing the normalized body
      const bodyGroup = effect.arguments[2] as AST.GroupExpression;
      // Explicit parens prevent $$-injection and redundant nesting
      // Direct GroupExpression(CallExpression) structure
      const call = bodyGroup.expression as AST.CallExpression;
      expect(call.type).toBe("CallExpression");
      expect(call.callee.name).toBe("trim");
    });
  });

  describe("Error handling", () => {
    test("throws on unexpected token", () => {
      expect(() => parseSource(")")).toThrow(ParseError);
    });

    test("throws on unclosed paren", () => {
      expect(() => parseSource("(foo")).toThrow(ParseError);
    });

    test("parses identifier without colon as regular call", () => {
      // Without colon, "let" is just a regular identifier
      const ast = parseSource("let x 10");
      expect(ast.expression?.type).toBe("CallExpression");
      expect((ast.expression as AST.CallExpression).callee.name).toBe("let");
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

  describe("Source spans", () => {
    test("tracks span for literal", () => {
      const ast = parseSource("42");
      expect(ast.expression?.span.start.line).toBe(1);
      expect(ast.expression?.span.start.column).toBe(1);
    });

    test("tracks span for multiline program", () => {
      // Multiline program with effect on line 1, expression on line 2
      const ast = parseSource("let: x 10\n+ x 1");
      expect(ast.statements[0]?.span.start.line).toBe(1);
      // The expression starts on line 2
      if (ast.expression) {
        expect(ast.expression.span.start.line).toBe(2);
      }
    });
  });

  describe("Edge cases", () => {
    test("parses empty program", () => {
      const ast = parseSource("");
      expect(ast.statements).toHaveLength(0);
      expect(ast.expression).toBeNull();
    });

    test("parses program with only statements", () => {
      const ast = parseSource("let: x 10");
      expect(ast.statements).toHaveLength(1);
      expect(ast.expression).toBeNull();
    });

    test("parses deeply nested groups", () => {
      const ast = parseSource("(((foo)))");
      let expr = ast.expression;
      for (let i = 0; i < 3; i++) {
        expect(expr?.type).toBe("GroupExpression");
        expr = (expr as AST.GroupExpression).expression;
      }
      expect(expr?.type).toBe("Identifier");
    });

    test("parses complex real-world example", () => {
      // Note: fn bodies need grouping when followed by more statements/expressions
      // to prevent greedy argument consumption
      const source = "let: EMAIL_REGEX /abc/ fn: normalize (email) (email | lower | trim) fn: is_valid (email) (!= (match email EMAIL_REGEX) null) normalize $$";
      const ast = parseAndNormalize(source);
      expect(ast.statements).toHaveLength(3);
      expect(ast.expression?.type).toBe("CallExpression");
    });
  });
});
