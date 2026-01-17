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
    const statements: AST.Statement[] = [];
    let expression: AST.Expression | null = null;
    const startToken = this.peek();

    // Parse statements and final expression
    while (!this.isAtEnd()) {
      // Try to parse as statement first (special forms with :)
      if (this.isStatementStart()) {
        statements.push(this.parseStatement());
      } else {
        // Must be the final expression
        expression = this.parseExpression();

        // After parsing expression, check if there's more
        // If more special forms follow, that's an error (expression must be last)
        if (!this.isAtEnd() && this.isStatementStart()) {
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
      span: this.makeSpan(startToken, this.previous()),
    };
  }

  // ============================================
  // Statement Parsing (Effects - Generic Special Forms)
  // ============================================

  private isStatementStart(): boolean {
    // Check for EFFECT_IDENT: `effect_name:`
    return this.check(TokenType.EFFECT_IDENT);
  }

  private checkNext(type: TokenType): boolean {
    if (this.current + 1 >= this.tokens.length) return false;
    return this.tokens[this.current + 1]!.type === type;
  }

  private parseStatement(): AST.Statement {
    return this.parseEffectStatement();
  }

  private parseEffectStatement(): AST.EffectStatement {
    // Parse: EFFECT_IDENT expression
    // The expression is parsed as a single unit, which might be:
    // - A simple atom: `print: "hello"`
    // - A call: `let: x 10` (parsed as implicit call-like structure)
    // - A grouped expression: `assert: (> x 0)`
    const effectNameToken = this.consume(
      TokenType.EFFECT_IDENT,
      "Expected effect name"
    );
    const effectName = String(effectNameToken.value);

    // Parse a single expression that represents the effect's arguments
    // This could be multiple tokens that form a call-like structure
    // We parse until we hit another effect or EOF
    const args: AST.Expression[] = [];

    // Keep parsing atoms/groups until we hit an effect boundary
    while (!this.isAtEnd() && !this.isStatementStart()) {
      if (this.check(TokenType.EOF)) break;

      // Stop if we encounter an operator at the start of a new argument
      // This likely indicates the start of a new expression
      // Example: "let: x 10  + y 1" stops at +
      if (args.length > 0 && this.isOperatorToken()) {
        break;
      }

      // Heuristic: If we've parsed 2+ arguments and the last was grouped,
      // and we now see an ungrouped identifier, stop to allow for final expression
      // Example: "fn: is_valid (email) (body) next_expr" stops before next_expr
      if (
        args.length >= 2 &&
        args[args.length - 1]!.type === "GroupExpression" &&
        this.check(TokenType.IDENTIFIER) &&
        !this.checkNext(TokenType.LPAREN)
      ) {
        break;
      }

      // Parse as atoms or grouped expressions only
      // Don't parse as full calls to avoid greedy consumption
      args.push(this.parseEffectArgument());
    }

    return {
      type: "EffectStatement",
      name: effectName,
      arguments: args,
      span: this.makeSpan(effectNameToken, this.previous()),
    };
  }

  private parseEffectArgument(): AST.Expression {
    // Parse a single argument for an effect
    // This can be:
    // - A grouped expression: (expr)
    // - An empty group: () (represented as null literal)
    // - An operator identifier: *, +, etc.
    // - An atom: number, string, identifier, etc.

    if (this.check(TokenType.LPAREN)) {
      const lparenToken = this.peek();
      this.advance(); // consume (

      // Check for empty group ()
      if (this.check(TokenType.RPAREN)) {
        this.advance(); // consume )
        // Represent empty group as null literal
        return {
          type: "NullLiteral",
          span: this.makeSpan(lparenToken, this.previous()),
        };
      }

      const expr = this.parseExpression();
      this.consume(TokenType.RPAREN, 'Expected ")" after expression');
      return {
        type: "GroupExpression",
        expression: expr,
        span: expr.span,
      };
    }

    // Handle operators as identifiers
    if (this.isOperatorToken()) {
      return this.parseOperatorAsIdentifier();
    }

    // Parse as atom
    return this.parseAtom();
  }

  // ============================================
  // Expression Parsing (Recursive Descent)
  // ============================================

  private parseExpression(): AST.Expression {
    return this.parsePipeline();
  }

  private parsePipeline(): AST.Expression {
    const startToken = this.peek();
    const stages: AST.Expression[] = [this.parsePrimary()];

    while (this.match(TokenType.PIPE)) {
      stages.push(this.parsePrimary());
    }

    // If single stage, don't wrap in pipeline
    if (stages.length === 1) {
      return stages[0]!;
    }

    return {
      type: "PipelineExpression",
      stages,
      span: this.makeSpan(startToken, this.previous()),
    };
  }

  private parsePrimary(): AST.Expression {
    // Grouped expression
    if (this.match(TokenType.LPAREN)) {
      return this.parseGroupExpression();
    }

    // If expression
    if (this.matchIdentifier("if")) {
      return this.parseIfExpression();
    }

    // Try to parse as call (identifier/operator followed by arguments)
    // or as standalone atom
    if (this.isCallStart()) {
      return this.parseCallOrIdentifier();
    }

    // Atom (literal)
    return this.parseAtom();
  }

  private parseGroupExpression(): AST.GroupExpression {
    const lparenToken = this.previous();
    const expression = this.parseExpression();
    this.consume(TokenType.RPAREN, 'Expected ")" after expression');

    return {
      type: "GroupExpression",
      expression,
      span: this.makeSpan(lparenToken, this.previous()),
    };
  }

  private parseIfExpression(): AST.IfExpression {
    const ifToken = this.previous();

    // Parse each part as an "argument" (atom or grouped expression)
    // This prevents greedy call parsing from consuming all three as one call
    const condition = this.parseIfArg();
    const consequent = this.parseIfArg();
    const alternate = this.parseIfArg();

    return {
      type: "IfExpression",
      condition,
      consequent,
      alternate,
      span: this.makeSpan(ifToken, this.previous()),
    };
  }

  private parseIfArg(): AST.Expression {
    // Parse as grouped expression or atom (not a full call)
    if (this.check(TokenType.LPAREN)) {
      this.advance(); // consume (
      const expr = this.parseExpression();
      this.consume(TokenType.RPAREN, 'Expected ")" after expression');
      return {
        type: "GroupExpression",
        expression: expr,
        span: expr.span,
      };
    }
    return this.parseAtom();
  }

  private isCallStart(): boolean {
    // Call starts with identifier or operator
    return this.check(TokenType.IDENTIFIER) || this.isOperatorToken();
  }

  private isOperatorToken(): boolean {
    const token = this.peek();
    const t = token.type;

    // All operators are now identifiers
    if (t === TokenType.IDENTIFIER) {
      const value = String(token.value);
      return [
        "+", "-", "*", "/", "%",
        "==", "!=", "<", ">", "<=", ">=",
        "and", "or", "not", "??"
      ].includes(value);
    }

    return false;
  }

  private parseCallOrIdentifier(): AST.Expression {
    const startToken = this.peek();

    // Parse callee (identifier or operator)
    let callee: AST.Identifier;
    if (this.isOperatorToken()) {
      callee = this.parseOperatorAsIdentifier();
    } else {
      const idToken = this.advance();
      callee = this.makeIdentifier(idToken);
    }

    // Check if followed by arguments
    const args = this.parseArguments();

    // If no arguments, return as identifier
    if (args.length === 0) {
      return callee;
    }

    // Return as call
    return {
      type: "CallExpression",
      callee,
      arguments: args,
      span: this.makeSpan(startToken, this.previous()),
    };
  }

  private parseOperatorAsIdentifier(): AST.Identifier {
    const token = this.advance();
    return {
      type: "Identifier",
      name: String(token.value),
      isSourceRef: false,
      isPipelineRef: false,
      isProgramInput: false,
      span: this.makeSpan(token, token),
    };
  }

  private parseArguments(): AST.Expression[] {
    const args: AST.Expression[] = [];

    // Arguments are atoms or grouped expressions
    // Stop at: PIPE, RPAREN, EOF, COLON, or next statement keyword
    while (this.isArgumentStart()) {
      if (this.check(TokenType.LPAREN)) {
        this.advance(); // consume (
        const expr = this.parseExpression();
        this.consume(TokenType.RPAREN, 'Expected ")" after argument');
        args.push({
          type: "GroupExpression",
          expression: expr,
          span: expr.span,
        });
      } else {
        args.push(this.parseAtom());
      }
    }

    return args;
  }

  private isArgumentStart(): boolean {
    // Arguments can be atoms or grouped expressions
    if (this.isAtEnd()) return false;

    const t = this.peek().type;

    // Stop tokens - not an argument
    if (
      [
        TokenType.PIPE,
        TokenType.RPAREN,
        TokenType.EOF,
        TokenType.EFFECT_IDENT,
      ].includes(t)
    ) {
      return false;
    }

    // Atoms or grouped expressions
    return (
      t === TokenType.NUMBER ||
      t === TokenType.STRING ||
      t === TokenType.REGEX ||
      t === TokenType.BOOLEAN ||
      t === TokenType.NULL ||
      t === TokenType.IDENTIFIER ||
      t === TokenType.LPAREN
    );
  }

  private parseAtom(): AST.Expression {
    const token = this.peek();

    if (this.match(TokenType.NUMBER)) {
      return {
        type: "NumberLiteral",
        value: token.value as number,
        raw: token.raw,
        span: this.makeSpan(token, token),
      };
    }

    if (this.match(TokenType.STRING)) {
      return {
        type: "StringLiteral",
        value: token.value as string,
        raw: token.raw,
        span: this.makeSpan(token, token),
      };
    }

    if (this.match(TokenType.REGEX)) {
      const regexStr = token.value as string;
      const lastSlash = regexStr.lastIndexOf("/");
      const pattern = regexStr.slice(1, lastSlash);
      const flags = regexStr.slice(lastSlash + 1);

      return {
        type: "RegexLiteral",
        pattern,
        flags,
        raw: token.raw,
        span: this.makeSpan(token, token),
      };
    }

    if (this.match(TokenType.BOOLEAN)) {
      return {
        type: "BooleanLiteral",
        value: token.value as boolean,
        span: this.makeSpan(token, token),
      };
    }

    if (this.match(TokenType.NULL)) {
      return {
        type: "NullLiteral",
        span: this.makeSpan(token, token),
      };
    }

    if (this.match(TokenType.IDENTIFIER)) {
      return this.makeIdentifier(token);
    }

    throw this.error(`Unexpected token: ${token.type}`, token);
  }

  // ============================================
  // Helper: Create Identifier with Source Ref Detection
  // ============================================

  private makeIdentifier(token: Token): AST.Identifier {
    const name = String(token.value);

    // Detect special identifiers: $, $$, $0, $1, etc.
    const isPipelineRef = name === "$";
    const isProgramInput = name === "$$";
    const arrayIndexMatch = name.match(/^\$(\d+)$/);
    const arrayIndex = arrayIndexMatch
      ? parseInt(arrayIndexMatch[1]!, 10)
      : undefined;
    const isSourceRef =
      isPipelineRef || isProgramInput || arrayIndex !== undefined;

    return {
      type: "Identifier",
      name,
      isSourceRef,
      isPipelineRef,
      isProgramInput,
      arrayIndex,
      span: this.makeSpan(token, token),
    };
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

  private matchIdentifier(value: string): boolean {
    if (this.check(TokenType.IDENTIFIER) && this.peek().value === value) {
      this.advance();
      return true;
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

  // ============================================
  // Span Construction
  // ============================================

  private makeSpan(start: Token, end: Token): AST.SourceSpan {
    return {
      start: { line: start.line, column: start.column },
      end: { line: end.line, column: end.column + end.raw.length },
    };
  }
}

// ============================================
// Convenience Function
// ============================================

export function parse(tokens: Token[]): AST.Program {
  const parser = new Parser(tokens);
  return parser.parse();
}
