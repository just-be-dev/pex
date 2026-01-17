import type { Token } from "./lexer.ts";
import { TokenType } from "./lexer.ts";

/**
 * Converts an array of tokens back into source code.
 * Produces minimal/compact output by only adding spaces where necessary
 * to prevent tokens from merging.
 */
export function print(tokens: Token[]): string {
  // Filter out EOF token
  const nonEofTokens = tokens.filter(token => token.type !== TokenType.EOF);

  if (nonEofTokens.length === 0) {
    return "";
  }

  let output = "";

  for (let i = 0; i < nonEofTokens.length; i++) {
    const token = nonEofTokens[i]!;
    const prevToken = i > 0 ? nonEofTokens[i - 1] : null;

    // Add space before current token if needed
    if (prevToken && needsSpace(prevToken, token)) {
      output += " ";
    }

    // Add the token's raw representation
    output += token.raw;
  }

  return output;
}

/**
 * Determines if a space is needed between two tokens.
 * Returns true if omitting the space would cause tokens to merge.
 */
function needsSpace(prev: Token, current: Token): boolean {
  // No space after opening parenthesis
  if (prev.type === TokenType.LPAREN) {
    return false;
  }

  // No space before these tokens
  const noSpaceBeforeTypes = [
    TokenType.RPAREN,
    TokenType.COMMA,
    TokenType.SEMICOLON,
  ];

  if (noSpaceBeforeTypes.includes(current.type)) {
    return false;
  }

  // Add space between tokens that would otherwise merge
  return true;
}
