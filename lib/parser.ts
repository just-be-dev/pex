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
// Parser Class
// ============================================

export class Parser {
  private tokens: Token[];
  private current: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  // ============================================
  // Main Entry Point
  // ============================================

  parse(): AST.Program {
    const expressions: AST.SExpr[] = [];

    // Parse all top-level expressions
    while (!this.isAtEnd()) {
      expressions.push(this.parseExpression());
    }

    return {
      type: "Program",
      expressions,
    };
  }

  // ============================================
  // Expression Parsing
  // ============================================

  private parseExpression(): AST.SExpr {
    // List (parenthesized expression)
    if (this.check(TokenType.LPAREN)) {
      return this.parseList();
    }

    // Atom (literal or identifier)
    return this.parseAtom();
  }

  private parseList(): AST.List {
    this.consume(TokenType.LPAREN, "Expected '('");

    const elements: AST.SExpr[] = [];

    // Parse elements until we hit the closing paren
    while (!this.check(TokenType.RPAREN) && !this.isAtEnd()) {
      elements.push(this.parseExpression());
    }

    this.consume(TokenType.RPAREN, "Expected ')' after list elements");

    return {
      type: "List",
      elements,
    };
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

export function parse(tokens: Token[]): AST.Program {
  const parser = new Parser(tokens);
  return parser.parse();
}
