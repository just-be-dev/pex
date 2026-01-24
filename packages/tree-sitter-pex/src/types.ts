/**
 * TypeScript type definitions for Tree-sitter PEX
 */

import type Parser from 'tree-sitter';

export interface PEXSyntaxNode extends Parser.SyntaxNode {
  type: PEXNodeType;
}

export type PEXNodeType =
  | 'program'
  | 'expression'
  | 'pipeline'
  | 'implicit_call'
  | 'list'
  | 'atom'
  | 'number'
  | 'string'
  | 'regex'
  | 'boolean'
  | 'null'
  | 'source_ref'
  | 'effect_ident'
  | 'identifier'
  | 'escape_sequence'
  | 'comment'
  | 'ERROR';

export interface ParseOptions {
  /**
   * Optional include ranges for incremental parsing
   */
  includedRanges?: Parser.Range[];
}

export interface ParseResult {
  /**
   * The root syntax node
   */
  rootNode: PEXSyntaxNode;

  /**
   * Whether the parse was successful (no ERROR nodes)
   */
  success: boolean;

  /**
   * List of syntax errors encountered
   */
  errors: PEXSyntaxNode[];
}

export interface QueryCapture {
  name: string;
  node: PEXSyntaxNode;
}

export interface QueryMatch {
  pattern: number;
  captures: QueryCapture[];
}
