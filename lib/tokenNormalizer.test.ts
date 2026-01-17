import { describe, test, expect } from "bun:test";
import { tokenize } from "./lexer.ts";
import { normalizeTokens } from "./tokenNormalizer.ts";
import { TokenType } from "./lexer.ts";
import { print } from "./printer.ts";

// Helper to get normalized tokens as a readable string
const normalizeSource = (source: string) => {
  const tokens = tokenize(source);
  const normalized = normalizeTokens(tokens);
  return print(normalized);
};

// Helper to check if normalized tokens match expected pattern
const expectNormalized = (source: string, expected: string) => {
  const result = normalizeSource(source);
  expect(result).toBe(expected);
};

describe("Token Normalizer", () => {
  describe("Implicit calls", () => {
    test("wraps bare identifier in parens and injects $$", () => {
      expectNormalized(
        "lower",
        "(lower $$)"
      );
    });

    test("wraps identifier with args in parens and injects $$", () => {
      expectNormalized(
        'split " "',
        '(split $$ " ")'
      );
    });

    test("wraps multiple args and injects $$", () => {
      expectNormalized(
        "add 1 2",
        "(add $$ 1 2)"
      );
    });
  });

  describe("Pipe normalization", () => {
    test("normalizes simple pipe (a | b)", () => {
      expectNormalized(
        "a | b",
        "(b a $$)"
      );
    });

    test("normalizes three-stage pipeline (a | b | c)", () => {
      expectNormalized(
        "a | b | c",
        "(c b a $$)"
      );
    });

    test("normalizes pipe with function call", () => {
      expectNormalized(
        'a | split " "',
        '(split a $$ " ")'
      );
    });

    test("normalizes pipes inside parens", () => {
      // Explicit parens disable $$-injection
      expectNormalized(
        "(a | b)",
        "(b a)"
      );
    });

    test("normalizes nested pipes at multiple depths", () => {
      // (a | b) | c - explicit parens at the start prevent $$ injection entirely
      expectNormalized(
        "(a | b) | c",
        "(c b a)"
      );

      // Also verify no PIPE tokens remain
      const tokens = tokenize("(a | b) | c");
      const normalized = normalizeTokens(tokens);
      const hasNoPipes = normalized.every(t => t.type !== TokenType.PIPE);
      expect(hasNoPipes).toBe(true);
    });
  });

  describe("Semicolon normalization", () => {
    test("splits at semicolon", () => {
      expectNormalized(
        "a; b",
        "(a $$) (b $$)"
      );
    });

    test("splits multiple semicolons", () => {
      expectNormalized(
        "a; b; c",
        "(a $$) (b $$) (c $$)"
      );
    });

    test("handles semicolon with function calls", () => {
      expectNormalized(
        'split " "; lower',
        '(split $$ " ") (lower $$)'
      );
    });
  });

  describe("$$-injection", () => {
    test("injects $$ into call without source refs", () => {
      expectNormalized(
        "lower",
        "(lower $$)"
      );
    });

    test("does not inject $$ if $ is present", () => {
      expectNormalized(
        "add $ 1",
        "(add $ 1)"
      );
    });

    test("does not inject $$ if $$ is present", () => {
      expectNormalized(
        "add $$ 1",
        "(add $$ 1)"
      );
    });

    test("does not inject $$ if $0 is present", () => {
      expectNormalized(
        "add $0 1",
        "(add $0 1)"
      );
    });

    test("injects $$ into first segment of pipeline only", () => {
      const tokens = tokenize("a | b");
      const normalized = normalizeTokens(tokens);

      // Count SOURCE_REF tokens - should only be one (in first segment)
      const sourceRefCount = normalized.filter(t => t.type === TokenType.SOURCE_REF).length;
      expect(sourceRefCount).toBe(1);
    });

    test("does not inject $$ into explicit parens", () => {
      // Explicit parens prevent $$-injection
      // If user writes (foo (bar)), they're being explicit about structure
      expectNormalized(
        "(foo (bar))",
        "(foo (bar))"
      );

      // Verify no SOURCE_REF tokens exist (all parens are explicit)
      const tokens = tokenize("(foo (bar))");
      const normalized = normalizeTokens(tokens);
      const sourceRefCount = normalized.filter(t => t.type === TokenType.SOURCE_REF).length;
      expect(sourceRefCount).toBe(0);
    });

    test("distinguishes implicit vs explicit parens", () => {
      // Implicit parens (no parens in source) get $$-injection
      expectNormalized(
        "foo bar",
        "(foo $$ bar)"
      );

      // Explicit parens (parens in source) prevent $$-injection
      expectNormalized(
        "(foo bar)",
        "(foo bar)"
      );
    });
  });

  describe("Effect statements", () => {
    test("does not wrap effect statements", () => {
      const tokens = tokenize("let: x 10");
      const normalized = normalizeTokens(tokens);

      // Should not add extra parens around the effect statement
      const result = normalized
        .filter(t => t.type !== TokenType.EOF)
        .map(t => t.type)
        .join(" ");

      expect(result).toBe("EFFECT_IDENT IDENTIFIER NUMBER");
    });

    test("does not inject $$ into effect statements", () => {
      const tokens = tokenize("let: x 10");
      const normalized = normalizeTokens(tokens);

      // Should have no SOURCE_REF tokens
      const hasSourceRef = normalized.some(t => t.type === TokenType.SOURCE_REF);
      expect(hasSourceRef).toBe(false);
    });

    test("handles effect with grouped pipeline body", () => {
      const tokens = tokenize("fn: normalize (email) (email | lower)");
      const normalized = normalizeTokens(tokens);

      // The pipeline inside should be normalized (no PIPE tokens)
      const hasNoPipes = normalized.every(t => t.type !== TokenType.PIPE);
      expect(hasNoPipes).toBe(true);

      // Effect statement itself should not be wrapped
      expect(normalized[0]?.type).toBe(TokenType.EFFECT_IDENT);
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

      // Without a semicolon, this is all one group starting with EFFECT_IDENT
      // So it doesn't get wrapped - the effect statement consumes all tokens
      expect(normalized[0]?.type).toBe(TokenType.EFFECT_IDENT);

      // All tokens remain in order (no wrapping for effect groups)
      expect(normalized[1]?.type).toBe(TokenType.IDENTIFIER); // x
      expect(normalized[2]?.type).toBe(TokenType.NUMBER); // 10
      expect(normalized[3]?.type).toBe(TokenType.IDENTIFIER); // lower
    });

    test("handles complex real-world example", () => {
      const tokens = tokenize("let: x 10 fn: double (x) (* x 2) double $$");
      const normalized = normalizeTokens(tokens);

      // Should have no PIPE or SEMICOLON tokens
      const hasNoSpecialTokens = normalized.every(
        t => t.type !== TokenType.PIPE && t.type !== TokenType.SEMICOLON
      );
      expect(hasNoSpecialTokens).toBe(true);

      // Should start with first effect (value is "let", raw is "let:")
      expect(normalized[0]?.type).toBe(TokenType.EFFECT_IDENT);
      expect(normalized[0]?.value).toBe("let");
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

    test("handles operator identifiers", () => {
      expectNormalized(
        "+ 1 2",
        "(+ $$ 1 2)"
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

    test("injected $$ tokens have position info", () => {
      const tokens = tokenize("lower");
      const normalized = normalizeTokens(tokens);

      const sourceRefToken = normalized.find(t => t.type === TokenType.SOURCE_REF);
      expect(sourceRefToken).toBeDefined();
      expect(sourceRefToken?.line).toBeGreaterThanOrEqual(1);
      expect(sourceRefToken?.column).toBeGreaterThanOrEqual(1);
    });
  });
});
