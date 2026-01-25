import { describe, test as it, expect } from "bun:test";
import { lowerProgram, LoweringError } from "./lower.ts";
import { printModule } from "./print.ts";
import type { Program, SExpr } from "../parser/ast.ts";
import { atom, list, pipeline } from "../parser/ast.ts";

/**
 * Helper to create a program from expressions
 */
function program(...expressions: SExpr[]): Program {
  return { type: "Program", expressions };
}

describe("AST → IR Lowering", () => {
  describe("Literals", () => {
    it("lowers null", () => {
      const ast = program(atom("null", null));
      const ir = lowerProgram(ast);
      expect(printModule(ir)).toBe("(const null)");
    });

    it("lowers booleans", () => {
      const ast = program(atom("boolean", true));
      const ir = lowerProgram(ast);
      expect(printModule(ir)).toBe("(const true)");
    });

    it("lowers numbers", () => {
      const ast = program(atom("number", 42));
      const ir = lowerProgram(ast);
      expect(printModule(ir)).toBe("(const 42)");
    });

    it("lowers strings", () => {
      const ast = program(atom("string", "hello"));
      const ir = lowerProgram(ast);
      expect(printModule(ir)).toBe('(const "hello")');
    });

    it("lowers regex", () => {
      const ast = program(atom("regex", /\d+/g, "/\\d+/g"));
      const ir = lowerProgram(ast);
      expect(printModule(ir)).toBe("(const #/\\d+/g)");
    });
  });

  describe("Variables", () => {
    it("lowers variable references", () => {
      const ast = program(atom("identifier", "x"));
      const ir = lowerProgram(ast);
      expect(printModule(ir)).toBe("(var x)");
    });
  });

  describe("Source References", () => {
    it("lowers $$ to input variable", () => {
      const ast = program(atom("identifier", "$$"));
      const ir = lowerProgram(ast);
      expect(printModule(ir)).toBe("(var input)");
    });

    it("lowers $N to (call get input N)", () => {
      const ast = program(atom("identifier", "$0"));
      const ir = lowerProgram(ast);
      expect(printModule(ir)).toBe("(call (var get) (var input) (const 0))");
    });

    it("lowers $1 to (call get input 1)", () => {
      const ast = program(atom("identifier", "$1"));
      const ir = lowerProgram(ast);
      expect(printModule(ir)).toBe("(call (var get) (var input) (const 1))");
    });

    it("throws error for $ outside pipeline", () => {
      const ast = program(atom("identifier", "$"));
      expect(() => lowerProgram(ast)).toThrow(LoweringError);
      expect(() => lowerProgram(ast)).toThrow("Pipeline reference $ used outside of pipeline");
    });
  });

  describe("Function Calls", () => {
    it("lowers simple function call", () => {
      const ast = program(
        list(atom("identifier", "+"), atom("number", 1), atom("number", 2))
      );
      const ir = lowerProgram(ast);
      expect(printModule(ir)).toBe("(call (var +) (const 1) (const 2))");
    });

    it("lowers nested function calls", () => {
      const ast = program(
        list(
          atom("identifier", "+"),
          list(atom("identifier", "*"), atom("number", 2), atom("number", 3)),
          atom("number", 1)
        )
      );
      const ir = lowerProgram(ast);
      expect(printModule(ir)).toBe(
        "(call (var +) (call (var *) (const 2) (const 3)) (const 1))"
      );
    });
  });

  describe("Pipelines", () => {
    it("lowers simple pipeline with $$", () => {
      // $$ | lower
      const ast = program(
        pipeline(atom("identifier", "$$"), atom("identifier", "lower"))
      );
      const ir = lowerProgram(ast);
      // Should become: (let $pipe0 (var input) (call lower $pipe0))
      const output = printModule(ir);
      expect(output).toContain("(var input)");
      expect(output).toContain("(call (var lower)");
    });

    it("lowers multi-stage pipeline", () => {
      // $$ | lower | trim
      const ast = program(
        pipeline(
          atom("identifier", "$$"),
          atom("identifier", "lower"),
          atom("identifier", "trim")
        )
      );
      const ir = lowerProgram(ast);
      const output = printModule(ir);
      expect(output).toContain("(var input)");
      expect(output).toContain("lower");
      expect(output).toContain("trim");
    });

    it("lowers pipeline with explicit function call", () => {
      // $$ | (+ $ 1)
      const ast = program(
        pipeline(
          atom("identifier", "$$"),
          list(atom("identifier", "+"), atom("identifier", "$"), atom("number", 1))
        )
      );
      const ir = lowerProgram(ast);
      const output = printModule(ir);
      expect(output).toContain("(var input)");
      expect(output).toContain("(call (var +)");
    });

    it("lowers pipeline with argument injection", () => {
      // $$ | (+ 1) should inject $ as first arg → (+ $ 1)
      const ast = program(
        pipeline(
          atom("identifier", "$$"),
          list(atom("identifier", "+"), atom("number", 1))
        )
      );
      const ir = lowerProgram(ast);
      const output = printModule(ir);
      expect(output).toContain("(var input)");
      expect(output).toContain("(call (var +)");
    });
  });

  describe("Special Forms", () => {
    it("lowers if expression", () => {
      // (if true 1 2)
      const ast = program(
        list(
          atom("identifier", "if"),
          atom("boolean", true),
          atom("number", 1),
          atom("number", 2)
        )
      );
      const ir = lowerProgram(ast);
      expect(printModule(ir)).toContain("(if (const true)");
      expect(printModule(ir)).toContain("(const 1)");
      expect(printModule(ir)).toContain("(const 2)");
    });

    it("lowers and to if + let", () => {
      // (and a b) → (let $and_temp a (if $and_temp b $and_temp))
      const ast = program(
        list(
          atom("identifier", "and"),
          atom("identifier", "a"),
          atom("identifier", "b")
        )
      );
      const ir = lowerProgram(ast);
      const output = printModule(ir);
      expect(output).toContain("(let $and_temp (var a)");
      expect(output).toContain("(if (var $and_temp)");
      expect(output).toContain("(var b)");
    });

    it("lowers or to if + let", () => {
      // (or a b) → (let $or_temp a (if $or_temp $or_temp b))
      const ast = program(
        list(
          atom("identifier", "or"),
          atom("identifier", "a"),
          atom("identifier", "b")
        )
      );
      const ir = lowerProgram(ast);
      const output = printModule(ir);
      expect(output).toContain("(let $or_temp (var a)");
      expect(output).toContain("(if (var $or_temp)");
      expect(output).toContain("(var b)");
    });
  });

  describe("Effects", () => {
    it("lowers let: to IR let", () => {
      // (let: x 10)
      const ast = program(
        list(
          atom("effect", "let"),
          atom("identifier", "x"),
          atom("number", 10)
        )
      );
      const ir = lowerProgram(ast);
      const output = printModule(ir);
      expect(output).toContain("(let x (const 10)");
      expect(output).toContain("(var x)");
    });

    it("lowers fn: to IR let with fn", () => {
      // (fn: double (x) (* x 2))
      const ast = program(
        list(
          atom("effect", "fn"),
          atom("identifier", "double"),
          list(atom("identifier", "x")),
          list(
            atom("identifier", "*"),
            atom("identifier", "x"),
            atom("number", 2)
          )
        )
      );
      const ir = lowerProgram(ast);
      const output = printModule(ir);
      expect(output).toContain("(let double (fn (x)");
      expect(output).toContain("(call (var *) (var x) (const 2))");
    });

    it("lowers print: to effect", () => {
      // (print: "hello" x)
      const ast = program(
        list(
          atom("effect", "print"),
          atom("string", "hello"),
          atom("identifier", "x")
        )
      );
      const ir = lowerProgram(ast);
      const output = printModule(ir);
      expect(output).toContain('(effect "print"');
      expect(output).toContain('(const "hello")');
      expect(output).toContain("(var x)");
    });

    it("lowers debug: to effect", () => {
      // (debug: x)
      const ast = program(
        list(atom("effect", "debug"), atom("identifier", "x"))
      );
      const ir = lowerProgram(ast);
      expect(printModule(ir)).toContain('(effect "debug" (var x))');
    });

    it("lowers assert: to effect", () => {
      // (assert: (> x 0))
      const ast = program(
        list(
          atom("effect", "assert"),
          list(
            atom("identifier", ">"),
            atom("identifier", "x"),
            atom("number", 0)
          )
        )
      );
      const ir = lowerProgram(ast);
      const output = printModule(ir);
      expect(output).toContain('(effect "assert"');
      expect(output).toContain("(call (var >) (var x) (const 0))");
    });
  });

  describe("Closures and Captures", () => {
    it("analyzes captures for closures", () => {
      // let: TAX 0.08
      // fn: add_tax (p) (* p (+ 1 TAX))
      const ast = program(
        list(atom("effect", "let"), atom("identifier", "TAX"), atom("number", 0.08)),
        list(
          atom("effect", "fn"),
          atom("identifier", "add_tax"),
          list(atom("identifier", "p")),
          list(
            atom("identifier", "*"),
            atom("identifier", "p"),
            list(
              atom("identifier", "+"),
              atom("number", 1),
              atom("identifier", "TAX")
            )
          )
        )
      );
      const ir = lowerProgram(ast);
      const output = printModule(ir);
      expect(output).toContain("[TAX]"); // Captures TAX
      expect(output).toContain("(var TAX)");
    });

    it("does not capture parameters", () => {
      // fn: identity (x) x
      const ast = program(
        list(
          atom("effect", "fn"),
          atom("identifier", "identity"),
          list(atom("identifier", "x")),
          atom("identifier", "x")
        )
      );
      const ir = lowerProgram(ast);
      const output = printModule(ir);
      expect(output).toContain("(fn (x)"); // No captures
      expect(output).not.toContain("["); // No capture list
    });

    it("does not capture builtins", () => {
      // fn: double (x) (* x 2)
      // Builtins like * are not in outer scope, so not captured
      const ast = program(
        list(
          atom("effect", "fn"),
          atom("identifier", "double"),
          list(atom("identifier", "x")),
          list(
            atom("identifier", "*"),
            atom("identifier", "x"),
            atom("number", 2)
          )
        )
      );
      const ir = lowerProgram(ast);
      const output = printModule(ir);
      expect(output).toContain("(fn (x)"); // No captures
      expect(output).not.toContain("["); // No capture list
    });
  });

  describe("Complex Examples", () => {
    it("lowers complete program with let, fn, and pipeline", () => {
      // let: TAX 0.08
      // fn: add_tax (p) (* p (+ 1 TAX))
      // $$ | add_tax
      const ast = program(
        list(atom("effect", "let"), atom("identifier", "TAX"), atom("number", 0.08)),
        list(
          atom("effect", "fn"),
          atom("identifier", "add_tax"),
          list(atom("identifier", "p")),
          list(
            atom("identifier", "*"),
            atom("identifier", "p"),
            list(
              atom("identifier", "+"),
              atom("number", 1),
              atom("identifier", "TAX")
            )
          )
        ),
        pipeline(atom("identifier", "$$"), atom("identifier", "add_tax"))
      );
      const ir = lowerProgram(ast);
      const output = printModule(ir);

      // Should contain let for TAX
      expect(output).toContain("(let TAX (const 0.08)");

      // Should contain let for add_tax with captures
      expect(output).toContain("(let add_tax (fn (p) [TAX]");

      // Should contain the pipeline call
      expect(output).toContain("add_tax");
      expect(output).toContain("(var input)");
    });

    it("lowers nested pipelines", () => {
      // $$ | (| lower trim)
      const innerPipeline = pipeline(
        atom("identifier", "lower"),
        atom("identifier", "trim")
      );
      const ast = program(
        pipeline(atom("identifier", "$$"), innerPipeline)
      );
      const ir = lowerProgram(ast);
      const output = printModule(ir);
      expect(output).toContain("lower");
      expect(output).toContain("trim");
    });

    it("lowers multiple top-level expressions to seq", () => {
      // 1
      // 2
      // 3
      const ast = program(
        atom("number", 1),
        atom("number", 2),
        atom("number", 3)
      );
      const ir = lowerProgram(ast);
      const output = printModule(ir);
      expect(output).toContain("(seq");
      expect(output).toContain("(const 1)");
      expect(output).toContain("(const 2)");
      expect(output).toContain("(const 3)");
    });
  });

  describe("Error Handling", () => {
    it("throws error for empty list", () => {
      const ast = program(list());
      expect(() => lowerProgram(ast)).toThrow(LoweringError);
      expect(() => lowerProgram(ast)).toThrow("Cannot lower empty list");
    });

    it("throws error for empty pipeline", () => {
      const ast = program(pipeline());
      expect(() => lowerProgram(ast)).toThrow(LoweringError);
      expect(() => lowerProgram(ast)).toThrow("Pipeline cannot be empty");
    });

    it("throws error for let: with wrong number of arguments", () => {
      const ast = program(
        list(atom("effect", "let"), atom("identifier", "x"))
      );
      expect(() => lowerProgram(ast)).toThrow(LoweringError);
      expect(() => lowerProgram(ast)).toThrow("let: expects 2 or 3 arguments");
    });

    it("throws error for let: with non-identifier name", () => {
      const ast = program(
        list(atom("effect", "let"), atom("number", 1), atom("number", 2))
      );
      expect(() => lowerProgram(ast)).toThrow(LoweringError);
      expect(() => lowerProgram(ast)).toThrow("let: first argument must be an identifier");
    });

    it("throws error for fn: with wrong number of arguments", () => {
      const ast = program(
        list(atom("effect", "fn"), atom("identifier", "f"))
      );
      expect(() => lowerProgram(ast)).toThrow(LoweringError);
      expect(() => lowerProgram(ast)).toThrow("fn: expects at least 3 arguments");
    });

    it("throws error for fn: with non-identifier name", () => {
      const ast = program(
        list(
          atom("effect", "fn"),
          atom("number", 1),
          list(),
          atom("number", 2)
        )
      );
      expect(() => lowerProgram(ast)).toThrow(LoweringError);
      expect(() => lowerProgram(ast)).toThrow("fn: first argument must be an identifier");
    });

    it("throws error for fn: with non-list params", () => {
      const ast = program(
        list(
          atom("effect", "fn"),
          atom("identifier", "f"),
          atom("number", 1),
          atom("number", 2)
        )
      );
      expect(() => lowerProgram(ast)).toThrow(LoweringError);
      expect(() => lowerProgram(ast)).toThrow("fn: second argument must be a list of parameters");
    });

    it("throws error for fn: with non-identifier parameter", () => {
      const ast = program(
        list(
          atom("effect", "fn"),
          atom("identifier", "f"),
          list(atom("number", 1)),
          atom("number", 2)
        )
      );
      expect(() => lowerProgram(ast)).toThrow(LoweringError);
      expect(() => lowerProgram(ast)).toThrow("fn: parameters must be identifiers");
    });

    it("throws error for if with wrong number of arguments", () => {
      const ast = program(
        list(atom("identifier", "if"), atom("boolean", true))
      );
      expect(() => lowerProgram(ast)).toThrow(LoweringError);
      expect(() => lowerProgram(ast)).toThrow("if expects 3 arguments");
    });

    it("throws error for and with wrong number of arguments", () => {
      const ast = program(
        list(atom("identifier", "and"), atom("boolean", true))
      );
      expect(() => lowerProgram(ast)).toThrow(LoweringError);
      expect(() => lowerProgram(ast)).toThrow("and expects 2 arguments");
    });

    it("throws error for or with wrong number of arguments", () => {
      const ast = program(
        list(atom("identifier", "or"), atom("boolean", true))
      );
      expect(() => lowerProgram(ast)).toThrow(LoweringError);
      expect(() => lowerProgram(ast)).toThrow("or expects 2 arguments");
    });
  });
});
