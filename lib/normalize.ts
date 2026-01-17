import type * as AST from "./ast.ts";

// ============================================
// Main Normalize Function
// ============================================

export function normalize(program: AST.Program): AST.Program {
  return {
    ...program,
    statements: program.statements.map(normalizeStatement),
    expression: program.expression
      ? normalizeExpression(program.expression)
      : null,
  };
}

// ============================================
// Statement Normalization
// ============================================

function normalizeStatement(stmt: AST.Statement): AST.Statement {
  // Generic effect statement - normalize all arguments
  return {
    ...stmt,
    arguments: stmt.arguments.map(normalizeExpression),
  };
}

// ============================================
// Expression Normalization
// ============================================

function normalizeExpression(expr: AST.Expression): AST.Expression {
  switch (expr.type) {
    case "PipelineExpression":
      return normalizePipeline(expr);
    case "CallExpression":
      return {
        ...expr,
        arguments: expr.arguments.map(normalizeExpression),
      };
    case "IfExpression":
      return {
        ...expr,
        condition: normalizeExpression(expr.condition),
        consequent: normalizeExpression(expr.consequent),
        alternate: normalizeExpression(expr.alternate),
      };
    case "GroupExpression":
      return {
        ...expr,
        expression: normalizeExpression(expr.expression),
      };
    default:
      return expr; // Literals and identifiers pass through
  }
}

// ============================================
// Pipeline Normalization
// ============================================

/**
 * Normalize pipeline: a | b | c -> (c (b a))
 *
 * Each stage wraps the previous result.
 * If stage is an identifier, it becomes a call with previous as argument.
 * If stage is a call, previous is prepended to arguments.
 */
function normalizePipeline(pipeline: AST.PipelineExpression): AST.Expression {
  const stages = pipeline.stages.map(normalizeExpression);

  // Fold from left to right
  return stages.reduce((acc, stage) => {
    // Wrap: stage(acc)
    if (stage.type === "Identifier") {
      // Identifier becomes call with acc as argument
      return {
        type: "CallExpression",
        callee: stage,
        arguments: [acc],
        span: stage.span,
      } as AST.CallExpression;
    }

    if (stage.type === "CallExpression") {
      // Call: prepend acc to arguments
      return {
        ...stage,
        arguments: [acc, ...stage.arguments],
      };
    }

    if (stage.type === "GroupExpression") {
      // Grouped: check if it contains $ references
      // If it does, substitute $ with acc
      // If it doesn't, wrap the result
      if (hasValue$Ref(stage.expression)) {
        return substituteValue$(stage.expression, acc);
      }
      // No $ reference - treat as call if it's a call, otherwise identity
      if (stage.expression.type === "CallExpression") {
        return {
          ...stage.expression,
          arguments: [acc, ...stage.expression.arguments],
        };
      }
      if (stage.expression.type === "Identifier") {
        return {
          type: "CallExpression",
          callee: stage.expression,
          arguments: [acc],
          span: stage.span,
        } as AST.CallExpression;
      }
      // For other grouped expressions, just return the inner expression
      // (the pipeline value is lost)
      return stage.expression;
    }

    // Other expression types (literals): just return them (pipeline value lost)
    return stage;
  });
}

// ============================================
// $ Reference Detection and Substitution
// ============================================

/**
 * Check if expression contains $ (pipeline ref)
 */
function hasValue$Ref(expr: AST.Expression): boolean {
  if (expr.type === "Identifier") {
    return expr.isPipelineRef;
  }

  switch (expr.type) {
    case "CallExpression":
      return expr.arguments.some(hasValue$Ref);
    case "IfExpression":
      return (
        hasValue$Ref(expr.condition) ||
        hasValue$Ref(expr.consequent) ||
        hasValue$Ref(expr.alternate)
      );
    case "GroupExpression":
      return hasValue$Ref(expr.expression);
    case "PipelineExpression":
      return expr.stages.some(hasValue$Ref);
    default:
      return false;
  }
}

/**
 * Substitute $ references with the piped value
 */
function substituteValue$(
  expr: AST.Expression,
  value: AST.Expression
): AST.Expression {
  return transformExpression(expr, (node) => {
    if (node.type === "Identifier" && node.isPipelineRef) {
      return value;
    }
    return node;
  });
}

function transformExpression(
  expr: AST.Expression,
  fn: (e: AST.Expression) => AST.Expression
): AST.Expression {
  const transformed = fn(expr);
  if (transformed !== expr) return transformed;

  switch (expr.type) {
    case "CallExpression":
      return {
        ...expr,
        arguments: expr.arguments.map((arg) => transformExpression(arg, fn)),
      };
    case "IfExpression":
      return {
        ...expr,
        condition: transformExpression(expr.condition, fn),
        consequent: transformExpression(expr.consequent, fn),
        alternate: transformExpression(expr.alternate, fn),
      };
    case "GroupExpression":
      return {
        ...expr,
        expression: transformExpression(expr.expression, fn),
      };
    case "PipelineExpression":
      return {
        ...expr,
        stages: expr.stages.map((stage) => transformExpression(stage, fn)),
      };
    default:
      return expr;
  }
}

// ============================================
// Auto-Injection of $$
// ============================================

/**
 * Inject $$ as first argument if neither $, $$, nor $N appears in expression.
 * This should be called BEFORE normalizing pipelines.
 */
export function injectProgramInput(program: AST.Program): AST.Program {
  if (!program.expression) return program;

  // Check if $ or $$ or $N already present
  if (hasSourceRef(program.expression)) {
    return program;
  }

  // Inject $$ into the expression
  const expr = program.expression;
  const injected = injectIntoExpression(expr);

  return {
    ...program,
    expression: injected,
  };
}

/**
 * Inject $$ into the first stage of an expression.
 * For pipelines, inject into the first stage.
 * For calls, prepend $$ to arguments.
 * For identifiers, wrap in call with $$.
 */
function injectIntoExpression(expr: AST.Expression): AST.Expression {
  if (expr.type === "PipelineExpression") {
    // Inject into the first stage of the pipeline
    const firstStage = expr.stages[0]!;
    const injectedFirst = injectIntoExpression(firstStage);
    return {
      ...expr,
      stages: [injectedFirst, ...expr.stages.slice(1)],
    };
  }

  if (expr.type === "Identifier" && !expr.isSourceRef) {
    // `lower` -> `lower $$`
    return {
      type: "CallExpression",
      callee: expr,
      arguments: [makeProgramInputRef(expr.span)],
      span: expr.span,
    };
  }

  if (expr.type === "CallExpression") {
    // `split " "` -> `split $$ " "`
    return {
      ...expr,
      arguments: [makeProgramInputRef(expr.span), ...expr.arguments],
    };
  }

  // Other expression types: return as-is (e.g., literals don't need injection)
  return expr;
}

/**
 * Check if expression contains any source reference ($, $$, $N)
 */
function hasSourceRef(expr: AST.Expression): boolean {
  if (expr.type === "Identifier") {
    return expr.isSourceRef;
  }

  switch (expr.type) {
    case "CallExpression":
      return hasSourceRef(expr.callee) || expr.arguments.some(hasSourceRef);
    case "IfExpression":
      return (
        hasSourceRef(expr.condition) ||
        hasSourceRef(expr.consequent) ||
        hasSourceRef(expr.alternate)
      );
    case "GroupExpression":
      return hasSourceRef(expr.expression);
    case "PipelineExpression":
      return expr.stages.some(hasSourceRef);
    default:
      return false;
  }
}

function makeProgramInputRef(span: AST.SourceSpan): AST.Identifier {
  return {
    type: "Identifier",
    name: "$$",
    isSourceRef: true,
    isPipelineRef: false,
    isProgramInput: true,
    span,
  };
}
