import { describe, test as it, expect } from "bun:test";
import { generateBytecode, CodegenError } from "./bytecode.ts";
import { irModule, irConst, irVar, irIf, irLet, irSeq, irCall, irFn, irEffect } from "../ir/types.ts";
import { Opcode } from "../bytecode/opcodes.ts";
import { ConstantType } from "../bytecode/format.ts";

describe("Bytecode Code Generation", () => {
  describe("Constants", () => {
    it("generates CONST_NULL for null", () => {
      const module = irModule(irConst(null));
      const bytecode = generateBytecode(module);

      expect(bytecode.constantPool.constants).toHaveLength(0);
      expect(bytecode.codeSection.code[0]).toBe(Opcode.CONST_NULL);
    });

    it("generates CONST_TRUE for true", () => {
      const module = irModule(irConst(true));
      const bytecode = generateBytecode(module);

      expect(bytecode.codeSection.code[0]).toBe(Opcode.CONST_TRUE);
    });

    it("generates CONST_FALSE for false", () => {
      const module = irModule(irConst(false));
      const bytecode = generateBytecode(module);

      expect(bytecode.codeSection.code[0]).toBe(Opcode.CONST_FALSE);
    });

    it("generates CONST_ZERO for 0", () => {
      const module = irModule(irConst(0));
      const bytecode = generateBytecode(module);

      expect(bytecode.codeSection.code[0]).toBe(Opcode.CONST_ZERO);
    });

    it("generates CONST_ONE for 1", () => {
      const module = irModule(irConst(1));
      const bytecode = generateBytecode(module);

      expect(bytecode.codeSection.code[0]).toBe(Opcode.CONST_ONE);
    });

    it("generates CONST_U8 for other numbers", () => {
      const module = irModule(irConst(42));
      const bytecode = generateBytecode(module);

      expect(bytecode.constantPool.constants).toHaveLength(1);
      expect(bytecode.constantPool.constants[0]).toEqual({
        type: ConstantType.INT32,
        value: 42,
      });
      expect(bytecode.codeSection.code[0]).toBe(Opcode.CONST_U8);
      expect(bytecode.codeSection.code[1]).toBe(0); // constant index 0
    });

    it("generates CONST_U8 for strings", () => {
      const module = irModule(irConst("hello"));
      const bytecode = generateBytecode(module);

      expect(bytecode.constantPool.constants).toHaveLength(1);
      expect(bytecode.constantPool.constants[0]).toEqual({
        type: ConstantType.STRING,
        value: "hello",
      });
      expect(bytecode.codeSection.code[0]).toBe(Opcode.CONST_U8);
    });

    it("deduplicates constants", () => {
      const module = irModule(
        irSeq([irConst(42), irConst(42), irConst(42)])
      );
      const bytecode = generateBytecode(module);

      // Should only have one constant in pool
      expect(bytecode.constantPool.constants).toHaveLength(1);
    });

    it("generates FLOAT64 for non-integer numbers", () => {
      const module = irModule(irConst(3.14));
      const bytecode = generateBytecode(module);

      expect(bytecode.constantPool.constants[0]).toEqual({
        type: ConstantType.FLOAT64,
        value: 3.14,
      });
    });

    it("generates regex constants", () => {
      const module = irModule(irConst({ type: "regex", pattern: "\\d+", flags: "g" }));
      const bytecode = generateBytecode(module);

      expect(bytecode.constantPool.constants[0]).toEqual({
        type: ConstantType.REGEX,
        pattern: "\\d+",
        flags: "g",
      });
    });
  });

  describe("Variables", () => {
    it("loads local variables", () => {
      // let x 10; x
      const module = irModule(
        irLet("x", irConst(10), irVar("x"))
      );
      const bytecode = generateBytecode(module);

      // Should generate: CONST_U8 10, STORE_LOCAL 0, LOAD_LOCAL 0, RETURN
      expect(bytecode.codeSection.code).toContain(Opcode.STORE_LOCAL_U8);
      expect(bytecode.codeSection.code).toContain(Opcode.LOAD_LOCAL_U8);
    });

    it("handles parameters as locals", () => {
      // Main function takes "input" parameter
      const module = irModule(irVar("input"));
      const bytecode = generateBytecode(module);

      expect(bytecode.codeSection.code[0]).toBe(Opcode.LOAD_LOCAL_U8);
      expect(bytecode.codeSection.code[1]).toBe(0); // input is local 0
    });

    it("throws error for undefined variables", () => {
      const module = irModule(irVar("undefined_var"));

      expect(() => generateBytecode(module)).toThrow(CodegenError);
      expect(() => generateBytecode(module)).toThrow("Undefined variable");
    });
  });

  describe("If expressions", () => {
    it("generates if-then-else with jumps", () => {
      // if true 1 2
      const module = irModule(
        irIf(irConst(true), irConst(1), irConst(2))
      );
      const bytecode = generateBytecode(module);

      // Should have JUMP_IF_FALSE and JUMP opcodes
      const code = Array.from(bytecode.codeSection.code);
      expect(code).toContain(Opcode.JUMP_IF_FALSE_U8);
      expect(code).toContain(Opcode.JUMP_U8);
    });

    it("evaluates condition before branching", () => {
      const module = irModule(
        irIf(irVar("input"), irConst(1), irConst(2))
      );
      const bytecode = generateBytecode(module);

      // First instruction should load input
      expect(bytecode.codeSection.code[0]).toBe(Opcode.LOAD_LOCAL_U8);
    });
  });

  describe("Let expressions", () => {
    it("allocates locals for let bindings", () => {
      // let x 10; let y 20; (+ x y)
      const module = irModule(
        irLet("x", irConst(10),
          irLet("y", irConst(20),
            irCall(irVar("+"), [irVar("x"), irVar("y")])))
      );
      const bytecode = generateBytecode(module);

      // Check that we have 3 locals total (input, x, y)
      expect(bytecode.functionTemplates.templates[0]!.localCount).toBe(3);
    });

    it("handles shadowing correctly", () => {
      // let x 10; let x 20; x
      const module = irModule(
        irLet("x", irConst(10),
          irLet("x", irConst(20),
            irVar("x")))
      );
      const bytecode = generateBytecode(module);

      // Should allocate two different locals
      expect(bytecode.functionTemplates.templates[0]!.localCount).toBe(3); // input, x, x
    });
  });

  describe("Sequence expressions", () => {
    it("pops intermediate results", () => {
      // Simple test: a sequence should generate POPs for all but the last expression
      const module = irModule(
        irSeq([irConst(10), irConst(20), irConst(30)])
      );
      const bytecode = generateBytecode(module);

      const code = Array.from(bytecode.codeSection.code);
      // Should have at least two POP instructions
      const popCount = code.filter(b => b === Opcode.POP).length;
      expect(popCount).toBeGreaterThanOrEqual(2);
    });

    it("handles empty sequences", () => {
      const module = irModule(irSeq([]));
      const bytecode = generateBytecode(module);

      // Empty sequence returns null
      expect(bytecode.codeSection.code[0]).toBe(Opcode.CONST_NULL);
    });
  });

  describe("Function calls", () => {
    it("optimizes arithmetic operations", () => {
      // (+ 1 2)
      const module = irModule(
        irCall(irVar("+"), [irConst(1), irConst(2)])
      );
      const bytecode = generateBytecode(module);

      const code = Array.from(bytecode.codeSection.code);
      expect(code).toContain(Opcode.ADD);
    });

    it("optimizes comparison operations", () => {
      // (== 1 2)
      const module = irModule(
        irCall(irVar("=="), [irConst(1), irConst(2)])
      );
      const bytecode = generateBytecode(module);

      const code = Array.from(bytecode.codeSection.code);
      expect(code).toContain(Opcode.EQ);
    });

    it("optimizes unary operations", () => {
      // (not true)
      const module = irModule(
        irCall(irVar("not"), [irConst(true)])
      );
      const bytecode = generateBytecode(module);

      const code = Array.from(bytecode.codeSection.code);
      expect(code).toContain(Opcode.NOT);
    });

    it("optimizes null coalescing", () => {
      // (?? null 1)
      const module = irModule(
        irCall(irVar("??"), [irConst(null), irConst(1)])
      );
      const bytecode = generateBytecode(module);

      const code = Array.from(bytecode.codeSection.code);
      expect(code).toContain(Opcode.NULL_COALESCE);
    });

    it("optimizes array indexing", () => {
      // (get input 0)
      const module = irModule(
        irCall(irVar("get"), [irVar("input"), irConst(0)])
      );
      const bytecode = generateBytecode(module);

      const code = Array.from(bytecode.codeSection.code);
      expect(code).toContain(Opcode.GET_INDEX);
    });

    it("uses CALL_BUILTIN for other builtins", () => {
      // (trim "hello")
      const module = irModule(
        irCall(irVar("trim"), [irConst("hello")])
      );
      const bytecode = generateBytecode(module);

      const code = Array.from(bytecode.codeSection.code);
      expect(code).toContain(Opcode.CALL_BUILTIN_U8_U8);
      expect(bytecode.nameTable.names).toContain("trim");
    });

    it("generates regular CALL for non-builtins", () => {
      // (call func arg)
      const module = irModule(
        irLet("func", irFn(["x"], irVar("x")),
          irCall(irVar("func"), [irConst(42)]))
      );
      const bytecode = generateBytecode(module);

      const code = Array.from(bytecode.codeSection.code);
      expect(code).toContain(Opcode.CALL_U8);
    });

    it("handles multiple arguments correctly", () => {
      // (+ 1 2)
      const module = irModule(
        irCall(irVar("+"), [irConst(1), irConst(2)])
      );
      const bytecode = generateBytecode(module);

      // Should push both constants before ADD
      const code = Array.from(bytecode.codeSection.code);
      const constOneIndex = code.indexOf(Opcode.CONST_ONE);
      expect(constOneIndex).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Function expressions", () => {
    it("generates MAKE_CLOSURE", () => {
      // (fn (x) x)
      const module = irModule(
        irFn(["x"], irVar("x"))
      );
      const bytecode = generateBytecode(module);

      const code = Array.from(bytecode.codeSection.code);
      expect(code).toContain(Opcode.MAKE_CLOSURE_U8);
    });

    it("creates function template", () => {
      // (fn (x y) (+ x y))
      const module = irModule(
        irFn(["x", "y"], irCall(irVar("+"), [irVar("x"), irVar("y")]))
      );
      const bytecode = generateBytecode(module);

      // Should have 2 function templates (main + nested)
      expect(bytecode.functionTemplates.templates).toHaveLength(2);

      // Nested function should have 2 params
      const nestedFunc = bytecode.functionTemplates.templates[1];
      expect(nestedFunc!.paramCount).toBe(2);
    });

    it("handles closures with captures", () => {
      // let x 10; (fn (y) (+ x y))
      const module = irModule(
        irLet("x", irConst(10),
          irFn(["y"], irCall(irVar("+"), [irVar("x"), irVar("y")]), ["x"]))
      );
      const bytecode = generateBytecode(module);

      // Nested function should have upvalues
      const nestedFunc = bytecode.functionTemplates.templates[1];
      expect(nestedFunc!.upvalues).toHaveLength(1);
      expect(nestedFunc!.upvalues[0]!.isLocal).toBe(true);
    });

    it("compiles function body with RETURN", () => {
      const module = irModule(
        irFn(["x"], irVar("x"))
      );
      const bytecode = generateBytecode(module);

      // Nested function code should end with RETURN
      const nestedFunc = bytecode.functionTemplates.templates[1]!;
      const funcCode = bytecode.codeSection.code.slice(
        nestedFunc.codeOffset,
        nestedFunc.codeOffset + nestedFunc.codeLength
      );
      expect(funcCode[funcCode.length - 1]).toBe(Opcode.RETURN);
    });
  });

  describe("Effect expressions", () => {
    it("generates EFFECT opcode", () => {
      // (effect "print" "hello")
      const module = irModule(
        irEffect("print", [irConst("hello")])
      );
      const bytecode = generateBytecode(module);

      const code = Array.from(bytecode.codeSection.code);
      expect(code).toContain(Opcode.EFFECT_U8_U8);
      expect(bytecode.nameTable.names).toContain("print");
    });

    it("pushes arguments before effect", () => {
      // (effect "test" 1 2)
      const module = irModule(
        irEffect("test", [irConst(1), irConst(2)])
      );
      const bytecode = generateBytecode(module);

      // Should push both constants before EFFECT
      const code = Array.from(bytecode.codeSection.code);
      expect(code[0]).toBe(Opcode.CONST_ONE);
      expect(code[1]).toBe(Opcode.CONST_U8); // 2
    });
  });

  describe("Constant pool deduplication", () => {
    it("deduplicates identical numbers", () => {
      const module = irModule(
        irSeq([irConst(42), irConst(42), irConst(42)])
      );
      const bytecode = generateBytecode(module);

      expect(bytecode.constantPool.constants).toHaveLength(1);
    });

    it("deduplicates identical strings", () => {
      const module = irModule(
        irSeq([irConst("hello"), irConst("hello")])
      );
      const bytecode = generateBytecode(module);

      expect(bytecode.constantPool.constants).toHaveLength(1);
    });

    it("keeps different constants separate", () => {
      const module = irModule(
        irSeq([irConst(10), irConst(20), irConst("hello")])
      );
      const bytecode = generateBytecode(module);

      // 10, 20, and "hello" should all be in constant pool
      expect(bytecode.constantPool.constants).toHaveLength(3);
    });
  });

  describe("Name table deduplication", () => {
    it("deduplicates builtin names", () => {
      const module = irModule(
        irSeq([
          irCall(irVar("trim"), [irConst("a")]),
          irCall(irVar("trim"), [irConst("b")])
        ])
      );
      const bytecode = generateBytecode(module);

      // "trim" should appear only once
      const trimCount = bytecode.nameTable.names.filter(n => n === "trim").length;
      expect(trimCount).toBe(1);
    });

    it("deduplicates effect names", () => {
      const module = irModule(
        irSeq([
          irEffect("print", [irConst("a")]),
          irEffect("print", [irConst("b")])
        ])
      );
      const bytecode = generateBytecode(module);

      const printCount = bytecode.nameTable.names.filter(n => n === "print").length;
      expect(printCount).toBe(1);
    });
  });

  describe("Bytecode file structure", () => {
    it("sets correct magic number", () => {
      const module = irModule(irConst(42));
      const bytecode = generateBytecode(module);

      expect(bytecode.header.magic).toBe(0x50455842); // "PEXB"
    });

    it("sets version correctly", () => {
      const module = irModule(irConst(42));
      const bytecode = generateBytecode(module);

      expect(bytecode.header.versionMajor).toBe(1);
      expect(bytecode.header.versionMinor).toBe(0);
    });

    it("sets entry point to main function", () => {
      const module = irModule(irConst(42));
      const bytecode = generateBytecode(module);

      expect(bytecode.header.entryPoint).toBe(0);
    });

    it("generates valid code offsets", () => {
      const module = irModule(
        irLet("f", irFn(["x"], irVar("x")),
          irCall(irVar("f"), [irConst(42)]))
      );
      const bytecode = generateBytecode(module);

      // Main function starts at 0
      expect(bytecode.functionTemplates.templates[0]!.codeOffset).toBe(0);

      // Nested function starts after main
      const mainLen = bytecode.functionTemplates.templates[0]!.codeLength;
      expect(bytecode.functionTemplates.templates[1]!.codeOffset).toBe(mainLen);
    });
  });

  describe("Complex programs", () => {
    it("compiles recursive function", () => {
      // let fact (fn (n) (if (== n 0) 1 (* n (fact (- n 1)))));
      // (fact 5)
      const factBody = irIf(
        irCall(irVar("=="), [irVar("n"), irConst(0)]),
        irConst(1),
        irCall(irVar("*"), [
          irVar("n"),
          irCall(irVar("fact"), [
            irCall(irVar("-"), [irVar("n"), irConst(1)])
          ])
        ])
      );

      const module = irModule(
        irLet("fact", irFn(["n"], factBody, ["fact"]),
          irCall(irVar("fact"), [irConst(5)]))
      );

      const bytecode = generateBytecode(module);

      // Should compile without errors
      expect(bytecode.functionTemplates.templates).toHaveLength(2);
    });

    it("compiles nested closures", () => {
      // let x 10;
      // let f (fn (y) (fn (z) (+ (+ x y) z)));
      // ((f 20) 30)
      const module = irModule(
        irLet("x", irConst(10),
          irLet("f", irFn(["y"],
            irFn(["z"],
              irCall(irVar("+"), [
                irCall(irVar("+"), [irVar("x"), irVar("y")]),
                irVar("z")
              ]),
              ["x", "y"]
            ),
            ["x"]
          ),
            irCall(
              irCall(irVar("f"), [irConst(20)]),
              [irConst(30)]
            )))
      );

      const bytecode = generateBytecode(module);

      // Should have 3 function templates (main + 2 nested)
      expect(bytecode.functionTemplates.templates).toHaveLength(3);
    });

    it("compiles sequence of effects", () => {
      const module = irModule(
        irSeq([
          irEffect("print", [irConst("Line 1")]),
          irEffect("print", [irConst("Line 2")]),
          irEffect("print", [irConst("Line 3")])
        ])
      );

      const bytecode = generateBytecode(module);

      const code = Array.from(bytecode.codeSection.code);
      const effectCount = code.filter(b => b === Opcode.EFFECT_U8_U8).length;
      expect(effectCount).toBe(3);
    });
  });

  describe("Opcode variant selection", () => {
    it("uses U8 variant for small indices", () => {
      // Create a constant with index < 256
      const module = irModule(irConst(42));
      const bytecode = generateBytecode(module);

      expect(bytecode.codeSection.code[0]).toBe(Opcode.CONST_U8);
    });

    it("uses U8 variant for small local indices", () => {
      const module = irModule(
        irLet("x", irConst(10), irVar("x"))
      );
      const bytecode = generateBytecode(module);

      const code = Array.from(bytecode.codeSection.code);
      expect(code).toContain(Opcode.LOAD_LOCAL_U8);
      expect(code).toContain(Opcode.STORE_LOCAL_U8);
    });
  });

  describe("Edge cases", () => {
    it("handles deeply nested expressions", () => {
      // ((((1))))
      let expr: any = irConst(1);
      for (let i = 0; i < 10; i++) {
        expr = irSeq([expr]);
      }
      const module = irModule(expr);
      const bytecode = generateBytecode(module);

      // Should compile without stack overflow
      expect(bytecode.codeSection.code).toBeDefined();
    });

    it("handles many locals", () => {
      // let x1 1; let x2 2; ... let x10 10; x10
      let expr: any = irVar("x10");
      for (let i = 10; i >= 1; i--) {
        expr = irLet(`x${i}`, irConst(i), expr);
      }
      const module = irModule(expr);
      const bytecode = generateBytecode(module);

      // Should have 11 locals (input + 10 vars)
      expect(bytecode.functionTemplates.templates[0]!.localCount).toBe(11);
    });

    it("handles negation with subtraction", () => {
      // (- 5) vs (- 5 3)
      const neg = irModule(irCall(irVar("-"), [irConst(5)]));
      const sub = irModule(irCall(irVar("-"), [irConst(5), irConst(3)]));

      const negBytecode = generateBytecode(neg);
      const subBytecode = generateBytecode(sub);

      expect(Array.from(negBytecode.codeSection.code)).toContain(Opcode.NEG);
      expect(Array.from(subBytecode.codeSection.code)).toContain(Opcode.SUB);
    });

    it("handles multiple closures with same captures", () => {
      // let x 10;
      // let f1 (fn (y) (+ x y));
      // let f2 (fn (z) (* x z));
      // (+ (f1 5) (f2 3))
      const module = irModule(
        irLet("x", irConst(10),
          irLet("f1", irFn(["y"], irCall(irVar("+"), [irVar("x"), irVar("y")]), ["x"]),
            irLet("f2", irFn(["z"], irCall(irVar("*"), [irVar("x"), irVar("z")]), ["x"]),
              irCall(irVar("+"), [
                irCall(irVar("f1"), [irConst(5)]),
                irCall(irVar("f2"), [irConst(3)])
              ]))))
      );

      const bytecode = generateBytecode(module);

      // Should have 3 function templates (main + f1 + f2)
      expect(bytecode.functionTemplates.templates).toHaveLength(3);

      // Both nested functions should capture x
      expect(bytecode.functionTemplates.templates[1]!.upvalues).toHaveLength(1);
      expect(bytecode.functionTemplates.templates[2]!.upvalues).toHaveLength(1);
    });

    it("handles conditional with effects", () => {
      // if input (effect "yes") (effect "no")
      const module = irModule(
        irIf(
          irVar("input"),
          irEffect("yes", []),
          irEffect("no", [])
        )
      );

      const bytecode = generateBytecode(module);

      // Should have both effect names in name table
      expect(bytecode.nameTable.names).toContain("yes");
      expect(bytecode.nameTable.names).toContain("no");
    });

    it("compiles empty function", () => {
      // (fn () null)
      const module = irModule(
        irFn([], irConst(null))
      );

      const bytecode = generateBytecode(module);

      // Should have nested function with 0 params
      expect(bytecode.functionTemplates.templates[1]!.paramCount).toBe(0);
    });

    it("handles all comparison operators", () => {
      const ops = ["==", "!=", "<", ">", "<=", ">="];
      const expectedOpcodes = [
        Opcode.EQ,
        Opcode.NE,
        Opcode.LT,
        Opcode.GT,
        Opcode.LE,
        Opcode.GE,
      ];

      for (let i = 0; i < ops.length; i++) {
        const module = irModule(
          irCall(irVar(ops[i]!), [irConst(1), irConst(2)])
        );
        const bytecode = generateBytecode(module);
        const code = Array.from(bytecode.codeSection.code);
        expect(code).toContain(expectedOpcodes[i]!);
      }
    });

    it("handles all arithmetic operators", () => {
      const ops = ["+", "-", "*", "/", "%"];
      const expectedOpcodes = [
        Opcode.ADD,
        Opcode.SUB,
        Opcode.MUL,
        Opcode.DIV,
        Opcode.MOD,
      ];

      for (let i = 0; i < ops.length; i++) {
        const module = irModule(
          irCall(irVar(ops[i]!), [irConst(1), irConst(2)])
        );
        const bytecode = generateBytecode(module);
        const code = Array.from(bytecode.codeSection.code);
        expect(code).toContain(expectedOpcodes[i]!);
      }
    });
  });

  describe("End-to-end example", () => {
    it("compiles a complete program with all features", () => {
      // A program that demonstrates most features:
      // let TAX 0.08
      // let calc_total (fn (price quantity)
      //   let subtotal (* price quantity)
      //   let tax (* subtotal TAX)
      //   (+ subtotal tax)
      // )
      // let result (calc_total 100 3)
      // (effect "print" "Total:" result)

      const calcTotalBody = irLet(
        "subtotal",
        irCall(irVar("*"), [irVar("price"), irVar("quantity")]),
        irLet(
          "tax",
          irCall(irVar("*"), [irVar("subtotal"), irVar("TAX")]),
          irCall(irVar("+"), [irVar("subtotal"), irVar("tax")])
        )
      );

      const program = irModule(
        irLet(
          "TAX",
          irConst(0.08),
          irLet(
            "calc_total",
            irFn(["price", "quantity"], calcTotalBody, ["TAX"]),
            irLet(
              "result",
              irCall(irVar("calc_total"), [irConst(100), irConst(3)]),
              irEffect("print", [irConst("Total:"), irVar("result")])
            )
          )
        )
      );

      const bytecode = generateBytecode(program);

      // Verify structure
      expect(bytecode.header.magic).toBe(0x50455842);
      expect(bytecode.functionTemplates.templates).toHaveLength(2); // main + calc_total

      // Verify constants
      expect(bytecode.constantPool.constants.some(
        c => c.type === ConstantType.FLOAT64 && c.value === 0.08
      )).toBe(true);
      expect(bytecode.constantPool.constants.some(
        c => c.type === ConstantType.INT32 && c.value === 100
      )).toBe(true);
      expect(bytecode.constantPool.constants.some(
        c => c.type === ConstantType.INT32 && c.value === 3
      )).toBe(true);
      expect(bytecode.constantPool.constants.some(
        c => c.type === ConstantType.STRING && c.value === "Total:"
      )).toBe(true);

      // Verify names
      expect(bytecode.nameTable.names).toContain("print");

      // Verify opcodes used
      const code = Array.from(bytecode.codeSection.code);
      expect(code).toContain(Opcode.MUL);
      expect(code).toContain(Opcode.ADD);
      expect(code).toContain(Opcode.MAKE_CLOSURE_U8);
      expect(code).toContain(Opcode.CALL_U8);
      expect(code).toContain(Opcode.EFFECT_U8_U8);

      // Verify closure captures TAX
      expect(bytecode.functionTemplates.templates[1]!.upvalues).toHaveLength(1);
      expect(bytecode.functionTemplates.templates[1]!.upvalues[0]!.isLocal).toBe(true);
    });
  });
});
