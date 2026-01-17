export enum TokenType {
  // Literals
  NUMBER = "NUMBER",
  STRING = "STRING",
  REGEX = "REGEX",
  BOOLEAN = "BOOLEAN",
  NULL = "NULL",

  // Identifiers
  IDENTIFIER = "IDENTIFIER",

  // Keywords (only special expression forms, not effects)
  IF = "IF",

  // Operators
  PIPE = "PIPE",           // |
  SEMICOLON = "SEMICOLON", // ;
  COLON = "COLON",         // :
  LPAREN = "LPAREN",       // (
  RPAREN = "RPAREN",       // )
  COMMA = "COMMA",         // ,

  // Arithmetic
  PLUS = "PLUS",           // +
  MINUS = "MINUS",         // -
  STAR = "STAR",           // *
  SLASH = "SLASH",         // /
  PERCENT = "PERCENT",     // %

  // Comparison
  EQ = "EQ",               // ==
  NE = "NE",               // !=
  LT = "LT",               // <
  GT = "GT",               // >
  LE = "LE",               // <=
  GE = "GE",               // >=

  // Logical
  AND = "AND",             // and
  OR = "OR",               // or
  NOT = "NOT",             // not

  // Null coalescing
  NULLISH = "NULLISH",     // ??

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
      case ":":
        this.advance();
        return { type: TokenType.COLON, value: ":", line, column, raw: ":" };
      case "(":
        this.advance();
        return { type: TokenType.LPAREN, value: "(", line, column, raw: "(" };
      case ")":
        this.advance();
        return { type: TokenType.RPAREN, value: ")", line, column, raw: ")" };
      case ",":
        this.advance();
        return { type: TokenType.COMMA, value: ",", line, column, raw: "," };
      case "+":
        this.advance();
        return { type: TokenType.PLUS, value: "+", line, column, raw: "+" };
      case "-":
        // Could be minus or start of negative number
        if (this.isDigit(this.peek(1))) {
          return this.readNumber();
        }
        this.advance();
        return { type: TokenType.MINUS, value: "-", line, column, raw: "-" };
      case "*":
        this.advance();
        return { type: TokenType.STAR, value: "*", line, column, raw: "*" };
      case "%":
        this.advance();
        return { type: TokenType.PERCENT, value: "%", line, column, raw: "%" };
    }

    // Multi-character operators
    if (char === "=") {
      if (this.peek(1) === "=") {
        this.advance();
        this.advance();
        return { type: TokenType.EQ, value: "==", line, column, raw: "==" };
      }
      throw new LexerError(`Unexpected character '='`, line, column);
    }

    if (char === "!") {
      if (this.peek(1) === "=") {
        this.advance();
        this.advance();
        return { type: TokenType.NE, value: "!=", line, column, raw: "!=" };
      }
      throw new LexerError(`Unexpected character '!'`, line, column);
    }

    if (char === "<") {
      if (this.peek(1) === "=") {
        this.advance();
        this.advance();
        return { type: TokenType.LE, value: "<=", line, column, raw: "<=" };
      }
      this.advance();
      return { type: TokenType.LT, value: "<", line, column, raw: "<" };
    }

    if (char === ">") {
      if (this.peek(1) === "=") {
        this.advance();
        this.advance();
        return { type: TokenType.GE, value: ">=", line, column, raw: ">=" };
      }
      this.advance();
      return { type: TokenType.GT, value: ">", line, column, raw: ">" };
    }

    if (char === "?") {
      if (this.peek(1) === "?") {
        this.advance();
        this.advance();
        return { type: TokenType.NULLISH, value: "??", line, column, raw: "??" };
      }
      throw new LexerError(`Unexpected character '?'`, line, column);
    }

    // Strings
    if (char === '"' || char === "'") {
      return this.readString(char);
    }

    // Regex vs Division
    if (char === "/") {
      // Heuristic to distinguish between division and regex
      const lastToken = this.tokens[this.tokens.length - 1];
      const secondLastToken = this.tokens[this.tokens.length - 2];

      // Regex after these tokens
      if (!lastToken ||
          lastToken.type === TokenType.IF ||
          lastToken.type === TokenType.LPAREN ||
          lastToken.type === TokenType.PIPE ||
          lastToken.type === TokenType.COMMA ||
          lastToken.type === TokenType.SEMICOLON ||
          lastToken.type === TokenType.COLON) {
        return this.readRegex();
      }

      // After identifier, check if it's in a context where regex is expected
      if (lastToken.type === TokenType.IDENTIFIER) {
        const thirdLastToken = this.tokens[this.tokens.length - 3];
        // After "IDENTIFIER COLON VARNAME /regex/" pattern (effect with value)
        if (secondLastToken?.type === TokenType.COLON &&
            thirdLastToken?.type === TokenType.IDENTIFIER) {
          return this.readRegex();
        }
        // After comma or lparen (function arguments)
        if (secondLastToken?.type === TokenType.COMMA ||
            secondLastToken?.type === TokenType.LPAREN) {
          return this.readRegex();
        }
        // Otherwise treat as division
        this.advance();
        return { type: TokenType.SLASH, value: "/", line, column, raw: "/" };
      }

      // Division after numbers and closing parens
      if (lastToken.type === TokenType.NUMBER ||
          lastToken.type === TokenType.RPAREN) {
        this.advance();
        return { type: TokenType.SLASH, value: "/", line, column, raw: "/" };
      }

      // After arithmetic operators, likely division for expressions like "+ - * / %"
      if (lastToken.type === TokenType.STAR ||
          lastToken.type === TokenType.PLUS ||
          lastToken.type === TokenType.MINUS ||
          lastToken.type === TokenType.PERCENT) {
        this.advance();
        return { type: TokenType.SLASH, value: "/", line, column, raw: "/" };
      }

      // Default to regex
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

  private readIdentifier(): Token {
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

    // Check for keywords
    let type: TokenType;
    let tokenValue: string | boolean | null = value;

    switch (value) {
      case "if":
        type = TokenType.IF;
        break;
      case "and":
        type = TokenType.AND;
        break;
      case "or":
        type = TokenType.OR;
        break;
      case "not":
        type = TokenType.NOT;
        break;
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

    return { type, value: tokenValue, line, column, raw: value };
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
    return /[a-zA-Z_$]/.test(char);
  }

  private isIdentifierPart(char: string): boolean {
    return /[a-zA-Z0-9_$]/.test(char);
  }
}

export function tokenize(source: string): Token[] {
  const lexer = new Lexer(source);
  return lexer.tokenize();
}
