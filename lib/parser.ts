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
    const statements: AST.EffectStatement[] = [];
    let expression: AST.SExpr | null = null;

    // Parse statements and final expression
    while (!this.isAtEnd()) {
      // Try to parse as effect statement first (special forms with :)
      if (this.isEffectStatementStart()) {
        statements.push(this.parseEffectStatement());
      } else {
        // Must be the final expression
        expression = this.parseExpression();

        // After parsing expression, check if there's more
        // If more special forms follow, that's an error (expression must be last)
        if (!this.isAtEnd() && this.isEffectStatementStart()) {
          throw this.error(
            "Special forms must appear before the final expression",
            this.peek()
          );
        }
      }
    }

    return {
      type: "Program",
      statements,
      expression,
    };
  }

  // ============================================
  // Effect Statement Parsing
  // ============================================

  private isEffectStatementStart(): boolean {
    return this.check(TokenType.EFFECT_IDENT);
  }

  private parseEffectStatement(): AST.EffectStatement {
    const effectNameToken = this.consume(
      TokenType.EFFECT_IDENT,
      "Expected effect name"
    );
    const effectName = String(effectNameToken.value);

    // Parse arguments until we hit another effect or EOF
    const args: AST.SExpr[] = [];

    while (!this.isAtEnd() && !this.isEffectStatementStart()) {
      if (this.check(TokenType.EOF)) break;

      // Heuristic: If we've parsed 2+ arguments and the last was a list,
      // and we now see an atom that's not followed by a paren,
      // stop to allow for final expression
      if (
        args.length >= 2 &&
        args[args.length - 1]!.type === "List" &&
        (this.check(TokenType.IDENTIFIER) || this.check(TokenType.SOURCE_REF)) &&
        !this.checkNext(TokenType.LPAREN)
      ) {
        break;
      }

      // Heuristic: If we've parsed 2+ non-list arguments and the next token
      // is LPAREN (which starts a new expression), stop to allow for final expression
      // This handles cases like: let: x 10  (+ x TAX)
      if (
        args.length >= 2 &&
        args[args.length - 1]!.type === "Atom" &&
        this.check(TokenType.LPAREN)
      ) {
        break;
      }

      // Heuristic: If we've parsed 3+ arguments (typical for fn: name params body)
      // and the next token is LPAREN, stop to allow for final expression
      // This handles cases like: fn: foo (x) (+ x 1)  (bar $$)
      if (args.length >= 3 && this.check(TokenType.LPAREN)) {
        break;
      }

      args.push(this.parseExpression());
    }

    return {
      type: "EffectStatement",
      name: effectName,
      arguments: args,
    };
  }

  private checkNext(type: TokenType): boolean {
    if (this.current + 1 >= this.tokens.length) return false;
    return this.tokens[this.current + 1]!.type === type;
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
