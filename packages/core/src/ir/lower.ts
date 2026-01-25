/**
 * AST to IR Lowering
 *
 * This module transforms PEX AST into a minimal S-expression IR by:
 * - Desugaring pipelines to nested function calls
 * - Desugaring $$ to "input" variable, $N to (call get input N)
 * - Tracking $ (pipeline value) during lowering and substituting appropriately
 * - Desugaring and/or to if + let
 * - Converting let:/fn: to IR let/fn
 * - Converting other effects to (effect name ...args)
 * - Analyzing closures for captured variables
 */

import type { Program, SExpr, Atom, List, Pipeline } from "../parser/ast.ts";
import {
  isAtom,
  isList,
  isPipeline,
  isIdentifier,
  isEffect,
  isProgramInput,
  isPipelineRef,
  isArrayRef,
  getArrayIndex,
} from "../parser/ast.ts";
import type { IRExpr, IRModule, ConstValue } from "./types.ts";
import {
  irConst,
  irVar,
  irIf,
  irLet,
  irSeq,
  irCall,
  irFn,
  irEffect,
  irModule,
} from "./types.ts";

/**
 * Error thrown during AST → IR lowering
 */
export class LoweringError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoweringError";
  }
}

/**
 * Lowering context tracks scope and pipeline values during transformation
 */
interface LoweringContext {
  // Current scope for tracking available variables
  scope: Set<string>;
  // Current pipeline value ($ reference) - undefined means not in a pipeline
  pipelineValue?: IRExpr;
}

/**
 * Create a fresh lowering context
 */
function createContext(): LoweringContext {
  return {
    scope: new Set(),
  };
}

/**
 * Extend context with new scope
 */
function extendContext(ctx: LoweringContext, names: string[]): LoweringContext {
  const newScope = new Set(ctx.scope);
  for (const name of names) {
    newScope.add(name);
  }
  return {
    scope: newScope,
    pipelineValue: ctx.pipelineValue,
  };
}

/**
 * Set pipeline value in context
 */
function withPipelineValue(ctx: LoweringContext, value: IRExpr): LoweringContext {
  return {
    ...ctx,
    pipelineValue: value,
  };
}

/**
 * Lower a complete program to IR module
 */
export function lowerProgram(program: Program): IRModule {
  const ctx = createContext();
  // Add "input" to scope as it's the program input ($$)
  ctx.scope.add("input");

  // Pre-scan to collect all top-level fn: and let: names for mutual recursion support
  // This allows functions to reference each other regardless of definition order
  let currentCtx = ctx;
  for (const expr of program.expressions) {
    if (isList(expr) && expr.elements.length > 1) {
      const first = expr.elements[0]!;
      if (isEffect(first)) {
        const effectName = first.value as string;
        if (effectName === "let" || effectName === "fn") {
          const nameExpr = expr.elements[1]!;
          if (isIdentifier(nameExpr)) {
            const name = nameExpr.value as string;
            currentCtx = extendContext(currentCtx, [name]);
          }
        }
      }
    }
  }

  // Lower all expressions with the complete scope
  const exprs: IRExpr[] = [];
  for (const expr of program.expressions) {
    const lowered = lowerExpression(expr, currentCtx);
    exprs.push(lowered);
  }

  // If single expression, use it directly; otherwise wrap in seq
  const body = exprs.length === 1 ? exprs[0]! : irSeq(exprs);

  return irModule(body);
}

/**
 * Lower a single expression
 */
function lowerExpression(expr: SExpr, ctx: LoweringContext): IRExpr {
  if (isAtom(expr)) {
    return lowerAtom(expr, ctx);
  }

  if (isList(expr)) {
    return lowerList(expr, ctx);
  }

  if (isPipeline(expr)) {
    return lowerPipeline(expr, ctx);
  }

  throw new LoweringError(`Unknown expression type: ${JSON.stringify(expr)}`);
}

/**
 * Lower an atom (literal or identifier)
 */
function lowerAtom(atom: Atom, ctx: LoweringContext): IRExpr {
  // Use switch on atomType to satisfy TypeScript
  switch (atom.atomType) {
    case "null":
    case "boolean":
    case "number":
    case "string":
    case "regex":
      return lowerLiteral(atom);

    case "identifier": {
      const name = String(atom.value);

      // Handle $$ (program input) → (var input)
      if (isProgramInput(atom)) {
        return irVar("input");
      }

      // Handle $ (pipeline value)
      if (isPipelineRef(atom)) {
        if (!ctx.pipelineValue) {
          throw new LoweringError("Pipeline reference $ used outside of pipeline");
        }
        return ctx.pipelineValue;
      }

      // Handle $N (array reference) → (call get input N)
      if (isArrayRef(atom)) {
        const index = getArrayIndex(atom);
        if (index === undefined) {
          throw new LoweringError(`Invalid array reference: ${name}`);
        }
        return irCall(irVar("get"), [irVar("input"), irConst(index)]);
      }

      // Regular variable reference
      return irVar(name);
    }

    case "effect":
      throw new LoweringError("Effect marker cannot appear as standalone atom");

    default: {
      // Exhaustive check
      const exhaustiveCheck: never = atom.atomType;
      throw new LoweringError(`Unknown atom type: ${exhaustiveCheck}`);
    }
  }
}

/**
 * Lower a literal value
 */
function lowerLiteral(atom: Atom): IRExpr {
  let value: ConstValue;

  switch (atom.atomType) {
    case "null":
      value = null;
      break;
    case "boolean":
      value = atom.value as boolean;
      break;
    case "number":
      value = atom.value as number;
      break;
    case "string":
      value = atom.value as string;
      break;
    case "regex": {
      const regex = atom.value as RegExp;
      value = { type: "regex", pattern: regex.source, flags: regex.flags };
      break;
    }
    default:
      throw new LoweringError(`Unknown literal type: ${atom.atomType}`);
  }

  return irConst(value);
}

/**
 * Lower a list (function call, special form, or effect)
 */
function lowerList(list: List, ctx: LoweringContext): IRExpr {
  if (list.elements.length === 0) {
    throw new LoweringError("Cannot lower empty list");
  }

  const first = list.elements[0]!;

  // Must check that first is an atom
  if (!isAtom(first)) {
    throw new LoweringError("First element of list must be an atom");
  }

  // Use switch on atomType to handle different cases
  if (first.atomType === "effect") {
    const effectName = String(first.value);
    const args = list.elements.slice(1);

    // Handle let: specially (converts to IR let)
    if (effectName === "let") {
      return lowerLetEffect(args, ctx);
    }

    // Handle fn: specially (converts to IR fn)
    if (effectName === "fn") {
      return lowerFnEffect(args, ctx);
    }

    // All other effects become (effect name ...args)
    return lowerEffect(effectName, args, ctx);
  }

  // Check for special forms (if, and, or)
  if (first.atomType === "identifier") {
    const name = String(first.value);

    if (name === "if") {
      return lowerIf(list.elements.slice(1), ctx);
    }

    if (name === "and") {
      return lowerAnd(list.elements.slice(1), ctx);
    }

    if (name === "or") {
      return lowerOr(list.elements.slice(1), ctx);
    }
  }

  // Regular function call
  return lowerCall(list, ctx);
}

/**
 * Lower a pipeline to nested function calls
 * Example: $$ | lower | trim
 * Becomes: (call trim (call lower input))
 */
function lowerPipeline(pipeline: Pipeline, ctx: LoweringContext): IRExpr {
  if (pipeline.stages.length === 0) {
    throw new LoweringError("Pipeline cannot be empty");
  }

  // Generate a fresh temporary name for pipeline value
  let tempCounter = 0;
  const genTemp = () => `$pipe${tempCounter++}`;

  // Lower first stage
  let currentExpr = lowerExpression(pipeline.stages[0]!, ctx);

  // Process remaining stages
  for (let i = 1; i < pipeline.stages.length; i++) {
    const stage = pipeline.stages[i]!;
    const temp = genTemp();

    // Create a let binding for the current pipeline value
    // This allows $ references in the stage to refer to the current value
    const stageCtx = extendContext(ctx, [temp]);
    const stageCtxWithPipe = withPipelineValue(stageCtx, irVar(temp));

    // Lower the stage with pipeline context
    let stageExpr: IRExpr;

    if (isList(stage)) {
      // Check if stage contains $ reference
      const containsPipelineRef = containsPipelineRefInExpr(stage);

      if (containsPipelineRef) {
        // Stage explicitly uses $, just lower it
        stageExpr = lowerList(stage, stageCtxWithPipe);
      } else {
        // No $ present, inject pipeline value as first argument
        const func = stage.elements[0]!;
        const args = stage.elements.slice(1);

        // Create modified list with pipeline value injected
        const modifiedList: List = {
          type: "List",
          elements: [
            func,
            { type: "Atom", atomType: "identifier", value: "$" },
            ...args,
          ],
        };

        stageExpr = lowerList(modifiedList, stageCtxWithPipe);
      }
    } else if (isIdentifier(stage)) {
      // Bare identifier: auto-call with pipeline value
      const name = stage.value as string;
      if (isProgramInput(stage) || isPipelineRef(stage) || isArrayRef(stage)) {
        // Source refs just evaluate to their value
        stageExpr = lowerAtom(stage, stageCtxWithPipe);
      } else {
        // Regular identifier: call with pipeline value
        stageExpr = irCall(irVar(name), [irVar(temp)]);
      }
    } else {
      // Other expressions (literals, nested pipelines): just evaluate
      stageExpr = lowerExpression(stage, stageCtxWithPipe);
    }

    // Wrap in let binding
    currentExpr = irLet(temp, currentExpr, stageExpr);
  }

  return currentExpr;
}

/**
 * Check if an expression contains a pipeline reference ($)
 */
function containsPipelineRefInExpr(expr: SExpr): boolean {
  if (isAtom(expr) && isPipelineRef(expr)) {
    return true;
  }
  if (isList(expr)) {
    return expr.elements.some((e) => containsPipelineRefInExpr(e));
  }
  if (isPipeline(expr)) {
    return expr.stages.some((s) => containsPipelineRefInExpr(s));
  }
  return false;
}

/**
 * Lower let: effect to IR let
 * (let: x 10) → (let x (const 10) (var x))
 * (let: x 10 body) → (let x (const 10) body)
 * Note: In AST, let: has global side effects; in IR, we need a body
 * We handle this by having the program-level lowering wrap multiple
 * expressions in a sequence, and let: returns its value.
 */
function lowerLetEffect(args: SExpr[], ctx: LoweringContext): IRExpr {
  if (args.length !== 2 && args.length !== 3) {
    throw new LoweringError(`let: expects 2 or 3 arguments, got ${args.length}`);
  }

  const nameExpr = args[0]!;
  if (!isIdentifier(nameExpr)) {
    throw new LoweringError("let: first argument must be an identifier");
  }

  const name = nameExpr.value as string;
  const valueExpr = lowerExpression(args[1]!, ctx);

  // Create a new scope that includes this binding
  const bodyCtx = { ...ctx, scope: new Set([...ctx.scope, name]) };

  // If body is provided, use it; otherwise, return the value
  const bodyExpr = args.length === 3
    ? lowerExpression(args[2]!, bodyCtx)
    : irVar(name);

  return irLet(name, valueExpr, bodyExpr);
}

/**
 * Lower fn: effect to IR let with fn value
 * (fn: f (x) body) → (let f (fn (x) body) (var f))
 */
function lowerFnEffect(args: SExpr[], ctx: LoweringContext): IRExpr {
  if (args.length < 3) {
    throw new LoweringError(`fn: expects at least 3 arguments, got ${args.length}`);
  }

  const nameExpr = args[0]!;
  if (!isIdentifier(nameExpr)) {
    throw new LoweringError("fn: first argument must be an identifier");
  }

  const name = nameExpr.value as string;

  const paramsExpr = args[1]!;
  if (!isList(paramsExpr)) {
    throw new LoweringError("fn: second argument must be a list of parameters");
  }

  // Extract parameter names
  const params: string[] = [];
  for (const param of paramsExpr.elements) {
    if (!isIdentifier(param)) {
      throw new LoweringError("fn: parameters must be identifiers");
    }
    params.push((param as Atom).value as string);
  }

  // Lower body (may be multiple expressions)
  const bodyExprs = args.slice(2);
  const bodyCtx = extendContext(ctx, params);
  const loweredBodies = bodyExprs.map((expr) => lowerExpression(expr, bodyCtx));

  // Wrap multiple expressions in seq
  const body = loweredBodies.length === 1 ? loweredBodies[0]! : irSeq(loweredBodies);

  // Analyze captures
  const captures = analyzeCaptures(body, new Set(params), ctx.scope);

  // Create function
  const fnExpr = irFn(params, body, captures);

  // Return let that binds the function and returns it
  return irLet(name, fnExpr, irVar(name));
}

/**
 * Lower an effect to IR effect node
 * (print: x y) → (effect "print" x y)
 */
function lowerEffect(name: string, args: SExpr[], ctx: LoweringContext): IRExpr {
  const loweredArgs = args.map((arg) => lowerExpression(arg, ctx));
  return irEffect(name, loweredArgs);
}

/**
 * Lower if special form
 * (if cond then else) → (if cond then else)
 */
function lowerIf(args: SExpr[], ctx: LoweringContext): IRExpr {
  if (args.length !== 3) {
    throw new LoweringError(`if expects 3 arguments, got ${args.length}`);
  }

  const cond = lowerExpression(args[0]!, ctx);
  const thenExpr = lowerExpression(args[1]!, ctx);
  const elseExpr = lowerExpression(args[2]!, ctx);

  return irIf(cond, thenExpr, elseExpr);
}

/**
 * Lower and special form with short-circuit evaluation
 * (and a b) → (let $t a (if $t b $t))
 */
function lowerAnd(args: SExpr[], ctx: LoweringContext): IRExpr {
  if (args.length !== 2) {
    throw new LoweringError(`and expects 2 arguments, got ${args.length}`);
  }

  const first = lowerExpression(args[0]!, ctx);
  const temp = "$and_temp";
  const tempCtx = extendContext(ctx, [temp]);
  const second = lowerExpression(args[1]!, tempCtx);

  // (let $t a (if $t b $t))
  return irLet(temp, first, irIf(irVar(temp), second, irVar(temp)));
}

/**
 * Lower or special form with short-circuit evaluation
 * (or a b) → (let $t a (if $t $t b))
 */
function lowerOr(args: SExpr[], ctx: LoweringContext): IRExpr {
  if (args.length !== 2) {
    throw new LoweringError(`or expects 2 arguments, got ${args.length}`);
  }

  const first = lowerExpression(args[0]!, ctx);
  const temp = "$or_temp";
  const tempCtx = extendContext(ctx, [temp]);
  const second = lowerExpression(args[1]!, tempCtx);

  // (let $t a (if $t $t b))
  return irLet(temp, first, irIf(irVar(temp), irVar(temp), second));
}

/**
 * Lower a function call
 * (func arg1 arg2) → (call func arg1 arg2)
 */
function lowerCall(list: List, ctx: LoweringContext): IRExpr {
  if (list.elements.length === 0) {
    throw new LoweringError("Cannot lower empty call");
  }

  const func = lowerExpression(list.elements[0]!, ctx);
  const args = list.elements.slice(1).map((arg) => lowerExpression(arg, ctx));

  return irCall(func, args);
}

/**
 * Analyze free variables (captures) in a function body
 * Returns list of variables that are referenced but not defined locally
 */
function analyzeCaptures(
  expr: IRExpr,
  localVars: Set<string>,
  outerScope: Set<string>,
): string[] {
  const freeVars = new Set<string>();

  function visit(e: IRExpr, locals: Set<string>): void {
    switch (e.type) {
      case "const":
        // No variables
        break;

      case "var": {
        // Check if variable is free (not local but in outer scope)
        if (!locals.has(e.name) && outerScope.has(e.name)) {
          freeVars.add(e.name);
        }
        break;
      }

      case "if":
        visit(e.cond, locals);
        visit(e.thenBranch, locals);
        visit(e.else, locals);
        break;

      case "let": {
        visit(e.value, locals);
        // Body sees the new binding
        const newLocals = new Set(locals);
        newLocals.add(e.name);
        visit(e.body, newLocals);
        break;
      }

      case "seq":
        for (const subExpr of e.exprs) {
          visit(subExpr, locals);
        }
        break;

      case "call":
        visit(e.func, locals);
        for (const arg of e.args) {
          visit(arg, locals);
        }
        break;

      case "fn": {
        // Function parameters are local to the function body
        const fnLocals = new Set(locals);
        for (const param of e.params) {
          fnLocals.add(param);
        }
        visit(e.body, fnLocals);
        break;
      }

      case "effect":
        for (const arg of e.args) {
          visit(arg, locals);
        }
        break;
    }
  }

  visit(expr, localVars);
  return Array.from(freeVars).sort();
}
