/**
 * Tree-walking interpreter for PEX
 */

import type { SExpr, Program, Atom, List, Pipeline } from "../parser/ast.ts";
import {
  isAtom,
  isList,
  isPipeline,
  isIdentifier,
  isEffect,
  isSourceRef,
  isProgramInput,
  isPipelineRef,
  isArrayRef,
  getArrayIndex,
} from "../parser/ast.ts";
import type { Value } from "./value.ts";
import {
  nullValue,
  booleanValue,
  numberValue,
  stringValue,
  regexValue,
  functionValue,
  isFunction,
  isArray,
  isTruthy,
  displayValue,
} from "./value.ts";
import { Environment } from "./environment.ts";

export class RuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeError";
  }
}

export interface EvaluationContext {
  programInput: Value; // $$ - the original input
  pipelineValue: Value; // $ - current value in pipeline
}

export class Evaluator {
  private globalEnv: Environment;
  private context: EvaluationContext;

  constructor(globalEnv: Environment, programInput: Value) {
    this.globalEnv = globalEnv;
    this.context = {
      programInput,
      pipelineValue: programInput, // Initially $ and $$ are the same
    };
  }

  /**
   * Evaluate a complete program
   */
  evaluateProgram(program: Program): Value {
    let result: Value = nullValue();
    for (const expr of program.expressions) {
      result = this.evaluate(expr, this.globalEnv);
    }
    return result;
  }

  /**
   * Evaluate a single expression
   */
  evaluate(expr: SExpr, env: Environment): Value {
    // Handle atoms
    if (isAtom(expr)) {
      return this.evaluateAtom(expr, env);
    }

    // Handle lists (function calls, special forms, effects)
    if (isList(expr)) {
      return this.evaluateList(expr, env);
    }

    // Handle pipelines
    if (isPipeline(expr)) {
      return this.evaluatePipeline(expr, env);
    }

    throw new RuntimeError(`Unknown expression type: ${JSON.stringify(expr)}`);
  }

  /**
   * Evaluate an atom
   */
  private evaluateAtom(atom: Atom, env: Environment): Value {
    switch (atom.atomType) {
      case "null":
        return nullValue();
      case "boolean":
        return booleanValue(atom.value as boolean);
      case "number":
        return numberValue(atom.value as number);
      case "string":
        return stringValue(atom.value as string);
      case "regex": {
        const regex = atom.value as RegExp;
        return regexValue(regex.source, regex.flags);
      }
      case "identifier": {
        const name = atom.value as string;

        // Handle source references
        if (isSourceRef(atom)) {
          return this.evaluateSourceRef(atom);
        }

        // Look up variable in environment
        const value = env.get(name);
        if (value === undefined) {
          throw new RuntimeError(`Undefined variable: ${name}`);
        }
        return value;
      }
      default:
        throw new RuntimeError(`Unknown atom type: ${atom.atomType}`);
    }
  }

  /**
   * Evaluate source references ($, $$, $0, $1, etc.)
   */
  private evaluateSourceRef(atom: Atom): Value {
    const name = atom.value as string;

    if (isProgramInput(atom)) {
      return this.context.programInput;
    }

    if (isPipelineRef(atom)) {
      return this.context.pipelineValue;
    }

    if (isArrayRef(atom)) {
      const index = getArrayIndex(atom);
      if (index === undefined) {
        throw new RuntimeError(`Invalid array reference: ${name}`);
      }

      const input = this.context.programInput;
      if (!isArray(input)) {
        throw new RuntimeError(
          `Cannot use array reference ${name} when input is not an array`,
        );
      }

      if (index >= input.elements.length) {
        return nullValue(); // Out of bounds returns null
      }

      return input.elements[index]!;
    }

    throw new RuntimeError(`Unknown source reference: ${name}`);
  }

  /**
   * Evaluate a list (function call or special form)
   */
  private evaluateList(list: List, env: Environment): Value {
    if (list.elements.length === 0) {
      throw new RuntimeError("Cannot evaluate empty list");
    }

    const first = list.elements[0]!;

    // Check for effects
    if (isEffect(first)) {
      const name = first.value as string;
      return this.evaluateEffect(name, list.elements.slice(1), env);
    }

    // Check for identifiers (special forms and function calls)
    else if (isIdentifier(first)) {
      const identifierAtom: Atom = first;
      const name = identifierAtom.value as string;

      // Handle special forms
      if (name === "if") {
        return this.evaluateIf(list.elements.slice(1), env);
      }
      if (name === "and") {
        return this.evaluateAnd(list.elements.slice(1), env);
      }
      if (name === "or") {
        return this.evaluateOr(list.elements.slice(1), env);
      }

      // Handle function call
      return this.evaluateFunctionCall(first, list.elements.slice(1), env);
    }

    else {
      throw new RuntimeError(
        `First element of list must be an identifier or effect, got: ${JSON.stringify(first)}`,
      );
    }
  }

  /**
   * Evaluate a pipeline with auto-call semantics
   * Example: a | b | c
   * - Evaluate a, auto-call if function
   * - Pass result to b, auto-call if function
   * - Pass result to c, auto-call if function
   */
  private evaluatePipeline(pipeline: Pipeline, env: Environment): Value {
    if (pipeline.stages.length === 0) {
      throw new RuntimeError("Pipeline cannot be empty");
    }

    // Evaluate first stage
    let currentValue = this.evaluate(pipeline.stages[0]!, env);
    currentValue = this.maybeAutoCall(pipeline.stages[0]!, currentValue, env);

    // Process remaining stages
    for (let i = 1; i < pipeline.stages.length; i++) {
      const stage = pipeline.stages[i]!;

      // Update pipeline value context
      const previousPipelineValue = this.context.pipelineValue;
      this.context.pipelineValue = currentValue;

      // Evaluate stage with input injection
      currentValue = this.evaluatePipelineStage(stage, env);
      currentValue = this.maybeAutoCall(stage, currentValue, env);

      // Restore previous pipeline value
      this.context.pipelineValue = previousPipelineValue;
    }

    return currentValue;
  }

  /**
   * Auto-call logic: if stage is a bare identifier that evaluates to a function, call it
   */
  private maybeAutoCall(stage: SExpr, value: Value, env: Environment): Value {
    // Only auto-call if:
    // 1. Stage is a bare identifier (not a List/explicit call)
    // 2. Value is a function
    if (isIdentifier(stage) && !isSourceRef(stage) && isFunction(value)) {
      // Call with pipeline value as argument
      if (value.isBuiltin && value.builtin) {
        return value.builtin([this.context.pipelineValue]);
      }

      // User-defined function with 1 parameter
      if (value.params.length === 1) {
        const funcEnv = env.extend();
        funcEnv.define(value.params[0]!, this.context.pipelineValue);
        if (value.body === null) {
          throw new RuntimeError("Cannot evaluate function without body");
        }
        return this.evaluate(value.body, funcEnv);
      }

      // If function expects 0 or 2+ params, don't auto-call
      // Fall through and return the function value
    }

    return value;
  }

  /**
   * Evaluate a pipeline stage with input injection
   * If stage is a List (explicit call), inject pipeline value as first arg (unless $ is present)
   */
  private evaluatePipelineStage(stage: SExpr, env: Environment): Value {
    // If stage is a List (explicit call), check if we need to inject input
    if (isList(stage)) {
      // Check if the list contains $ (pipeline reference)
      const containsPipelineRef = this.containsPipelineRefInExpr(stage);

      if (!containsPipelineRef) {
        // No $ present, inject input as first argument
        if (stage.elements.length === 0) {
          throw new RuntimeError("Cannot evaluate empty list");
        }

        const func = stage.elements[0]!;
        const args = stage.elements.slice(1);

        // Create a new list with input injected as first arg after function
        const newList: List = {
          type: "List",
          elements: [func, { type: "Atom", atomType: "identifier", value: "$" }, ...args],
        };

        return this.evaluate(newList, env);
      }
    }

    // For all other cases (bare identifiers, atoms, or lists with $), just evaluate
    return this.evaluate(stage, env);
  }

  /**
   * Check if an expression contains a pipeline reference ($)
   */
  private containsPipelineRefInExpr(expr: SExpr): boolean {
    if (isAtom(expr) && isPipelineRef(expr)) {
      return true;
    }
    if (isList(expr)) {
      return expr.elements.some((e) => this.containsPipelineRefInExpr(e));
    }
    if (isPipeline(expr)) {
      return expr.stages.some((s) => this.containsPipelineRefInExpr(s));
    }
    return false;
  }

  /**
   * Evaluate an effect (let:, fn:, print:, debug:, assert:)
   */
  private evaluateEffect(effect: string, args: SExpr[], env: Environment): Value {
    // effect name no longer includes the trailing colon

    switch (effect) {
      case "let":
        return this.evaluateLet(args, env);
      case "fn":
        return this.evaluateFn(args, env);
      case "print":
        return this.evaluatePrint(args, env);
      case "debug":
        return this.evaluateDebug(args, env);
      case "assert":
        return this.evaluateAssert(args, env);
      default:
        throw new RuntimeError(`Unknown effect: ${effect}`);
    }
  }

  /**
   * Evaluate let: effect (let: NAME VALUE)
   */
  private evaluateLet(args: SExpr[], env: Environment): Value {
    if (args.length !== 2) {
      throw new RuntimeError(`let: expects 2 arguments, got ${args.length}`);
    }

    const nameExpr = args[0]!;
    if (!isIdentifier(nameExpr)) {
      throw new RuntimeError("let: first argument must be an identifier");
    }

    const name = nameExpr.value as string;
    const value = this.evaluate(args[1]!, env);

    env.define(name, value);
    return value;
  }

  /**
   * Evaluate fn: effect (fn: NAME (PARAMS...) BODY)
   * If BODY is not wrapped, it will be multiple expressions that we wrap as a list
   */
  private evaluateFn(args: SExpr[], env: Environment): Value {
    if (args.length < 3) {
      throw new RuntimeError(`fn: expects at least 3 arguments, got ${args.length}`);
    }

    const nameExpr = args[0]!;
    if (!isIdentifier(nameExpr)) {
      throw new RuntimeError("fn: first argument must be an identifier");
    }

    const name = nameExpr.value as string;

    const paramsExpr = args[1]!;
    if (!isList(paramsExpr)) {
      throw new RuntimeError("fn: second argument must be a list of parameters");
    }

    const params: string[] = [];
    for (const param of paramsExpr.elements) {
      if (!isIdentifier(param)) {
        throw new RuntimeError("fn: parameters must be identifiers");
      }
      params.push(param.value as string);
    }

    // If we have exactly 3 args, use args[2] as body
    // If we have more than 3 args, wrap them all as a list (the body expression was unwrapped)
    const body: SExpr = args.length === 3
      ? args[2]!
      : { type: "List", elements: args.slice(2) };

    const func = functionValue(name, params, body);

    env.define(name, func);
    return func;
  }

  /**
   * Evaluate print: effect
   */
  private evaluatePrint(args: SExpr[], env: Environment): Value {
    const values = args.map((arg) => this.evaluate(arg, env));
    const output = values.map((v) => displayValue(v)).join(" ");
    console.log(output);
    return values[values.length - 1] ?? nullValue();
  }

  /**
   * Evaluate debug: effect
   */
  private evaluateDebug(args: SExpr[], env: Environment): Value {
    const values = args.map((arg) => this.evaluate(arg, env));
    const output = values.map((v) => JSON.stringify(v, null, 2)).join("\n");
    console.error("[DEBUG]", output);
    return values[values.length - 1] ?? nullValue();
  }

  /**
   * Evaluate assert: effect
   */
  private evaluateAssert(args: SExpr[], env: Environment): Value {
    if (args.length === 0) {
      throw new RuntimeError("assert: expects at least 1 argument");
    }

    const value = this.evaluate(args[0]!, env);
    if (!isTruthy(value)) {
      const message =
        args.length > 1
          ? displayValue(this.evaluate(args[1]!, env))
          : "Assertion failed";
      throw new RuntimeError(`Assertion failed: ${message}`);
    }

    return value;
  }

  /**
   * Evaluate if special form (if COND THEN ELSE)
   */
  private evaluateIf(args: SExpr[], env: Environment): Value {
    if (args.length !== 3) {
      throw new RuntimeError(`if expects 3 arguments, got ${args.length}`);
    }

    const condition = this.evaluate(args[0]!, env);
    if (isTruthy(condition)) {
      return this.evaluate(args[1]!, env);
    } else {
      return this.evaluate(args[2]!, env);
    }
  }

  /**
   * Evaluate and special form with proper short-circuit evaluation
   * (and EXPR1 EXPR2)
   * Returns first falsy value or last value if all truthy
   */
  private evaluateAnd(args: SExpr[], env: Environment): Value {
    if (args.length !== 2) {
      throw new RuntimeError(`and expects 2 arguments, got ${args.length}`);
    }

    const first = this.evaluate(args[0]!, env);
    if (!isTruthy(first)) {
      return first; // Short-circuit: return first falsy value
    }
    return this.evaluate(args[1]!, env); // Return second value
  }

  /**
   * Evaluate or special form with proper short-circuit evaluation
   * (or EXPR1 EXPR2)
   * Returns first truthy value or last value if all falsy
   */
  private evaluateOr(args: SExpr[], env: Environment): Value {
    if (args.length !== 2) {
      throw new RuntimeError(`or expects 2 arguments, got ${args.length}`);
    }

    const first = this.evaluate(args[0]!, env);
    if (isTruthy(first)) {
      return first; // Short-circuit: return first truthy value
    }
    return this.evaluate(args[1]!, env); // Return second value
  }

  /**
   * Evaluate a function call
   */
  private evaluateFunctionCall(
    funcExpr: SExpr,
    argExprs: SExpr[],
    env: Environment,
  ): Value {
    const func = this.evaluate(funcExpr, env);

    if (!isFunction(func)) {
      throw new RuntimeError(
        `Cannot call non-function: ${displayValue(func)}`,
      );
    }

    // Evaluate arguments
    const args = argExprs.map((arg) => this.evaluate(arg, env));

    // Handle built-in functions
    if (func.isBuiltin && func.builtin) {
      return func.builtin(args);
    }

    // Handle user-defined functions
    if (args.length !== func.params.length) {
      throw new RuntimeError(
        `Function ${func.name ?? "<anonymous>"} expects ${func.params.length} arguments, got ${args.length}`,
      );
    }

    // Create new environment for function execution
    const funcEnv = env.extend();
    for (let i = 0; i < func.params.length; i++) {
      funcEnv.define(func.params[i]!, args[i]!);
    }

    // Evaluate function body
    if (func.body === null) {
      throw new RuntimeError("Cannot evaluate builtin function without body");
    }
    return this.evaluate(func.body, funcEnv);
  }
}

/**
 * Convenience function to evaluate a program with a given input
 */
export function evaluateProgram(
  program: Program,
  globalEnv: Environment,
  input: Value = nullValue(),
): Value {
  const evaluator = new Evaluator(globalEnv, input);
  return evaluator.evaluateProgram(program);
}
