/**
 * TypeScript wrapper for the PEX Tree-sitter parser
 */

import Parser from 'tree-sitter';
import type { PEXSyntaxNode, ParseOptions, ParseResult } from './types.ts';

// Load the compiled parser
// @ts-expect-error - Dynamic import of compiled C parser
import PEXLanguage from '../index.js';

/**
 * PEX Parser class with TypeScript support
 */
export class PEXParser {
  private parser: Parser;

  constructor() {
    this.parser = new Parser();
    this.parser.setLanguage(PEXLanguage);
  }

  /**
   * Parse PEX source code
   */
  parse(source: string, options?: ParseOptions): ParseResult {
    const tree = this.parser.parse(source, undefined, options);
    const rootNode = tree.rootNode as PEXSyntaxNode;

    // Find all ERROR nodes
    const errors: PEXSyntaxNode[] = [];
    this.visitNode(rootNode, (node) => {
      if (node.type === 'ERROR') {
        errors.push(node as PEXSyntaxNode);
      }
    });

    return {
      rootNode,
      success: errors.length === 0,
      errors,
    };
  }

  /**
   * Parse source code and return the raw tree
   */
  parseRaw(source: string, options?: ParseOptions): Parser.Tree {
    return this.parser.parse(source, undefined, options);
  }

  /**
   * Visit all nodes in the tree depth-first
   */
  private visitNode(node: Parser.SyntaxNode, callback: (node: Parser.SyntaxNode) => void): void {
    callback(node);
    for (const child of node.children) {
      this.visitNode(child, callback);
    }
  }

  /**
   * Get all nodes of a specific type
   */
  findNodesOfType(rootNode: PEXSyntaxNode, type: string): PEXSyntaxNode[] {
    const nodes: PEXSyntaxNode[] = [];
    this.visitNode(rootNode, (node) => {
      if (node.type === type) {
        nodes.push(node as PEXSyntaxNode);
      }
    });
    return nodes;
  }

  /**
   * Get the text content of a node
   */
  getNodeText(node: PEXSyntaxNode, source: string): string {
    return source.substring(node.startIndex, node.endIndex);
  }
}

/**
 * Convenience function to parse PEX source
 */
export function parse(source: string, options?: ParseOptions): ParseResult {
  const parser = new PEXParser();
  return parser.parse(source, options);
}
