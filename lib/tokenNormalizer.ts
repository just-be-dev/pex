import type { Token, SourceRefToken } from "./lexer.ts";
import { TokenType } from "./lexer.ts";

/**
 * Normalizes a token stream by:
 * 1. Splitting at semicolons into expression groups
 * 2. Converting pipes to nested parens
 * 3. Making implicit calls explicit with parens
 * 4. Injecting $$ into calls without source refs (if shellMode enabled)
 */
export function normalizeTokens(tokens: Token[], options?: { shellMode?: boolean }): Token[] {
  // Remove EOF token, we'll add it back at the end
  const tokensWithoutEof = tokens.filter(t => t.type !== TokenType.EOF);
  const eofToken = tokens[tokens.length - 1]!;

  // Split at semicolons
  const groups = splitAtSemicolons(tokensWithoutEof);
  const lastGroupIndex = groups.length - 1;

  // Process each group
  const normalizedGroups = groups.map((group, index) => {
    const isLastGroup = index === lastGroupIndex;

    // Handle pipes first (splits into segments, wraps each, injects $$, then folds)
    const withPipes = normalizePipes(group, false, options, isLastGroup);

    // Make calls explicit (wrap in parens) and inject $$ if not already done
    // Note: For groups WITH pipes, these are no-ops (already wrapped & injected)
    // For groups WITHOUT pipes, these calls are necessary
    const wrapped = makeCallsExplicit(withPipes);
    const injected = injectProgramInput(wrapped, options, isLastGroup);

    return injected;
  });

  // Flatten and add EOF back
  let result = normalizedGroups.flat();

  // Simplify redundant nested parens: ( ( ... ) ) → ( ... )
  result = simplifyRedundantParens(result);

  result.push(eofToken);
  return result;
}

/**
 * Simplify redundant nested parens: ( ( ... ) ) → ( ... )
 * If a paren group contains only another paren group, unwrap it
 * Also removes parens around single identifiers when nested (not at top level)
 */
function simplifyRedundantParens(tokens: Token[], isTopLevel: boolean = true): Token[] {
  const result: Token[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i]!;

    if (token.type === TokenType.LPAREN) {
      // Extract paren group contents
      const { endIndex, contents } = extractParenGroup(tokens, i);

      // Recursively simplify the contents (not top level anymore)
      const simplifiedContents = simplifyRedundantParens(contents, false);

      // Check if contents are ONLY another paren group (no other tokens)
      // This means: contents = [LPAREN, ..., RPAREN] with matching parens
      if (
        simplifiedContents.length >= 2 &&
        simplifiedContents[0]!.type === TokenType.LPAREN &&
        simplifiedContents[simplifiedContents.length - 1]!.type === TokenType.RPAREN &&
        areMatchingParens(simplifiedContents, 0, simplifiedContents.length - 1)
      ) {
        // Unwrap: remove outer parens, keep inner ones
        result.push(...simplifiedContents);
      }
      // NEW: Check if contents are a single token (no arguments)
      // If not at top level, unwrap single-token paren groups
      else if (!isTopLevel && isSingleTokenGroup(simplifiedContents)) {
        // Unwrap: just push the single token without parens
        result.push(...simplifiedContents);
      } else {
        // Keep the parens
        result.push(token); // LPAREN
        result.push(...simplifiedContents);
        result.push(tokens[endIndex]!); // RPAREN
      }

      i = endIndex + 1;
    } else {
      result.push(token);
      i++;
    }
  }

  return result;
}

/**
 * Check if a token group is a single token (no parens, just one token)
 */
function isSingleTokenGroup(tokens: Token[]): boolean {
  // Filter out paren tokens and whitespace if any
  const nonParenTokens = tokens.filter(
    t => t.type !== TokenType.LPAREN && t.type !== TokenType.RPAREN
  );
  return nonParenTokens.length === 1;
}

/**
 * Split token stream at SEMICOLON boundaries, wrapping each group in parens
 */
function splitAtSemicolons(tokens: Token[]): Token[][] {
  const groups: Token[][] = [];
  let currentGroup: Token[] = [];

  for (const token of tokens) {
    if (token.type === TokenType.SEMICOLON) {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
        currentGroup = [];
      } else {
        // Empty group - emit empty parens
        groups.push([]);
      }
    } else {
      currentGroup.push(token);
    }
  }

  // Don't forget the last group
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * Convert pipe operators to nested paren structure at all depths
 * Example: [a, PIPE, b, PIPE, c] → [LPAREN, c, LPAREN, b, a, RPAREN, RPAREN]
 * @param insideExplicitParens - tracks whether we're inside explicit parentheses
 * @param options - parser options including shellMode
 * @param isLastGroup - whether this is the last expression group
 */
function normalizePipes(
  tokens: Token[],
  insideExplicitParens: boolean = false,
  options?: { shellMode?: boolean },
  isLastGroup: boolean = false
): Token[] {
  const result: Token[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i]!;

    if (token.type === TokenType.LPAREN) {
      // Found a paren group - recursively normalize what's inside
      // Explicit parens (not synthetic) means we're inside explicit context
      const { endIndex, contents } = extractParenGroup(tokens, i);
      const normalized = normalizePipes(contents, true, options, isLastGroup); // Inside explicit parens now

      result.push(token); // LPAREN
      result.push(...normalized);
      result.push(tokens[endIndex]!); // RPAREN

      i = endIndex + 1;
    } else {
      result.push(token);
      i++;
    }
  }

  // Now handle pipes at the current level (outside parens)
  return normalizePipesAtCurrentLevel(result, insideExplicitParens, options, isLastGroup);
}

/**
 * Extract the contents of a paren group
 */
function extractParenGroup(tokens: Token[], startIndex: number): { endIndex: number; contents: Token[] } {
  let depth = 0;
  const contents: Token[] = [];
  let i = startIndex;

  for (; i < tokens.length; i++) {
    const token = tokens[i]!;

    if (token.type === TokenType.LPAREN) {
      if (depth > 0) {
        contents.push(token);
      }
      depth++;
    } else if (token.type === TokenType.RPAREN) {
      depth--;
      if (depth === 0) {
        return { endIndex: i, contents };
      }
      contents.push(token);
    } else {
      if (depth > 0) {
        contents.push(token);
      }
    }
  }

  throw new Error("Unmatched LPAREN");
}

/**
 * Normalize pipes at the current level (not inside nested parens)
 * @param insideExplicitParens - tracks whether we're inside explicit parentheses
 * @param options - parser options including shellMode
 * @param isLastGroup - whether this is the last expression group
 */
function normalizePipesAtCurrentLevel(
  tokens: Token[],
  insideExplicitParens: boolean = false,
  options?: { shellMode?: boolean },
  isLastGroup: boolean = false
): Token[] {
  // Find pipe positions (only at depth 0)
  const pipePositions: number[] = [];
  let depth = 0;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.type === TokenType.LPAREN) depth++;
    else if (token.type === TokenType.RPAREN) depth--;
    else if (token.type === TokenType.PIPE && depth === 0) {
      pipePositions.push(i);
    }
  }

  if (pipePositions.length === 0) {
    return tokens;
  }

  // Split by pipes
  const segments: Token[][] = [];
  let start = 0;
  for (const pos of pipePositions) {
    segments.push(tokens.slice(start, pos));
    start = pos + 1;
  }
  segments.push(tokens.slice(start));

  // Process each segment: wrap in parens and inject $$ into first segment only if appropriate
  const processedSegments = segments.map((segment, index) => {
    // Wrap in parens if not already wrapped
    let wrapped = makeCallsExplicit(segment);

    // Inject $$ into the first segment (leftmost, earliest in execution)
    // Only inject into first segment if appropriate based on options
    // Other segments don't need injection - they receive the previous result as an argument
    if (index === 0 && !insideExplicitParens) {
      wrapped = injectProgramInput(wrapped, options, isLastGroup);
    }

    return wrapped;
  });

  // Fold left-to-right: a | b | c → (c b a $$)
  // Start with the first segment and wrap it with successive segments
  // Completely unwrap intermediate results to produce flat structure
  let result = processedSegments[0]!;
  for (let i = 1; i < processedSegments.length; i++) {
    const nextSegment = processedSegments[i]!;

    // nextSegment is [(func args...)]
    // We want to insert unwrapped result after func: [(func ...result_contents args...)]
    const lparen = nextSegment[0]!;
    const func = nextSegment[1]!;
    const rparen = nextSegment[nextSegment.length - 1]!;
    const args = nextSegment.slice(2, -1);

    // Completely unwrap result to get just the content tokens
    // This handles cases like ((b a)) -> [b, a]
    const unwrappedResult = unwrapAllParens(result.slice(1, -1));

    result = [
      lparen,
      func,
      ...unwrappedResult,  // Insert unwrapped previous result
      ...args,
      rparen,
    ];
  }

  return result;
}

/**
 * Make all calls explicit by wrapping ungrouped token sequences in parens
 * Effects (EFFECT_IDENT) are wrapped like regular calls, but won't get $$ injection
 */
function makeCallsExplicit(tokens: Token[]): Token[] {
  if (tokens.length === 0) {
    return [];
  }

  // If already wrapped in parens, we're done
  if (tokens.length >= 2 && tokens[0]!.type === TokenType.LPAREN && tokens[tokens.length - 1]!.type === TokenType.RPAREN) {
    // Check if these are matching parens
    if (areMatchingParens(tokens, 0, tokens.length - 1)) {
      return tokens;
    }
  }

  // Wrap in parens
  return [
    createSyntheticToken(TokenType.LPAREN, "(", tokens[0]),
    ...tokens,
    createSyntheticToken(TokenType.RPAREN, ")", tokens[tokens.length - 1]),
  ];
}

/**
 * Check if the parens at start and end indices are matching
 */
function areMatchingParens(tokens: Token[], startIndex: number, endIndex: number): boolean {
  let depth = 0;
  for (let i = startIndex; i <= endIndex; i++) {
    const token = tokens[i]!;
    if (token.type === TokenType.LPAREN) depth++;
    else if (token.type === TokenType.RPAREN) depth--;
    if (depth === 0 && i < endIndex) {
      // Found matching paren before the end
      return false;
    }
  }
  return depth === 0;
}

/**
 * Completely unwrap all layers of parentheses from a token sequence
 * Example: ((b a)) → [b, a]
 */
function unwrapAllParens(tokens: Token[]): Token[] {
  let result = tokens;
  while (
    result.length >= 2 &&
    result[0]!.type === TokenType.LPAREN &&
    result[result.length - 1]!.type === TokenType.RPAREN &&
    areMatchingParens(result, 0, result.length - 1)
  ) {
    result = result.slice(1, -1);
  }
  return result;
}

/**
 * Inject $$ into calls that don't have source refs
 * Only injects when shellMode is enabled and this is the last group
 */
function injectProgramInput(
  tokens: Token[],
  options?: { shellMode?: boolean },
  isLastGroup: boolean = false
): Token[] {
  // Determine if we should inject based on options
  const shellMode = options?.shellMode ?? false;

  // If shellMode is false, don't inject at all
  // If shellMode is true, only inject if this is the last group
  const shouldAttemptInject = shellMode && isLastGroup;

  if (!shouldAttemptInject) {
    // Still need to recursively process nested parens
    return processNestedParens(tokens);
  }

  // Process recursively from innermost to outermost
  const result: Token[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i]!;

    if (token.type === TokenType.LPAREN) {
      // Extract paren group
      const { endIndex, contents } = extractParenGroup(tokens, i);
      const normalized = injectProgramInput(contents, options, isLastGroup);

      // Check if it contains any source refs
      const hasSourceRef = normalized.some(t => t.type === TokenType.SOURCE_REF);

      result.push(token); // LPAREN

      // In shell mode, we ignore effect and synthetic checks
      // Only check if source ref already exists
      if (!hasSourceRef && normalized.length > 0) {
        // Inject $$ after the first token (callee)
        result.push(normalized[0]!);
        result.push(createSourceRefToken('program', normalized[0]));
        result.push(...normalized.slice(1));
      } else {
        result.push(...normalized);
      }

      result.push(tokens[endIndex]!); // RPAREN

      i = endIndex + 1;
    } else {
      result.push(token);
      i++;
    }
  }

  return result;
}

/**
 * Helper function for processing nested parens without injection
 */
function processNestedParens(tokens: Token[]): Token[] {
  const result: Token[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i]!;

    if (token.type === TokenType.LPAREN) {
      const { endIndex, contents } = extractParenGroup(tokens, i);
      const processed = processNestedParens(contents);

      result.push(token);
      result.push(...processed);
      result.push(tokens[endIndex]!);

      i = endIndex + 1;
    } else {
      result.push(token);
      i++;
    }
  }

  return result;
}

/**
 * Create a synthetic token with position from a reference token
 */
function createSyntheticToken(type: TokenType, value: string, refToken: Token | undefined): Token {
  const ref = refToken || { line: 1, column: 1, raw: "" } as Token;
  const token: any = {
    type,
    value,
    line: ref.line,
    column: ref.column,
    raw: value,
  };
  // Mark as synthetic so we can distinguish from explicit parens in source
  token.__synthetic = true;
  return token as Token;
}

/**
 * Create a synthetic SOURCE_REF token
 */
function createSourceRefToken(refType: 'program' | 'pipeline' | 'array', refToken: Token | undefined, arrayIndex?: number): SourceRefToken {
  const ref = refToken || { line: 1, column: 1, raw: "" } as Token;
  const value = refType === 'program' ? '$$' : refType === 'pipeline' ? '$' : `$${arrayIndex}`;
  return {
    type: TokenType.SOURCE_REF,
    value,
    refType,
    arrayIndex,
    line: ref.line,
    column: ref.column,
    raw: value,
  };
}
