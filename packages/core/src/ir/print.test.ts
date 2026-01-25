import { describe, test as it, expect } from "bun:test";
import { printIR, printModule } from "./print.ts";
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

describe("IR Printer", () => {
  describe("printIR", () => {
    it("prints const values", () => {
      expect(printIR(irConst(42))).toBe("(const 42)");
      expect(printIR(irConst(null))).toBe("(const null)");
      expect(printIR(irConst(true))).toBe("(const true)");
      expect(printIR(irConst(false))).toBe("(const false)");
      expect(printIR(irConst("hello"))).toBe('(const "hello")');
    });

    it("prints string escaping", () => {
      expect(printIR(irConst('hello\nworld'))).toBe('(const "hello\\nworld")');
      expect(printIR(irConst('say "hi"'))).toBe('(const "say \\"hi\\"")');
      expect(printIR(irConst('back\\slash'))).toBe('(const "back\\\\slash")');
    });

    it("prints regex values", () => {
      expect(printIR(irConst({ type: "regex", pattern: "\\d+", flags: "g" })))
        .toBe("(const #/\\d+/g)");
    });

    it("prints var references", () => {
      expect(printIR(irVar("x"))).toBe("(var x)");
    });

    it("prints if expressions", () => {
      const expr = irIf(
        irVar("cond"),
        irConst(1),
        irConst(2)
      );
      expect(printIR(expr)).toBe(
        "(if (var cond)\n  (const 1)\n  (const 2))"
      );
    });

    it("prints let expressions", () => {
      const expr = irLet(
        "x",
        irConst(10),
        irCall(irVar("+"), [irVar("x"), irConst(1)])
      );
      expect(printIR(expr)).toBe(
        "(let x (const 10)\n  (call (var +) (var x) (const 1)))"
      );
    });

    it("prints seq expressions", () => {
      const expr = irSeq([
        irConst(1),
        irConst(2),
        irConst(3),
      ]);
      expect(printIR(expr)).toBe(
        "(seq\n  (const 1)\n  (const 2)\n  (const 3))"
      );
    });

    it("prints empty seq", () => {
      expect(printIR(irSeq([]))).toBe("(seq)");
    });

    it("prints call expressions", () => {
      const expr = irCall(irVar("+"), [irVar("x"), irConst(1)]);
      expect(printIR(expr)).toBe("(call (var +) (var x) (const 1))");
    });

    it("prints call with no arguments", () => {
      const expr = irCall(irVar("f"), []);
      expect(printIR(expr)).toBe("(call (var f))");
    });

    it("prints fn expressions without captures", () => {
      const expr = irFn(
        ["p"],
        irCall(irVar("*"), [irVar("p"), irConst(2)]),
        []
      );
      expect(printIR(expr)).toBe(
        "(fn (p)\n  (call (var *) (var p) (const 2)))"
      );
    });

    it("prints fn expressions with captures", () => {
      const expr = irFn(
        ["p"],
        irCall(irVar("*"), [irVar("p"), irVar("TAX")]),
        ["TAX"]
      );
      expect(printIR(expr)).toBe(
        "(fn (p) [TAX]\n  (call (var *) (var p) (var TAX)))"
      );
    });

    it("prints effect expressions", () => {
      const expr = irEffect("print", [irConst("hello")]);
      expect(printIR(expr)).toBe('(effect "print" (const "hello"))');
    });

    it("prints effect with no arguments", () => {
      const expr = irEffect("debug", []);
      expect(printIR(expr)).toBe('(effect "debug")');
    });

    it("prints complex nested expressions", () => {
      // let: TAX 0.08
      // let: add_tax (fn (p) * p (+ 1 TAX))
      // (call add_tax input)
      const expr = irLet(
        "TAX",
        irConst(0.08),
        irLet(
          "add_tax",
          irFn(
            ["p"],
            irCall(irVar("*"), [
              irVar("p"),
              irCall(irVar("+"), [irConst(1), irVar("TAX")]),
            ]),
            ["TAX"]
          ),
          irCall(irVar("add_tax"), [irVar("input")])
        )
      );

      const expected = `(let TAX (const 0.08)
  (let add_tax (fn (p) [TAX]
  (call (var *) (var p) (call (var +) (const 1) (var TAX))))
    (call (var add_tax) (var input))))`;

      expect(printIR(expr)).toBe(expected);
    });
  });

  describe("printModule", () => {
    it("prints a module", () => {
      const module = irModule(
        irLet("x", irConst(10), irVar("x"))
      );
      expect(printModule(module)).toBe(
        "(let x (const 10)\n  (var x))"
      );
    });
  });
});
