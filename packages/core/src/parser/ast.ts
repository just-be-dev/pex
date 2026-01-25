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

export type AtomType = "number" | "string" | "boolean" | "null" | "regex" | "identifier" | "effect";

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
// Pipeline
// ============================================

export interface Pipeline {
  type: "Pipeline";
  stages: SExpr[];
}

// ============================================
// S-Expression Union
// ============================================

export type SExpr = Atom | List | Pipeline;

// ============================================
// Program Node
// ============================================

export interface Program {
  type: "Program";
  expressions: SExpr[]; // One or more top-level expressions
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

export function isPipeline(expr: SExpr): expr is Pipeline {
  return expr.type === "Pipeline";
}

export function isIdentifier(expr: SExpr): expr is Atom {
  return isAtom(expr) && expr.atomType === "identifier";
}

export function isLiteral(expr: SExpr): expr is Atom {
  return isAtom(expr) && expr.atomType !== "identifier" && expr.atomType !== "effect";
}

export function isEffect(expr: SExpr): expr is Atom {
  return isAtom(expr) && expr.atomType === "effect";
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

export function pipeline(...stages: SExpr[]): Pipeline {
  return { type: "Pipeline", stages };
}

// ============================================
// Special Identifier Helpers
// ============================================

// Helper to check if an identifier is a source reference ($, $$, $0, $1, etc.)
export function isSourceRef(expr: SExpr): expr is Atom {
  if (!isIdentifier(expr)) return false;
  const name = expr.value as string;
  return name === "$" || name === "$$" || /^\$\d+$/.test(name);
}

export function isPipelineRef(expr: SExpr): expr is Atom {
  return isIdentifier(expr) && expr.value === "$";
}

export function isProgramInput(expr: SExpr): expr is Atom {
  return isIdentifier(expr) && expr.value === "$$";
}

export function isArrayRef(expr: SExpr): expr is Atom {
  if (!isIdentifier(expr)) return false;
  const name = expr.value as string;
  return /^\$\d+$/.test(name);
}

export function getArrayIndex(expr: SExpr): number | undefined {
  if (!isArrayRef(expr)) return undefined;
  const name = expr.value as string;
  return parseInt(name.slice(1), 10);
}
