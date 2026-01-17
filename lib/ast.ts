// ============================================
// Source Location Tracking
// ============================================

export interface SourceLocation {
  line: number;
  column: number;
}

export interface SourceSpan {
  start: SourceLocation;
  end: SourceLocation;
}

// ============================================
// Base Node Interface
// ============================================

interface BaseNode {
  type: string;
  span: SourceSpan;
}

// ============================================
// Literal Nodes
// ============================================

export interface NumberLiteral extends BaseNode {
  type: "NumberLiteral";
  value: number;
  raw: string;
}

export interface StringLiteral extends BaseNode {
  type: "StringLiteral";
  value: string;
  raw: string;
}

export interface RegexLiteral extends BaseNode {
  type: "RegexLiteral";
  pattern: string;
  flags: string;
  raw: string;
}

export interface BooleanLiteral extends BaseNode {
  type: "BooleanLiteral";
  value: boolean;
}

export interface NullLiteral extends BaseNode {
  type: "NullLiteral";
}

// ============================================
// Identifier Node
// ============================================

export interface Identifier extends BaseNode {
  type: "Identifier";
  name: string;
  // Special identifiers: $, $$, $0, $1, etc.
  isSourceRef: boolean; // true for $, $$, $N
  isPipelineRef: boolean; // true for $
  isProgramInput: boolean; // true for $$
  arrayIndex?: number; // defined for $0, $1, etc.
}

// ============================================
// Expression Nodes
// ============================================

// Represents a function/operator call: `lower email` or `+ x 2`
export interface CallExpression extends BaseNode {
  type: "CallExpression";
  callee: Identifier; // function name or operator
  arguments: Expression[];
}

// Represents conditional: `if condition thenExpr elseExpr`
export interface IfExpression extends BaseNode {
  type: "IfExpression";
  condition: Expression;
  consequent: Expression;
  alternate: Expression;
}

// Represents grouping: `( expression )`
export interface GroupExpression extends BaseNode {
  type: "GroupExpression";
  expression: Expression;
}

// Union of all expression types
export type Expression =
  | NumberLiteral
  | StringLiteral
  | RegexLiteral
  | BooleanLiteral
  | NullLiteral
  | Identifier
  | CallExpression
  | IfExpression
  | GroupExpression;

// ============================================
// Statement Nodes (Effects - Generic Special Forms)
// ============================================

// Generic effect statement: `effect_name: arg1 arg2 ...`
// Examples: `let: x 10`, `fn: double (x) * x 2`, `print: expr`
export interface EffectStatement extends BaseNode {
  type: "EffectStatement";
  name: string; // The effect name (e.g., "let", "fn", "print", "debug", "assert")
  arguments: Expression[]; // All arguments to the effect
}

// Union of all statement types (just one now, but kept for extensibility)
export type Statement = EffectStatement;

// ============================================
// Program Node
// ============================================

export interface Program extends BaseNode {
  type: "Program";
  statements: Statement[]; // Special forms (bindings, definitions)
  expression: Expression | null; // The final expression (program output)
}

// ============================================
// Node Type Guard Helpers
// ============================================

export type ASTNode = Program | Statement | Expression;

export function isExpression(node: ASTNode): node is Expression {
  return [
    "NumberLiteral",
    "StringLiteral",
    "RegexLiteral",
    "BooleanLiteral",
    "NullLiteral",
    "Identifier",
    "CallExpression",
    "IfExpression",
    "GroupExpression",
  ].includes(node.type);
}

export function isStatement(node: ASTNode): node is Statement {
  return node.type === "EffectStatement";
}

export function isLiteral(
  node: ASTNode
): node is
  | NumberLiteral
  | StringLiteral
  | RegexLiteral
  | BooleanLiteral
  | NullLiteral {
  return [
    "NumberLiteral",
    "StringLiteral",
    "RegexLiteral",
    "BooleanLiteral",
    "NullLiteral",
  ].includes(node.type);
}
