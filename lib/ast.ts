// ============================================
// S-Expression Based AST
// ============================================
//
// This AST represents the parsed program as s-expressions.
// The token normalizer already converts syntax like pipelines
// and implicit calls into s-expression form at the token level.
// This AST is a simple, structured representation of those s-expressions.

// ============================================
// Atom Types
// ============================================

export type AtomValue = string | number | boolean | null | RegExp;

export type AtomType = "number" | "string" | "boolean" | "null" | "regex" | "identifier";

export interface Atom {
  type: "Atom";
  atomType: AtomType;
  value: AtomValue;
  raw?: string; // Original source representation (for literals)
}

// ============================================
// List (S-Expression)
// ============================================

export interface List {
  type: "List";
  elements: SExpr[];
}

// ============================================
// S-Expression Union
// ============================================

export type SExpr = Atom | List;

// ============================================
// Effect Statement
// ============================================

// Effect statements are special forms that appear before the main expression
// Examples: let: x 10, fn: double (x) * x 2
export interface EffectStatement {
  type: "EffectStatement";
  name: string;
  arguments: SExpr[];
}

// ============================================
// Program Node
// ============================================

export interface Program {
  type: "Program";
  statements: EffectStatement[]; // Special forms (let, fn, etc.)
  expression: SExpr | null; // The final expression (program output)
}

// ============================================
// Type Guards
// ============================================

export function isAtom(expr: SExpr): expr is Atom {
  return expr.type === "Atom";
}

export function isList(expr: SExpr): expr is List {
  return expr.type === "List";
}

export function isIdentifier(expr: SExpr): expr is Atom {
  return isAtom(expr) && expr.atomType === "identifier";
}

export function isLiteral(expr: SExpr): expr is Atom {
  return isAtom(expr) && expr.atomType !== "identifier";
}

// ============================================
// Helper Constructors
// ============================================

export function atom(atomType: AtomType, value: AtomValue, raw?: string): Atom {
  return { type: "Atom", atomType, value, raw };
}

export function list(...elements: SExpr[]): List {
  return { type: "List", elements };
}

// ============================================
// Special Identifier Helpers
// ============================================

// Helper to check if an identifier is a source reference ($, $$, $0, $1, etc.)
export function isSourceRef(expr: SExpr): boolean {
  if (!isIdentifier(expr)) return false;
  const name = expr.value as string;
  return name === "$" || name === "$$" || /^\$\d+$/.test(name);
}

export function isPipelineRef(expr: SExpr): boolean {
  return isIdentifier(expr) && expr.value === "$";
}

export function isProgramInput(expr: SExpr): boolean {
  return isIdentifier(expr) && expr.value === "$$";
}

export function isArrayRef(expr: SExpr): boolean {
  if (!isIdentifier(expr)) return false;
  const name = expr.value as string;
  return /^\$\d+$/.test(name);
}

export function getArrayIndex(expr: SExpr): number | undefined {
  if (!isArrayRef(expr)) return undefined;
  const name = expr.value as string;
  return parseInt(name.slice(1), 10);
}
