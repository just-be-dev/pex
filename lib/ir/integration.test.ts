import { describe, test as it, expect } from "bun:test";
import { parse } from "../parser/index.ts";
import { lowerProgram } from "./lower.ts";
import { printModule } from "./print.ts";

describe("AST → IR Integration", () => {
  it("lowers simple literal", () => {
    const source = "42";
    const ast = parse(source);
    const ir = lowerProgram(ast);
    expect(printModule(ir)).toBe("(const 42)");
  });

  it("lowers $$ reference", () => {
    const source = "$$";
    const ast = parse(source);
    const ir = lowerProgram(ast);
    expect(printModule(ir)).toBe("(var input)");
  });

  it("lowers array reference", () => {
    const source = "$0";
    const ast = parse(source);
    const ir = lowerProgram(ast);
    expect(printModule(ir)).toBe("(call (var get) (var input) (const 0))");
  });

  it("lowers simple function call", () => {
    const source = "(+ 1 2)";
    const ast = parse(source);
    const ir = lowerProgram(ast);
    expect(printModule(ir)).toBe("(call (var +) (const 1) (const 2))");
  });

  it("lowers simple pipeline", () => {
    const source = "$$ | lower";
    const ast = parse(source);
    const ir = lowerProgram(ast);
    const output = printModule(ir);
    expect(output).toContain("(var input)");
    expect(output).toContain("lower");
  });

  it("lowers multi-stage pipeline", () => {
    const source = "$$ | lower | trim";
    const ast = parse(source);
    const ir = lowerProgram(ast);
    const output = printModule(ir);
    expect(output).toContain("(var input)");
    expect(output).toContain("lower");
    expect(output).toContain("trim");
  });

  it("lowers if expression", () => {
    const source = "(if true 1 2)";
    const ast = parse(source);
    const ir = lowerProgram(ast);
    const output = printModule(ir);
    expect(output).toContain("(if");
    expect(output).toContain("(const true)");
    expect(output).toContain("(const 1)");
    expect(output).toContain("(const 2)");
  });

  it("lowers and expression", () => {
    const source = "(and x y)";
    const ast = parse(source);
    const ir = lowerProgram(ast);
    const output = printModule(ir);
    expect(output).toContain("(let $and_temp");
    expect(output).toContain("(var x)");
    expect(output).toContain("(if");
    expect(output).toContain("(var y)");
  });

  it("lowers or expression", () => {
    const source = "(or x y)";
    const ast = parse(source);
    const ir = lowerProgram(ast);
    const output = printModule(ir);
    expect(output).toContain("(let $or_temp");
    expect(output).toContain("(var x)");
    expect(output).toContain("(if");
    expect(output).toContain("(var y)");
  });

  it("lowers let: effect", () => {
    const source = "let: x 10";
    const ast = parse(source);
    const ir = lowerProgram(ast);
    const output = printModule(ir);
    expect(output).toContain("(let x (const 10)");
  });

  it("lowers fn: effect", () => {
    const source = "fn: double (x) (* x 2)";
    const ast = parse(source);
    const ir = lowerProgram(ast);
    const output = printModule(ir);
    expect(output).toContain("(let double");
    expect(output).toContain("(fn (x)");
    expect(output).toContain("(call (var *) (var x) (const 2))");
  });

  it("lowers print: effect", () => {
    const source = 'print: "hello"';
    const ast = parse(source);
    const ir = lowerProgram(ast);
    const output = printModule(ir);
    expect(output).toContain('(effect "print"');
    expect(output).toContain('(const "hello")');
  });

  it("lowers closure with captures", () => {
    // Use semicolons for multiple statements in single line
    const source = "let: TAX 0.08; fn: add_tax (p) (* p (+ 1 TAX))";
    const ast = parse(source);
    const ir = lowerProgram(ast);
    const output = printModule(ir);
    expect(output).toContain("(let TAX (const 0.08)");
    expect(output).toContain("(fn (p) [TAX]");
    expect(output).toContain("(var TAX)");
  });

  it("lowers complete program with pipeline", () => {
    // Use semicolons for multiple statements in single line
    const source = "let: TAX 0.08; fn: add_tax (p) (* p (+ 1 TAX)); $$ | add_tax";
    const ast = parse(source);
    const ir = lowerProgram(ast);
    const output = printModule(ir);

    // Check structure
    expect(output).toContain("(seq");
    expect(output).toContain("(let TAX");
    expect(output).toContain("(let add_tax");
    expect(output).toContain("(fn (p) [TAX]");
    expect(output).toContain("add_tax");
    expect(output).toContain("(var input)");
  });

  it("lowers nested function calls", () => {
    const source = "(+ (* 2 3) 1)";
    const ast = parse(source);
    const ir = lowerProgram(ast);
    const output = printModule(ir);
    expect(output).toBe(
      "(call (var +) (call (var *) (const 2) (const 3)) (const 1))"
    );
  });

  it("lowers regex literal", () => {
    const source = "/\\d+/g";
    const ast = parse(source);
    const ir = lowerProgram(ast);
    expect(printModule(ir)).toBe("(const #/\\d+/g)");
  });

  it("lowers multiple expressions to seq", () => {
    const source = "1; 2; 3";
    const ast = parse(source);
    const ir = lowerProgram(ast);
    const output = printModule(ir);
    expect(output).toContain("(seq");
    expect(output).toContain("(const 1)");
    expect(output).toContain("(const 2)");
    expect(output).toContain("(const 3)");
  });

  it("lowers pipeline with explicit $ reference", () => {
    const source = "$$ | (+ $ 10)";
    const ast = parse(source);
    const ir = lowerProgram(ast);
    const output = printModule(ir);
    expect(output).toContain("(var input)");
    expect(output).toContain("(call (var +)");
    expect(output).toContain("(const 10)");
  });

  it("desugars complex nested structures", () => {
    const source = 'let: x 10; fn: double (n) (* n 2); x | double | (+ $ 5)';
    const ast = parse(source);
    const ir = lowerProgram(ast);
    const output = printModule(ir);

    expect(output).toContain("(let x");
    expect(output).toContain("(let double");
    expect(output).toContain("(fn (n)");
    expect(output).toContain("double");
  });
});
