import { describe, test, expect } from "bun:test";
import { tokenize } from "./lexer.ts";
import { normalizeTokens } from "./tokenNormalizer.ts";
import { TokenType } from "./lexer.ts";
import { print } from "./printer.ts";

// Helper to get normalized tokens as a readable string
const normalizeSource = (source: string, options?: { shellMode?: boolean }) => {
  const tokens = tokenize(source);
  const normalized = normalizeTokens(tokens, options);
  return print(normalized);
};

// Helper to check if normalized tokens match expected pattern
const expectNormalized = (source: string, expected: string, options?: { shellMode?: boolean }) => {
  const result = normalizeSource(source, options);
  expect(result).toBe(expected);
};

describe("Token Normalizer", () => {
  describe("Implicit calls", () => {
    test("wraps bare identifier in parens (no $$ injection without options)", () => {
      // In normal mode, single identifiers are NOT wrapped (they're value references)
      expectNormalized(
        "lower",
        "lower"
      );
    });

    test("wraps identifier with args in parens (no $$ injection without options)", () => {
      expectNormalized(
        'split " "',
        '(split " ")'
      );
    });

    test("wraps multiple args (no $$ injection without options)", () => {
      expectNormalized(
        "add 1 2",
        "(add 1 2)"
      );
    });
  });

  describe("Pipe normalization", () => {
    test("normalizes simple pipe (no $$ injection without options)", () => {
      expectNormalized(
        "a | b",
        "(b (a))"
      );
    });

    test("normalizes three-stage pipeline (no $$ injection without options)", () => {
      expectNormalized(
        "a | b | c",
        "(c (b (a)))"
      );
    });

    test("normalizes pipe with function call (no $$ injection without options)", () => {
      expectNormalized(
        'a | split " "',
        '(split (a) " ")'
      );
    });

    test("normalizes pipes inside parens", () => {
      expectNormalized(
        "(a | b)",
        "(b (a))"
      );
    });

    test("normalizes nested pipes at multiple depths", () => {
      expectNormalized(
        "(a | b) | c",
        "(c (b (a)))"
      );

      // Also verify no PIPE tokens remain
      const tokens = tokenize("(a | b) | c");
      const normalized = normalizeTokens(tokens);
      const hasNoPipes = normalized.every(t => t.type !== TokenType.PIPE);
      expect(hasNoPipes).toBe(true);
    });
  });

  describe("Semicolon normalization", () => {
    test("splits at semicolon (no $$ injection without options)", () => {
      // In normal mode, single identifiers are NOT wrapped
      expectNormalized(
        "a; b",
        "a b"
      );
    });

    test("splits multiple semicolons (no $$ injection without options)", () => {
      // In normal mode, single identifiers are NOT wrapped
      expectNormalized(
        "a; b; c",
        "a b c"
      );
    });

    test("handles semicolon with function calls (no $$ injection without options)", () => {
      // Function call is wrapped, but single identifier is not
      expectNormalized(
        'split " "; lower',
        '(split " ") lower'
      );
    });
  });

  describe("$$-injection", () => {
    test("does not inject $$ without options", () => {
      // In normal mode, single identifiers are NOT wrapped
      expectNormalized(
        "lower",
        "lower"
      );
    });

    test("preserves existing source refs", () => {
      expectNormalized(
        "add $ 1",
        "(add $ 1)"
      );
    });

    test("preserves existing $$", () => {
      expectNormalized(
        "add $$ 1",
        "(add $$ 1)"
      );
    });

    test("preserves existing $0", () => {
      expectNormalized(
        "add $0 1",
        "(add $0 1)"
      );
    });

    test("no injection into pipeline without options", () => {
      const tokens = tokenize("a | b");
      const normalized = normalizeTokens(tokens);

      // Count SOURCE_REF tokens - should be zero without options
      const sourceRefCount = normalized.filter(t => t.type === TokenType.SOURCE_REF).length;
      expect(sourceRefCount).toBe(0);
    });

    test("no injection into explicit parens without options", () => {
      // Explicit parens are preserved
      // (foo (bar)) means: call foo with result of calling bar
      // NOT the same as (foo bar) which means: call foo with variable bar
      expectNormalized(
        "(foo (bar))",
        "(foo (bar))"
      );

      // Verify no SOURCE_REF tokens exist
      const tokens = tokenize("(foo (bar))");
      const normalized = normalizeTokens(tokens);
      const sourceRefCount = normalized.filter(t => t.type === TokenType.SOURCE_REF).length;
      expect(sourceRefCount).toBe(0);
    });

    test("no injection without options regardless of paren type", () => {
      // Implicit parens (no parens in source) - still no injection without options
      expectNormalized(
        "foo bar",
        "(foo bar)"
      );

      // Explicit parens (parens in source) - no injection without options
      expectNormalized(
        "(foo bar)",
        "(foo bar)"
      );
    });
  });

  describe("Effect statements", () => {
    test("wraps effect statements like regular expressions", () => {
      const tokens = tokenize("let: x 10");
      const normalized = normalizeTokens(tokens);

      // Effects now get wrapped in parens like regular expressions
      const result = normalized
        .filter(t => t.type !== TokenType.EOF)
        .map(t => t.type)
        .join(" ");

      expect(result).toBe("LPAREN EFFECT_IDENT IDENTIFIER NUMBER RPAREN");
    });

    test("does not inject $$ into effect statements", () => {
      const tokens = tokenize("let: x 10");
      const normalized = normalizeTokens(tokens);

      // Should have no SOURCE_REF tokens (no $$ injection for effects)
      const hasSourceRef = normalized.some(t => t.type === TokenType.SOURCE_REF);
      expect(hasSourceRef).toBe(false);
    });

    test("handles effect with grouped pipeline body", () => {
      const tokens = tokenize("fn: normalize (email) (email | lower)");
      const normalized = normalizeTokens(tokens);

      // The pipeline inside should be normalized (no PIPE tokens)
      const hasNoPipes = normalized.every(t => t.type !== TokenType.PIPE);
      expect(hasNoPipes).toBe(true);

      // Effect statement is now wrapped in parens
      expect(normalized[0]?.type).toBe(TokenType.LPAREN);
      expect(normalized[1]?.type).toBe(TokenType.EFFECT_IDENT);
    });
  });

  describe("Combined scenarios", () => {
    test("handles pipes and semicolons together", () => {
      const tokens = tokenize("a | b; c");
      const normalized = normalizeTokens(tokens);

      // Should have no PIPE or SEMICOLON tokens
      const hasNoSpecialTokens = normalized.every(
        t => t.type !== TokenType.PIPE && t.type !== TokenType.SEMICOLON
      );
      expect(hasNoSpecialTokens).toBe(true);
    });

    test("handles effect statements with expression in same group", () => {
      const tokens = tokenize("let: x 10  lower");
      const normalized = normalizeTokens(tokens);

      // Effects now get wrapped, so the group is wrapped in parens
      expect(normalized[0]?.type).toBe(TokenType.LPAREN);
      expect(normalized[1]?.type).toBe(TokenType.EFFECT_IDENT);

      // All tokens are wrapped in parens now
      expect(normalized[2]?.type).toBe(TokenType.IDENTIFIER); // x
      expect(normalized[3]?.type).toBe(TokenType.NUMBER); // 10
      expect(normalized[4]?.type).toBe(TokenType.IDENTIFIER); // lower
      expect(normalized[5]?.type).toBe(TokenType.RPAREN);
    });

    test("handles complex real-world example", () => {
      const tokens = tokenize("let: x 10 fn: double (x) (* x 2) double $$");
      const normalized = normalizeTokens(tokens);

      // Should have no PIPE or SEMICOLON tokens
      const hasNoSpecialTokens = normalized.every(
        t => t.type !== TokenType.PIPE && t.type !== TokenType.SEMICOLON
      );
      expect(hasNoSpecialTokens).toBe(true);

      // Should start with LPAREN (effects are wrapped now)
      expect(normalized[0]?.type).toBe(TokenType.LPAREN);
      // Then the first effect
      expect(normalized[1]?.type).toBe(TokenType.EFFECT_IDENT);
      expect(normalized[1]?.value).toBe("let");
    });
  });

  describe("Edge cases", () => {
    test("preserves EOF token at end", () => {
      const tokens = tokenize("lower");
      const normalized = normalizeTokens(tokens);

      expect(normalized[normalized.length - 1]?.type).toBe(TokenType.EOF);
    });

    test("handles empty input", () => {
      const tokens = tokenize("");
      const normalized = normalizeTokens(tokens);

      // Should only have EOF
      expect(normalized).toHaveLength(1);
      expect(normalized[0]?.type).toBe(TokenType.EOF);
    });

    test("handles already grouped expressions", () => {
      // Explicit parens prevent $$-injection
      expectNormalized(
        "(lower)",
        "(lower)"
      );
    });

    test("handles nested parens", () => {
      const tokens = tokenize("((foo))");
      const normalized = normalizeTokens(tokens);

      // All parens are explicit, so no $$-injection
      const hasSourceRef = normalized.some(t => t.type === TokenType.SOURCE_REF);
      expect(hasSourceRef).toBe(false);
    });

    test("handles operator identifiers (no $$ injection without options)", () => {
      expectNormalized(
        "+ 1 2",
        "(+ 1 2)"
      );
    });

    test("handles regex literals in effect statements", () => {
      // Regex is recognized after EFFECT_IDENT (operand position)
      const tokens = tokenize("let: EMAIL_REGEX /test/");
      const normalized = normalizeTokens(tokens);

      // Should have a REGEX token
      const hasRegex = normalized.some(t => t.type === TokenType.REGEX);
      expect(hasRegex).toBe(true);
    });

    test("removes all PIPE tokens from output", () => {
      const testCases = [
        "a | b",
        "a | b | c",
        "(a | b)",
        "a | b; c | d",
      ];

      for (const testCase of testCases) {
        const tokens = tokenize(testCase);
        const normalized = normalizeTokens(tokens);
        const hasPipes = normalized.some(t => t.type === TokenType.PIPE);
        expect(hasPipes).toBe(false);
      }
    });

    test("removes all SEMICOLON tokens from output", () => {
      const testCases = [
        "a; b",
        "a; b; c",
        "a | b; c",
      ];

      for (const testCase of testCases) {
        const tokens = tokenize(testCase);
        const normalized = normalizeTokens(tokens);
        const hasSemicolons = normalized.some(t => t.type === TokenType.SEMICOLON);
        expect(hasSemicolons).toBe(false);
      }
    });
  });

  describe("Source position preservation", () => {
    test("synthetic tokens inherit position from reference tokens", () => {
      const tokens = tokenize("lower");
      const normalized = normalizeTokens(tokens);

      // All tokens should have valid line/column info
      for (const token of normalized) {
        expect(token.line).toBeGreaterThanOrEqual(1);
        expect(token.column).toBeGreaterThanOrEqual(1);
      }
    });

    test("injected $$ tokens have position info (with shellMode)", () => {
      const tokens = tokenize("lower");
      const normalized = normalizeTokens(tokens, { shellMode: true });

      const sourceRefToken = normalized.find(t => t.type === TokenType.SOURCE_REF);
      expect(sourceRefToken).toBeDefined();
      expect(sourceRefToken?.line).toBeGreaterThanOrEqual(1);
      expect(sourceRefToken?.column).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Shell mode injection", () => {
    test("injects $$ only into last expression when shellMode is true", () => {
      const tokens = tokenize("a; b; c");
      const normalized = normalizeTokens(tokens, { shellMode: true });
      const printed = print(normalized);

      // Only last expression should have $$
      expect(printed).toBe("(a) (b) (c $$)");
    });

    test("effects can receive $$ injection in shell mode", () => {
      const tokens = tokenize("let: x 10");
      const normalized = normalizeTokens(tokens, { shellMode: true });

      // Should have SOURCE_REF token
      const hasSourceRef = normalized.some(t => t.type === TokenType.SOURCE_REF);
      expect(hasSourceRef).toBe(true);
    });

    test("explicit parens can receive $$ injection in shell mode", () => {
      const tokens = tokenize("(foo bar)");
      const normalized = normalizeTokens(tokens, { shellMode: true });

      // Should have SOURCE_REF token (explicit parens don't block in shell mode)
      const hasSourceRef = normalized.some(t => t.type === TokenType.SOURCE_REF);
      expect(hasSourceRef).toBe(true);
    });

    test("no injection when shellMode is false", () => {
      const tokens = tokenize("a; b");
      const normalized = normalizeTokens(tokens, { shellMode: false });
      const printed = print(normalized);

      // No $$ in any expression
      // In normal mode, single identifiers are NOT wrapped
      expect(printed).toBe("a b");
    });

    test("shell mode with pipelines injects only in last group", () => {
      const tokens = tokenize("a | b; c | d");
      const normalized = normalizeTokens(tokens, { shellMode: true });
      const printed = print(normalized);

      // Pipelines create nested structures
      // Only second pipeline (last group) should get $$
      expect(printed).toBe("(b (a)) (d (c $$))");
    });

    test("single expression with shellMode gets $$ injection", () => {
      expectNormalized(
        "lower",
        "(lower $$)",
        { shellMode: true }
      );
    });

    test("shell mode injects $$ after callee in calls", () => {
      expectNormalized(
        'split " "',
        '(split $$ " ")',
        { shellMode: true }
      );
    });

    test("shell mode preserves existing source refs", () => {
      expectNormalized(
        "add $$ 1",
        "(add $$ 1)",
        { shellMode: true }
      );
    });
  });
});
