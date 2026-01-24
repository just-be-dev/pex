/**
 * Tree-sitter PEX - Entry point
 *
 * Provides TypeScript-friendly access to the PEX grammar parser
 */

export { PEXParser, parse } from './parser.ts';
export type {
  PEXSyntaxNode,
  PEXNodeType,
  ParseOptions,
  ParseResult,
  QueryCapture,
  QueryMatch,
} from './types.ts';

// Re-export the language grammar for direct use
// @ts-expect-error - Dynamic import of compiled C parser
import PEXLanguage from '../index.js';
export { PEXLanguage };
