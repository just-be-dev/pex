/**
 * IR Printer - produces human-readable S-expression output for debugging
 *
 * Format: (type arg1 arg2 ...)
 * Examples:
 *   (const 42)
 *   (var x)
 *   (if cond then else)
 *   (let x (const 10) (call + (var x) (const 1)))
 *   (fn (p) (call * (var p) (const 2)))
 *   (effect "print" (const "hello"))
 */

import type {
  IRExpr,
  IRModule,
  ConstValue,
} from "./types.ts";

/**
 * Print a constant value
 */
function printConstValue(value: ConstValue): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "string") {
    // Escape special characters in strings
    const escaped = value
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t");
    return `"${escaped}"`;
  }
  // Regex
  return `#/${value.pattern}/${value.flags}`;
}

/**
 * Print an IR expression with proper indentation
 */
function printExpr(expr: IRExpr, indent: number = 0): string {
  const spaces = " ".repeat(indent);

  switch (expr.type) {
    case "const":
      return `${spaces}(const ${printConstValue(expr.value)})`;

    case "var":
      return `${spaces}(var ${expr.name})`;

    case "if": {
      const cond = printExpr(expr.cond, 0);
      const thenBranch = printExpr(expr.thenBranch, 0);
      const elseBranch = printExpr(expr.else, 0);
      return `${spaces}(if ${cond}\n${spaces}  ${thenBranch}\n${spaces}  ${elseBranch})`;
    }

    case "let": {
      const value = printExpr(expr.value, 0);
      const body = printExpr(expr.body, indent + 2);
      return `${spaces}(let ${expr.name} ${value}\n${body})`;
    }

    case "seq": {
      if (expr.exprs.length === 0) {
        return `${spaces}(seq)`;
      }
      const exprs = expr.exprs
        .map((e) => printExpr(e, indent + 2))
        .join("\n");
      return `${spaces}(seq\n${exprs})`;
    }

    case "call": {
      const func = printExpr(expr.func, 0);
      if (expr.args.length === 0) {
        return `${spaces}(call ${func})`;
      }
      const args = expr.args.map((arg) => printExpr(arg, 0)).join(" ");
      return `${spaces}(call ${func} ${args})`;
    }

    case "fn": {
      const params = expr.params.join(" ");
      const body = printExpr(expr.body, indent + 2);
      if (expr.captures.length === 0) {
        return `${spaces}(fn (${params})\n${body})`;
      }
      const captures = expr.captures.join(" ");
      return `${spaces}(fn (${params}) [${captures}]\n${body})`;
    }

    case "effect": {
      if (expr.args.length === 0) {
        return `${spaces}(effect "${expr.name}")`;
      }
      const args = expr.args.map((arg) => printExpr(arg, 0)).join(" ");
      return `${spaces}(effect "${expr.name}" ${args})`;
    }
  }
}

/**
 * Print an IR expression as a human-readable S-expression string
 */
export function printIR(expr: IRExpr): string {
  return printExpr(expr, 0);
}

/**
 * Print an IR module as a human-readable S-expression string
 */
export function printModule(module: IRModule): string {
  return printIR(module.body);
}
