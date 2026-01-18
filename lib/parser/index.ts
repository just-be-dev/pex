/**
 * PEX Parser
 *
 * Converts PEX source code into an Abstract Syntax Tree (AST).
 * The parsing pipeline: Lexer → Parser
 */

import { tokenize } from "./lexer.ts";
import { parse as parseTokens } from "./parser.ts";
import type { Program } from "./ast.ts";

export interface ParseOptions {
  /**
   * Shell mode: automatically inject $$ into the last expression
   * if it doesn't already have source references
   */
  shellMode?: boolean;
}

/**
 * Parse PEX source code into an AST
 */
export function parse(source: string, options: ParseOptions = {}): Program {
  // Step 1: Tokenize the source code
  const tokens = tokenize(source);

  // Step 2: Parse tokens into AST (handles pipes, semicolons, and shell mode)
  const ast = parseTokens(tokens, options);

  return ast;
}

// Re-export types and utilities
export type { Program, SExpr, Atom, List, Pipeline, AtomType, AtomValue } from "./ast.ts";
export type { Token, SourceRefToken } from "./lexer.ts";
export { TokenType } from "./lexer.ts";
export { LexerError } from "./lexer.ts";
export { ParseError } from "./parser.ts";
export { print } from "./printer.ts";
