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

    // Pre-process: wrap effect calls before pipe normalization
    // This prevents effect bodies from being split by pipes
    const withEffects = wrapEffectCalls(group);

    // Handle pipes first (splits into segments, wraps each, injects $$, then folds)
    const withPipes = normalizePipes(withEffects, false, options, isLastGroup);

    // Make calls explicit (wrap in parens) and inject $$ if not already done
    // Note: For groups WITH pipes, these are no-ops (already wrapped & injected)
    // For groups WITHOUT pipes, these calls are necessary
    const wrapped = makeCallsExplicit(withPipes, options, isLastGroup);
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
      // NEW: Check if contents are a single atom token (literal, no function call)
      // Unwrap single-atom paren groups at any level
      else if (isSingleAtom(simplifiedContents)) {
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
 * Check if a token group is a single atom (literal or source ref, not a function call)
 */
function isSingleAtom(tokens: Token[]): boolean {
  const nonParenTokens = tokens.filter(
    t => t.type !== TokenType.LPAREN && t.type !== TokenType.RPAREN
  );

  if (nonParenTokens.length !== 1) {
    return false;
  }

  const token = nonParenTokens[0]!;

  // Check if it's a literal (not an identifier or effect identifier)
  return (
    token.type === TokenType.NULL ||
    token.type === TokenType.BOOLEAN ||
    token.type === TokenType.NUMBER ||
    token.type === TokenType.STRING ||
    token.type === TokenType.REGEX ||
    token.type === TokenType.SOURCE_REF
  );
}

/**
 * Wrap effect calls in parentheses to prevent pipe normalization from splitting them
 * Example: [let:, x, 42] → [(, let:, x, 42, )]
 * Example: [fn:, f, (x), a, |, b] → [(, fn:, f, (x), (a | b), )] - wraps body
 */
function wrapEffectCalls(tokens: Token[]): Token[] {
  if (tokens.length === 0) return tokens;

  // Check if this group starts with an effect
  const startsWithEffect = tokens[0]!.type === TokenType.EFFECT_IDENT;

  if (!startsWithEffect) {
    // No effect at the start, process nested parens recursively
    return processParensRecursively(tokens, wrapEffectCalls);
  }

  // This group starts with an effect, wrap the entire group
  return [
    createSyntheticToken(TokenType.LPAREN, "(", tokens[0]),
    ...tokens,
    createSyntheticToken(TokenType.RPAREN, ")", tokens[tokens.length - 1]),
  ];
}

/**
 * Recursively process paren groups with a transformation function
 */
function processParensRecursively(tokens: Token[], transform: (tokens: Token[]) => Token[]): Token[] {
  const result: Token[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i]!;

    if (token.type === TokenType.LPAREN) {
      const { endIndex, contents } = extractParenGroup(tokens, i);
      const transformed = transform(contents);

      result.push(token); // LPAREN
      result.push(...transformed);
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

      // If normalized result is already wrapped, unwrap it before wrapping with source parens
      // This prevents double-wrapping when a pipeline inside parens gets wrapped during normalization
      const toWrap = (normalized.length >= 2 &&
                     normalized[0]!.type === TokenType.LPAREN &&
                     normalized[normalized.length - 1]!.type === TokenType.RPAREN &&
                     areMatchingParens(normalized, 0, normalized.length - 1))
        ? normalized.slice(1, -1)
        : normalized;

      result.push(token); // LPAREN
      result.push(...toWrap);
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

  // Process each segment: wrap multi-token segments in parens
  const processedSegments = segments.map((segment, index) => {
    let wrapped: Token[];

    // Check if already wrapped
    if (segment.length >= 2 && segment[0]!.type === TokenType.LPAREN &&
        segment[segment.length - 1]!.type === TokenType.RPAREN &&
        areMatchingParens(segment, 0, segment.length - 1)) {
      // Already wrapped
      wrapped = segment;
    }
    // Only wrap if more than one token (multi-token calls need parens)
    else if (segment.length > 1) {
      wrapped = [
        createSyntheticToken(TokenType.LPAREN, "(", segment[0]),
        ...segment,
        createSyntheticToken(TokenType.RPAREN, ")", segment[segment.length - 1]),
      ];
    }
    // Single token - no wrapping needed, will be inlined during folding
    else {
      wrapped = segment;
    }

    return wrapped;
  });

  // Fold left-to-right: a | b | c → (c (b (a)))
  // Build NESTED structure where each stage wraps the previous one
  // Handle $ placeholder: a | b $ → (b (a)) where $ is replaced with (a)

  // Ensure first segment is wrapped for proper nesting
  let result = processedSegments[0]!;
  if (result[0]?.type !== TokenType.LPAREN && result.length === 1) {
    // Single token like `a` needs to be wrapped as `(a)`
    result = [
      createSyntheticToken(TokenType.LPAREN, "(", result[0]),
      ...result,
      createSyntheticToken(TokenType.RPAREN, ")", result[0]),
    ];
  }
  for (let i = 1; i < processedSegments.length; i++) {
    const nextSegment = processedSegments[i]!;
    const isLastSegment = i === processedSegments.length - 1;

    // Check if nextSegment contains $ (pipeline reference)
    const hasPipelineRef = containsPipelineRef(nextSegment);

    if (hasPipelineRef) {
      // Replace $ with the previous result (keeps it as nested expression)
      result = replacePipelineRef(nextSegment, result);
    } else {
      // No $, so wrap previous result and make it the first argument
      const isWrapped = nextSegment[0]!.type === TokenType.LPAREN;

      if (isWrapped) {
        // nextSegment is [(func args...)]
        const lparen = nextSegment[0]!;
        const func = nextSegment[1]!;
        const rparen = nextSegment[nextSegment.length - 1]!;
        const args = nextSegment.slice(2, -1);

        result = [
          lparen,
          func,
          ...result,  // Insert previous result as NESTED expression
          ...args,
          rparen,
        ];
      } else {
        // nextSegment is unwrapped, like [func] or [func, args...]
        // Wrap it and include the previous result as a nested expression
        const func = nextSegment[0]!;
        const args = nextSegment.slice(1);

        result = [
          createSyntheticToken(TokenType.LPAREN, "(", func),
          func,
          ...result,  // Insert previous result as NESTED expression
          ...args,
          createSyntheticToken(TokenType.RPAREN, ")", nextSegment[nextSegment.length - 1]),
        ];
      }
    }
  }

  return result;
}

/**
 * Check if tokens contain a $ (pipeline reference) token at any depth
 */
function containsPipelineRef(tokens: Token[]): boolean {
  for (const token of tokens) {
    if (token.type === TokenType.SOURCE_REF && token.value === "$") {
      return true;
    }
  }
  return false;
}

/**
 * Replace $ (pipeline reference) tokens with the pipeline value expression
 * Example: (b $ c) with pipelineValue (a) → (b (a) c)
 */
function replacePipelineRef(tokens: Token[], pipelineValue: Token[]): Token[] {
  const result: Token[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i]!;

    if (token.type === TokenType.SOURCE_REF && token.value === "$") {
      // Replace $ with the pipeline value
      result.push(...pipelineValue);
      i++;
    } else if (token.type === TokenType.LPAREN) {
      // Recursively process paren contents
      const { endIndex, contents } = extractParenGroup(tokens, i);
      const replaced = replacePipelineRef(contents, pipelineValue);

      result.push(token); // LPAREN
      result.push(...replaced);
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
 * Make all calls explicit by wrapping ungrouped token sequences in parens
 * Effects (EFFECT_IDENT) are wrapped like regular calls, but won't get $$ injection
 */
function makeCallsExplicit(
  tokens: Token[],
  options?: { shellMode?: boolean },
  isLastGroup: boolean = false
): Token[] {
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

  // Don't wrap single value atoms (literals, source refs) - they're values, not calls
  // Only wrap single identifiers in shell mode (they're potential function calls)
  if (tokens.length === 1) {
    const token = tokens[0]!;
    const valueAtomTypes = [
      TokenType.NULL,
      TokenType.BOOLEAN,
      TokenType.NUMBER,
      TokenType.STRING,
      TokenType.REGEX,
      TokenType.SOURCE_REF,
    ];

    // Don't wrap value atoms (they're not calls)
    if (valueAtomTypes.includes(token.type)) {
      return tokens;
    }

    // For single identifiers:
    // - In shell mode: always wrap (they're function calls)
    // - In normal mode: don't wrap (they're variable references)
    if (token.type === TokenType.IDENTIFIER) {
      if (!options?.shellMode) {
        return tokens;
      }
    }
    // Identifiers in shell mode fall through to be wrapped
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
 * Helper to recursively inject $$ into the innermost nested call
 */
function injectProgramInputRecursive(
  tokens: Token[],
  options?: { shellMode?: boolean }
): Token[] {
  // This is a simplified version that assumes tokens are a single paren group
  // We need to find and inject into the innermost nested call
  if (tokens.length < 2 || tokens[0]?.type !== TokenType.LPAREN) {
    return tokens;
  }

  const contents = tokens.slice(1, -1); // Remove outer parens

  // If no nested parens or already has source ref, inject here
  if (contents.length <= 1 || contents[1]?.type !== TokenType.LPAREN || containsSourceRef(contents)) {
    // Inject at this level
    return [
      tokens[0]!, // LPAREN
      ...contents,
      createSourceRefToken('program', contents[0]),
      tokens[tokens.length - 1]! // RPAREN
    ];
  }

  // There's a nested paren group - find it and recursively inject
  let depth = 0;
  let nestedEndIdx = 1;
  for (let j = 1; j < contents.length; j++) {
    const t = contents[j]!;
    if (t.type === TokenType.LPAREN) depth++;
    else if (t.type === TokenType.RPAREN) {
      depth--;
      if (depth === 0) {
        nestedEndIdx = j;
        break;
      }
    }
  }

  // Recursively process the nested group
  const nestedGroup = contents.slice(1, nestedEndIdx + 1);
  const injectedNested = injectProgramInputRecursive(nestedGroup, options);

  // Reconstruct with the injected nested group
  return [
    tokens[0]!, // LPAREN
    contents[0]!, // function name
    ...injectedNested,
    ...contents.slice(nestedEndIdx + 1), // remaining args
    tokens[tokens.length - 1]! // RPAREN
  ];
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
      // Don't inject recursively - just process nested parens
      const normalized = processNestedParens(contents);

      // Check if it contains any source refs (recursively)
      const hasSourceRef = containsSourceRef(normalized);

      result.push(token); // LPAREN

      // Only inject if no source ref exists
      if (!hasSourceRef && normalized.length > 0) {
        result.push(normalized[0]!); // function name

        // If there's a nested paren group (pipeline result), inject $$ into it
        if (normalized.length > 1 && normalized[1]!.type === TokenType.LPAREN) {
          // Find the end of this nested paren group
          let depth = 0;
          let nestedEndIdx = 1;
          for (let j = 1; j < normalized.length; j++) {
            const t = normalized[j]!;
            if (t.type === TokenType.LPAREN) depth++;
            else if (t.type === TokenType.RPAREN) {
              depth--;
              if (depth === 0) {
                nestedEndIdx = j;
                break;
              }
            }
          }

          // Extract the nested paren group and recursively inject $$ into innermost call
          const nestedGroup = normalized.slice(1, nestedEndIdx + 1);
          const nestedContents = nestedGroup.slice(1, -1); // remove outer parens

          // Check if nested contents already have source ref
          if (!containsSourceRef(nestedContents)) {
            // Check if there's a further nested paren group (pipeline chain)
            if (nestedContents.length > 1 && nestedContents[1]?.type === TokenType.LPAREN) {
              // There's another nested level - recursively inject into it
              // Reconstruct with LPAREN/RPAREN and recursively process
              const reconstructed = [
                nestedGroup[0], // LPAREN
                ...nestedContents,
                nestedGroup[nestedGroup.length - 1] // RPAREN
              ];
              // Recursively call injectProgramInput on this nested group
              const injected = injectProgramInputRecursive(reconstructed, options);
              result.push(...injected);
            } else {
              // This is the innermost level - inject $$ here
              result.push(nestedGroup[0]!); // LPAREN
              result.push(...nestedContents);
              result.push(createSourceRefToken('program', nestedContents[0]));
              result.push(nestedGroup[nestedGroup.length - 1]!); // RPAREN
            }
          } else {
            // Already has source ref, don't inject
            result.push(...nestedGroup);
          }

          result.push(...normalized.slice(nestedEndIdx + 1)); // explicit args
        } else {
          // No nested result, just inject after function name
          result.push(createSourceRefToken('program', normalized[0]));
          result.push(...normalized.slice(1));
        }
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
 * Check if tokens contain any SOURCE_REF token (recursively checks nested parens)
 */
function containsSourceRef(tokens: Token[]): boolean {
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;

    if (token.type === TokenType.SOURCE_REF) {
      return true;
    }

    if (token.type === TokenType.LPAREN) {
      const { endIndex, contents } = extractParenGroup(tokens, i);
      if (containsSourceRef(contents)) {
        return true;
      }
      i = endIndex;
    }
  }
  return false;
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
