import type { Token } from "./lexer.ts";
import { TokenType } from "./lexer.ts";
import type * as AST from "./ast.ts";

// ============================================
// Parser Error
// ============================================

export class ParseError extends Error {
  constructor(
    message: string,
    public line: number,
    public column: number,
    public token?: Token
  ) {
    super(`Parse Error at line ${line}, column ${column}: ${message}`);
    this.name = "ParseError";
  }
}

// ============================================
// Parser Options
// ============================================

export interface ParseOptions {
  shellMode?: boolean;
}

// ============================================
// Parser Class
// ============================================

export class Parser {
  private tokens: Token[];
  private current: number = 0;
  private options: ParseOptions;

  constructor(tokens: Token[], options: ParseOptions = {}) {
    this.tokens = tokens;
    this.options = options;
  }

  // ============================================
  // Main Entry Point
  // ============================================

  parse(): AST.Program {
    const expressions: AST.SExpr[] = [];

    // Parse all top-level expressions (semicolons separate expressions)
    while (!this.isAtEnd()) {
      const expr = this.parseExpression();
      expressions.push(expr);

      // Skip semicolons between expressions
      while (this.match(TokenType.SEMICOLON)) {
        // Semicolon consumed
      }
    }

    // Shell mode: prepend $$ to last expression if it doesn't contain source refs
    if (this.options.shellMode && expressions.length > 0) {
      const lastExpr = expressions[expressions.length - 1]!;

      if (!this.containsSourceRef(lastExpr)) {
        const programInput = { type: "Atom" as const, atomType: "identifier" as const, value: "$$" };

        if (lastExpr.type === "Pipeline") {
          // Prepend $$ as first stage: a | b => $$ | a | b
          expressions[expressions.length - 1] = {
            type: "Pipeline",
            stages: [programInput, ...lastExpr.stages],
          };
        } else {
          // Wrap in pipeline: expr => $$ | expr
          expressions[expressions.length - 1] = {
            type: "Pipeline",
            stages: [programInput, lastExpr],
          };
        }
      }
    }

    return {
      type: "Program",
      expressions,
    };
  }

  // Helper to check if an expression contains source references ($, $$, $N)
  private containsSourceRef(expr: AST.SExpr): boolean {
    if (expr.type === "Atom" && expr.atomType === "identifier") {
      const name = expr.value as string;
      return name === "$" || name === "$$" || /^\$\d+$/.test(name);
    }
    if (expr.type === "List") {
      return expr.elements.some(e => this.containsSourceRef(e));
    }
    if (expr.type === "Pipeline") {
      return expr.stages.some(s => this.containsSourceRef(s));
    }
    return false;
  }

  // ============================================
  // Expression Parsing
  // ============================================

  private parseExpression(): AST.SExpr {
    return this.parsePipeline();
  }

  // Parse pipeline: expr | expr | expr
  private parsePipeline(): AST.SExpr {
    const stages: AST.SExpr[] = [];

    // Parse first stage
    stages.push(this.parsePrimary());

    // Parse remaining stages separated by PIPE
    while (this.match(TokenType.PIPE)) {
      stages.push(this.parsePrimary());
    }

    // If only one stage, return it directly (not a pipeline)
    if (stages.length === 1) {
      return stages[0]!;
    }

    // Multiple stages, return a Pipeline node
    return {
      type: "Pipeline",
      stages,
    };
  }

  // Parse primary expression: list or implicit call/atom
  private parsePrimary(): AST.SExpr {
    // List (parenthesized expression)
    if (this.check(TokenType.LPAREN)) {
      return this.parseList();
    }

    // Implicit call or atom
    return this.parseImplicitCallOrAtom();
  }

  // Parse implicit call or atom
  // In shell mode: collect multiple tokens into an implicit call list
  // Otherwise: just return a single atom
  private parseImplicitCallOrAtom(): AST.SExpr {
    const tokens: AST.SExpr[] = [];

    // Collect tokens until we hit a delimiter
    while (!this.isAtEnd() && !this.isDelimiter()) {
      if (this.check(TokenType.LPAREN)) {
        tokens.push(this.parseList());
      } else {
        tokens.push(this.parseAtom());
      }
    }

    if (tokens.length === 0) {
      throw this.error("Expected expression", this.peek());
    }

    // Single token - check if we should wrap it
    if (tokens.length === 1) {
      const token = tokens[0]!;

      // In shell mode, wrap single identifiers in a List (implicit call)
      if (this.options.shellMode && token.type === "Atom" && token.atomType === "identifier") {
        return {
          type: "List",
          elements: [token],
        };
      }

      // Otherwise, return as-is
      return token;
    }

    // Multiple tokens - wrap in a List (implicit call)
    return {
      type: "List",
      elements: tokens,
    };
  }

  // Check if current token is a delimiter (stops implicit call parsing)
  private isDelimiter(): boolean {
    const type = this.peek().type;
    return (
      type === TokenType.PIPE ||
      type === TokenType.RPAREN ||
      type === TokenType.SEMICOLON
    );
  }

  private parseList(): AST.SExpr {
    this.consume(TokenType.LPAREN, "Expected '('");

    // Check for empty list
    if (this.check(TokenType.RPAREN)) {
      this.advance();
      return { type: "List", elements: [] };
    }

    // Check if there are pipes at this level
    // If yes, parse as pipeline
    // If no, parse as list of elements
    if (this.hasPipeAtCurrentLevel()) {
      // Parse as pipeline
      const pipeline = this.parsePipeline();
      this.consume(TokenType.RPAREN, "Expected ')' after pipeline");
      return pipeline;
    }

    // No pipes, parse as list of space-separated elements
    const elements: AST.SExpr[] = [];
    while (!this.check(TokenType.RPAREN) && !this.isAtEnd()) {
      if (this.check(TokenType.LPAREN)) {
        elements.push(this.parseList());
      } else {
        elements.push(this.parseAtom());
      }
    }

    this.consume(TokenType.RPAREN, "Expected ')' after list elements");

    return {
      type: "List",
      elements,
    };
  }

  // Check if there's a pipe at the current level (not inside nested parens)
  private hasPipeAtCurrentLevel(): boolean {
    let depth = 0;
    let i = this.current;

    while (i < this.tokens.length) {
      const token = this.tokens[i]!;

      if (token.type === TokenType.LPAREN) {
        depth++;
      } else if (token.type === TokenType.RPAREN) {
        if (depth === 0) {
          // Reached the closing paren of current list
          return false;
        }
        depth--;
      } else if (token.type === TokenType.PIPE && depth === 0) {
        return true;
      }

      i++;
    }

    return false;
  }

  private parseAtom(): AST.Atom {
    const token = this.peek();

    if (this.match(TokenType.NUMBER)) {
      return {
        type: "Atom",
        atomType: "number",
        value: token.value as number,
        raw: token.raw,
      };
    }

    if (this.match(TokenType.STRING)) {
      return {
        type: "Atom",
        atomType: "string",
        value: token.value as string,
        raw: token.raw,
      };
    }

    if (this.match(TokenType.REGEX)) {
      const regexStr = token.value as string;
      const lastSlash = regexStr.lastIndexOf("/");
      const pattern = regexStr.slice(1, lastSlash);
      const flags = regexStr.slice(lastSlash + 1);

      // Create RegExp object
      const regexValue = new RegExp(pattern, flags);

      return {
        type: "Atom",
        atomType: "regex",
        value: regexValue,
        raw: token.raw,
      };
    }

    if (this.match(TokenType.BOOLEAN)) {
      return {
        type: "Atom",
        atomType: "boolean",
        value: token.value as boolean,
        raw: token.raw,
      };
    }

    if (this.match(TokenType.NULL)) {
      return {
        type: "Atom",
        atomType: "null",
        value: null,
        raw: token.raw,
      };
    }

    if (this.match(TokenType.IDENTIFIER)) {
      return {
        type: "Atom",
        atomType: "identifier",
        value: String(token.value),
      };
    }

    if (this.match(TokenType.EFFECT_IDENT)) {
      return {
        type: "Atom",
        atomType: "effect",
        value: String(token.value),
      };
    }

    if (this.match(TokenType.SOURCE_REF)) {
      return {
        type: "Atom",
        atomType: "identifier",
        value: String(token.value),
      };
    }

    throw this.error(`Unexpected token: ${token.type}`, token);
  }

  // ============================================
  // Token Navigation Helpers
  // ============================================

  private peek(): Token {
    return this.tokens[this.current]!;
  }

  private previous(): Token {
    return this.tokens[this.current - 1] ?? this.tokens[0]!;
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw this.error(message, this.peek());
  }

  // ============================================
  // Error Handling
  // ============================================

  private error(message: string, token: Token): ParseError {
    return new ParseError(message, token.line, token.column, token);
  }
}

// ============================================
// Convenience Function
// ============================================

export function parse(tokens: Token[], options: ParseOptions = {}): AST.Program {
  const parser = new Parser(tokens, options);
  return parser.parse();
}
