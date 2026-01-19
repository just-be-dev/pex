export enum TokenType {
  // Literals
  NUMBER = "NUMBER",
  STRING = "STRING",
  REGEX = "REGEX",
  BOOLEAN = "BOOLEAN",
  NULL = "NULL",

  // Identifiers
  IDENTIFIER = "IDENTIFIER",
  EFFECT_IDENT = "EFFECT_IDENT", // identifier followed by colon, e.g., "let:", "fn:"
  SOURCE_REF = "SOURCE_REF", // $, $$, $0, $1, etc.

  // Operators
  PIPE = "PIPE",           // |
  SEMICOLON = "SEMICOLON", // ;
  LPAREN = "LPAREN",       // (
  RPAREN = "RPAREN",       // )
  COMMA = "COMMA",         // ,

  // Special
  EOF = "EOF",
}

export interface Token {
  type: TokenType;
  value: string | number | boolean | null;
  line: number;
  column: number;
  raw: string;
}

export interface SourceRefToken extends Token {
  type: TokenType.SOURCE_REF;
  refType: 'pipeline' | 'program' | 'array';
  arrayIndex?: number;
}

export class LexerError extends Error {
  constructor(
    message: string,
    public line: number,
    public column: number
  ) {
    super(`Lexer Error at line ${line}, column ${column}: ${message}`);
    this.name = "LexerError";
  }
}

export class Lexer {
  private source: string;
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;
  private tokens: Token[] = [];

  constructor(source: string) {
    this.source = source;
  }

  tokenize(): Token[] {
    while (this.position < this.source.length) {
      this.skipWhitespace();

      if (this.position >= this.source.length) {
        break;
      }

      // Skip comments
      if (this.peek() === ";" && this.peek(1) === ";") {
        this.skipComment();
        continue;
      }

      const token = this.nextToken();
      if (token) {
        this.tokens.push(token);
      }
    }

    this.tokens.push({
      type: TokenType.EOF,
      value: null,
      line: this.line,
      column: this.column,
      raw: "",
    });

    return this.tokens;
  }

  private nextToken(): Token | null {
    const char = this.peek();
    const line = this.line;
    const column = this.column;

    // Single character tokens
    switch (char) {
      case "|":
        this.advance();
        return { type: TokenType.PIPE, value: "|", line, column, raw: "|" };
      case ";":
        this.advance();
        return { type: TokenType.SEMICOLON, value: ";", line, column, raw: ";" };
      case "(":
        this.advance();
        return { type: TokenType.LPAREN, value: "(", line, column, raw: "(" };
      case ")":
        this.advance();
        return { type: TokenType.RPAREN, value: ")", line, column, raw: ")" };
      case ",":
        this.advance();
        return { type: TokenType.COMMA, value: ",", line, column, raw: "," };
    }

    // Negative numbers - special case before identifier reading
    if (char === "-" && this.isDigit(this.peek(1))) {
      return this.readNumber();
    }

    // Strings
    if (char === '"' || char === "'") {
      return this.readString(char);
    }

    // Regex: only when in operand position (where a value is expected)
    if (char === "/" && this.isOperandPosition()) {
      return this.readRegex();
    }

    // Numbers
    if (this.isDigit(char)) {
      return this.readNumber();
    }

    // Identifiers and keywords
    if (this.isIdentifierStart(char)) {
      return this.readIdentifier();
    }

    throw new LexerError(`Unexpected character '${char}'`, line, column);
  }

  private readString(quote: string): Token {
    const line = this.line;
    const column = this.column;
    let value = "";
    let raw = quote;

    this.advance(); // Skip opening quote

    while (this.position < this.source.length && this.peek() !== quote) {
      if (this.peek() === "\\") {
        this.advance();
        raw += "\\";

        const escapeChar = this.peek();
        raw += escapeChar;

        switch (escapeChar) {
          case "n":
            value += "\n";
            break;
          case "t":
            value += "\t";
            break;
          case "r":
            value += "\r";
            break;
          case "\\":
            value += "\\";
            break;
          case quote:
            value += quote;
            break;
          default:
            value += escapeChar;
        }
        this.advance();
      } else {
        const char = this.peek();
        value += char;
        raw += char;
        this.advance();
      }
    }

    if (this.peek() !== quote) {
      throw new LexerError(`Unterminated string`, line, column);
    }

    this.advance(); // Skip closing quote
    raw += quote;

    return { type: TokenType.STRING, value, line, column, raw };
  }

  private readRegex(): Token {
    const line = this.line;
    const column = this.column;
    let pattern = "";
    let raw = "/";

    this.advance(); // Skip opening /

    while (this.position < this.source.length && this.peek() !== "/") {
      if (this.peek() === "\\") {
        pattern += this.peek();
        raw += this.peek();
        this.advance();
        if (this.position < this.source.length) {
          pattern += this.peek();
          raw += this.peek();
          this.advance();
        }
      } else if (this.peek() === "\n") {
        throw new LexerError(`Unterminated regex`, line, column);
      } else {
        pattern += this.peek();
        raw += this.peek();
        this.advance();
      }
    }

    if (this.peek() !== "/") {
      throw new LexerError(`Unterminated regex`, line, column);
    }

    this.advance(); // Skip closing /
    raw += "/";

    // Read flags
    let flags = "";
    while (
      this.position < this.source.length &&
      /[gimsuvy]/.test(this.peek())
    ) {
      flags += this.peek();
      raw += this.peek();
      this.advance();
    }

    return {
      type: TokenType.REGEX,
      value: `/${pattern}/${flags}`,
      line,
      column,
      raw,
    };
  }

  private readNumber(): Token {
    const line = this.line;
    const column = this.column;
    let value = "";

    // Handle negative numbers
    if (this.peek() === "-") {
      value += this.peek();
      this.advance();
    }

    // Read integer part
    while (this.position < this.source.length && this.isDigit(this.peek())) {
      value += this.peek();
      this.advance();
    }

    // Read decimal part
    if (this.peek() === "." && this.isDigit(this.peek(1))) {
      value += this.peek();
      this.advance();

      while (this.position < this.source.length && this.isDigit(this.peek())) {
        value += this.peek();
        this.advance();
      }
    }

    const numValue = parseFloat(value);
    return {
      type: TokenType.NUMBER,
      value: numValue,
      line,
      column,
      raw: value,
    };
  }

  private readIdentifier(): Token | SourceRefToken {
    const line = this.line;
    const column = this.column;
    let value = "";

    while (
      this.position < this.source.length &&
      this.isIdentifierPart(this.peek())
    ) {
      value += this.peek();
      this.advance();
    }

    // Check for SOURCE_REF patterns: $, $$, $0, $1, etc.
    if (value === "$") {
      return {
        type: TokenType.SOURCE_REF,
        value: "$",
        refType: 'pipeline',
        line,
        column,
        raw: "$",
      };
    }
    if (value === "$$") {
      return {
        type: TokenType.SOURCE_REF,
        value: "$$",
        refType: 'program',
        line,
        column,
        raw: "$$",
      };
    }
    const arrayMatch = value.match(/^\$(\d+)$/);
    if (arrayMatch) {
      return {
        type: TokenType.SOURCE_REF,
        value,
        refType: 'array',
        arrayIndex: parseInt(arrayMatch[1]!, 10),
        line,
        column,
        raw: value,
      };
    }

    // Check if followed by colon (effect name pattern)
    let raw = value;
    let type: TokenType;
    let tokenValue: string | boolean | null = value;

    if (this.peek() === ":") {
      this.advance(); // consume the colon
      raw = value + ":";
      tokenValue = value;  // Value without colon, raw includes colon
      type = TokenType.EFFECT_IDENT;
    } else {
      // Check for keywords
      switch (value) {
        case "true":
          type = TokenType.BOOLEAN;
          tokenValue = true;
          break;
        case "false":
          type = TokenType.BOOLEAN;
          tokenValue = false;
          break;
        case "null":
          type = TokenType.NULL;
          tokenValue = null;
          break;
        default:
          type = TokenType.IDENTIFIER;
      }
    }

    return { type, value: tokenValue, line, column, raw };
  }

  private skipWhitespace(): void {
    while (
      this.position < this.source.length &&
      /\s/.test(this.peek())
    ) {
      this.advance();
    }
  }

  private skipComment(): void {
    // Skip until end of line
    while (
      this.position < this.source.length &&
      this.peek() !== "\n"
    ) {
      this.advance();
    }
  }

  private peek(offset: number = 0): string {
    const pos = this.position + offset;
    return pos < this.source.length ? this.source[pos]! : "";
  }

  private advance(): void {
    if (this.position < this.source.length) {
      if (this.source[this.position] === "\n") {
        this.line++;
        this.column = 1;
      } else {
        this.column++;
      }
      this.position++;
    }
  }

  private isDigit(char: string): boolean {
    return /[0-9]/.test(char);
  }

  private isIdentifierStart(char: string): boolean {
    return /[a-zA-Z_$<>=!?+\-*/%]/.test(char);
  }

  private isIdentifierPart(char: string): boolean {
    return /[a-zA-Z0-9_$<>=!?+\-*/%]/.test(char);
  }

  /**
   * Determines if we're in "operand position" (where a value is expected).
   * Used to distinguish regex literals from division operators.
   */
  private isOperandPosition(): boolean {
    const lastToken = this.tokens[this.tokens.length - 1];

    // At start of input, need to look ahead to distinguish / identifier from /regex/
    if (!lastToken) {
      return this.looksLikeRegex();
    }

    // After these tokens, we could have either / operator or /regex/
    // Need to look ahead to distinguish
    const ambiguousStarters = [
      TokenType.LPAREN,
      TokenType.PIPE,
      TokenType.COMMA,
      TokenType.SEMICOLON,
      TokenType.EFFECT_IDENT,
    ];
    if (ambiguousStarters.includes(lastToken.type)) {
      return this.looksLikeRegex();
    }

    // After a literal value, we're definitely expecting another operand (argument)
    // so / must be starting a regex
    const literalTypes = [
      TokenType.STRING,
      TokenType.NUMBER,
      TokenType.BOOLEAN,
      TokenType.NULL,
      TokenType.REGEX,
      TokenType.SOURCE_REF,
    ];
    if (literalTypes.includes(lastToken.type)) return true;

    // After an identifier in argument position, another value can follow
    if (lastToken.type === TokenType.IDENTIFIER) {
      const secondLastToken = this.tokens[this.tokens.length - 2];
      const argPositionStarters = [
        TokenType.EFFECT_IDENT,
        TokenType.COMMA,
        TokenType.LPAREN,
        TokenType.PIPE,
        TokenType.SEMICOLON,
      ];
      if (secondLastToken && argPositionStarters.includes(secondLastToken.type)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Look ahead to see if / starts a regex literal or is the division operator
   */
  private looksLikeRegex(): boolean {
    // Save position
    const savedPos = this.position;
    const savedLine = this.line;
    const savedCol = this.column;

    // Skip the /
    this.position++;

    let hasContent = false;

    // Look for closing / (handling escapes)
    while (this.position < this.source.length) {
      const char = this.peek();

      if (char === "\n") {
        // Regex can't span lines
        break;
      }

      if (char === "\\") {
        // Escape sequence - skip next char
        this.position++;
        if (this.position < this.source.length) {
          this.position++;
          hasContent = true;
        }
      } else if (char === "/") {
        // Found closing /
        break;
      } else if (char === " " && !hasContent) {
        // Leading space after / suggests it's a division operator
        break;
      } else {
        this.position++;
        hasContent = true;
      }
    }

    // Restore position
    this.position = savedPos;
    this.line = savedLine;
    this.column = savedCol;

    // It's a regex if we have content (even without closing /, which will throw error)
    return hasContent;
  }
}

export function tokenize(source: string): Token[] {
  const lexer = new Lexer(source);
  return lexer.tokenize();
}
