/**
 * Intermediate Representation (IR) for PEX
 *
 * This is a minimal S-expression language that serves as a common intermediate
 * representation for multiple backends (bytecode VM, WASM, etc.).
 *
 * All PEX sugar (pipelines, $, $$, $N) is desugared during AST→IR lowering.
 */

// ============================================
// Constant Values
// ============================================

export type ConstValue =
  | null
  | boolean
  | number
  | string
  | { type: "regex"; pattern: string; flags: string };

// ============================================
// IR Expression Types
// ============================================

export type IRExpr =
  | IRConst
  | IRVar
  | IRIf
  | IRLet
  | IRSeq
  | IRCall
  | IRFn
  | IREffect;

export interface IRConst {
  type: "const";
  value: ConstValue;
}

export interface IRVar {
  type: "var";
  name: string;
}

export interface IRIf {
  type: "if";
  cond: IRExpr;
  thenBranch: IRExpr;
  else: IRExpr;
}

export interface IRLet {
  type: "let";
  name: string;
  value: IRExpr;
  body: IRExpr;
}

export interface IRSeq {
  type: "seq";
  exprs: IRExpr[];
}

export interface IRCall {
  type: "call";
  func: IRExpr;
  args: IRExpr[];
}

export interface IRFn {
  type: "fn";
  params: string[];
  body: IRExpr;
  captures: string[]; // Free variables captured from outer scope
}

export interface IREffect {
  type: "effect";
  name: string;
  args: IRExpr[];
}

// ============================================
// IR Module
// ============================================

export interface IRModule {
  body: IRExpr;
}

// ============================================
// Type Guards
// ============================================

export function isConst(expr: IRExpr): expr is IRConst {
  return expr.type === "const";
}

export function isVar(expr: IRExpr): expr is IRVar {
  return expr.type === "var";
}

export function isIf(expr: IRExpr): expr is IRIf {
  return expr.type === "if";
}

export function isLet(expr: IRExpr): expr is IRLet {
  return expr.type === "let";
}

export function isSeq(expr: IRExpr): expr is IRSeq {
  return expr.type === "seq";
}

export function isCall(expr: IRExpr): expr is IRCall {
  return expr.type === "call";
}

export function isFn(expr: IRExpr): expr is IRFn {
  return expr.type === "fn";
}

export function isEffect(expr: IRExpr): expr is IREffect {
  return expr.type === "effect";
}

// ============================================
// Helper Constructors
// ============================================

export function irConst(value: ConstValue): IRConst {
  return { type: "const", value };
}

export function irVar(name: string): IRVar {
  return { type: "var", name };
}

export function irIf(cond: IRExpr, thenBranch: IRExpr, elseExpr: IRExpr): IRIf {
  return { type: "if", cond, thenBranch, else: elseExpr };
}

export function irLet(name: string, value: IRExpr, body: IRExpr): IRLet {
  return { type: "let", name, value, body };
}

export function irSeq(exprs: IRExpr[]): IRSeq {
  return { type: "seq", exprs };
}

export function irCall(func: IRExpr, args: IRExpr[]): IRCall {
  return { type: "call", func, args };
}

export function irFn(params: string[], body: IRExpr, captures: string[] = []): IRFn {
  return { type: "fn", params, body, captures };
}

export function irEffect(name: string, args: IRExpr[]): IREffect {
  return { type: "effect", name, args };
}

export function irModule(body: IRExpr): IRModule {
  return { body };
}
