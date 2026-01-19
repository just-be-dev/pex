/**
 * Comprehensive tests for the PEX VM.
 *
 * Tests cover:
 * - All opcodes
 * - Algebraic effects and continuations
 * - Closures and upvalues
 * - Error handling
 * - Integration with builtins
 * - Complex programs
 */

import { describe, it, expect } from "vitest";
import { VM, VMError, throwingEffectHandler, type EffectHandler, Continuation } from "./vm.ts";
import type { BytecodeFile, FunctionTemplate } from "../bytecode/format.ts";
import { Opcode } from "../bytecode/opcodes.ts";
import { ConstantType } from "../bytecode/format.ts";
import {
  nullValue,
  booleanValue,
  numberValue,
  stringValue,
  arrayValue,
  type Value,
} from "./values.ts";

/**
 * Helper to create a minimal bytecode file for testing.
 */
function createBytecode(
  code: number[],
  constants: any[] = [],
  names: string[] = [],
  templates?: FunctionTemplate[]
): BytecodeFile {
  const mainTemplate: FunctionTemplate = {
    nameIndex: -1,
    paramCount: 1, // Takes input parameter
    localCount: 1,
    upvalues: [],
    codeOffset: 0,
    codeLength: code.length,
  };

  return {
    header: {
      magic: 0x50455842,
      versionMajor: 1,
      versionMinor: 0,
      flags: 0,
      reserved: 0,
      entryPoint: 0,
      constantPoolOffset: 0,
    },
    constantPool: {
      constants: constants.map((c) => {
        if (c === null) return { type: ConstantType.NULL };
        if (typeof c === "boolean")
          return { type: c ? ConstantType.TRUE : ConstantType.FALSE };
        if (typeof c === "number") {
          if (Number.isInteger(c))
            return { type: ConstantType.INT32, value: c };
          return { type: ConstantType.FLOAT64, value: c };
        }
        if (typeof c === "string")
          return { type: ConstantType.STRING, value: c };
        if (c.pattern)
          return {
            type: ConstantType.REGEX,
            pattern: c.pattern,
            flags: c.flags,
          };
        throw new Error(`Unknown constant type: ${typeof c}`);
      }),
    },
    nameTable: { names },
    functionTemplates: {
      templates: templates || [mainTemplate],
    },
    codeSection: {
      code: new Uint8Array(code),
    },
  };
}

describe("VM - Stack Operations", () => {
  it("should execute NOP", () => {
    const bytecode = createBytecode([
      Opcode.NOP,
      Opcode.CONST_NULL,
      Opcode.RETURN,
    ]);
    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(nullValue());
  });

  it("should POP value from stack", () => {
    const bytecode = createBytecode([
      Opcode.CONST_ONE, // Push 1
      Opcode.CONST_ZERO, // Push 0
      Opcode.POP, // Pop 0
      Opcode.RETURN, // Return 1
    ]);
    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(numberValue(1));
  });

  it("should DUP top of stack", () => {
    const bytecode = createBytecode([
      Opcode.CONST_ONE, // Push 1
      Opcode.DUP, // Duplicate 1
      Opcode.ADD, // Add 1 + 1 = 2
      Opcode.RETURN,
    ]);
    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(numberValue(2));
  });

  it("should SWAP top two values", () => {
    const bytecode = createBytecode([
      Opcode.CONST_ONE, // Push 1
      Opcode.CONST_ZERO, // Push 0
      Opcode.SWAP, // Swap -> stack is now [0, 1] from bottom
      Opcode.SUB, // 0 - 1 = -1
      Opcode.RETURN,
    ]);
    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(numberValue(-1));
  });
});

describe("VM - Constants", () => {
  it("should push CONST_NULL", () => {
    const bytecode = createBytecode([Opcode.CONST_NULL, Opcode.RETURN]);
    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(nullValue());
  });

  it("should push CONST_TRUE", () => {
    const bytecode = createBytecode([Opcode.CONST_TRUE, Opcode.RETURN]);
    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(booleanValue(true));
  });

  it("should push CONST_FALSE", () => {
    const bytecode = createBytecode([Opcode.CONST_FALSE, Opcode.RETURN]);
    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(booleanValue(false));
  });

  it("should push CONST_ZERO", () => {
    const bytecode = createBytecode([Opcode.CONST_ZERO, Opcode.RETURN]);
    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(numberValue(0));
  });

  it("should push CONST_ONE", () => {
    const bytecode = createBytecode([Opcode.CONST_ONE, Opcode.RETURN]);
    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(numberValue(1));
  });

  it("should push constant from pool (u8)", () => {
    const bytecode = createBytecode(
      [
        Opcode.CONST_U8,
        0, // Index 0 in constant pool
        Opcode.RETURN,
      ],
      [42]
    );
    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(numberValue(42));
  });

  it("should push string constant", () => {
    const bytecode = createBytecode(
      [Opcode.CONST_U8, 0, Opcode.RETURN],
      ["hello"]
    );
    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(stringValue("hello"));
  });
});

describe("VM - Variables", () => {
  it("should LOAD_LOCAL (input parameter)", () => {
    const bytecode = createBytecode([
      Opcode.LOAD_LOCAL_U8,
      0, // Load local 0 (input parameter)
      Opcode.RETURN,
    ]);
    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(numberValue(42));
    expect(result).toEqual(numberValue(42));
  });

  it("should STORE_LOCAL and LOAD_LOCAL", () => {
    // Reserve space for locals by adjusting template
    const template: FunctionTemplate = {
      nameIndex: -1,
      paramCount: 1,
      localCount: 2, // input + 1 extra local
      upvalues: [],
      codeOffset: 0,
      codeLength: 0,
    };

    const code = [
      Opcode.CONST_U8,
      0, // Push 42
      Opcode.STORE_LOCAL_U8,
      1, // Store to local 1
      Opcode.LOAD_LOCAL_U8,
      1, // Load from local 1
      Opcode.RETURN,
    ];

    template.codeLength = code.length;

    const bytecode = createBytecode(code, [42], [], [template]);
    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(numberValue(42));
  });
});

describe("VM - Arithmetic", () => {
  it("should ADD two numbers", () => {
    const bytecode = createBytecode([
      Opcode.CONST_U8,
      0, // Push 10
      Opcode.CONST_U8,
      1, // Push 20
      Opcode.ADD,
      Opcode.RETURN,
    ], [10, 20]);
    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(numberValue(30));
  });

  it("should SUB two numbers", () => {
    const bytecode = createBytecode([
      Opcode.CONST_U8, 0, // 20
      Opcode.CONST_U8, 1, // 10
      Opcode.SUB,
      Opcode.RETURN,
    ], [20, 10]);
    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(numberValue(10));
  });

  it("should MUL two numbers", () => {
    const bytecode = createBytecode([
      Opcode.CONST_U8, 0, // 5
      Opcode.CONST_U8, 1, // 6
      Opcode.MUL,
      Opcode.RETURN,
    ], [5, 6]);
    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(numberValue(30));
  });

  it("should DIV two numbers", () => {
    const bytecode = createBytecode([
      Opcode.CONST_U8, 0, // 20
      Opcode.CONST_U8, 1, // 4
      Opcode.DIV,
      Opcode.RETURN,
    ], [20, 4]);
    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(numberValue(5));
  });

  it("should throw on division by zero", () => {
    const bytecode = createBytecode([
      Opcode.CONST_ONE,
      Opcode.CONST_ZERO,
      Opcode.DIV,
      Opcode.RETURN,
    ]);
    const vm = new VM(bytecode, throwingEffectHandler);
    expect(() => vm.run(nullValue())).toThrow("Division by zero");
  });

  it("should MOD two numbers", () => {
    const bytecode = createBytecode([
      Opcode.CONST_U8, 0, // 10
      Opcode.CONST_U8, 1, // 3
      Opcode.MOD,
      Opcode.RETURN,
    ], [10, 3]);
    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(numberValue(1));
  });

  it("should NEG a number", () => {
    const bytecode = createBytecode([
      Opcode.CONST_U8, 0, // 42
      Opcode.NEG,
      Opcode.RETURN,
    ], [42]);
    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(numberValue(-42));
  });
});

describe("VM - Comparison", () => {
  it("should compare with EQ (true)", () => {
    const bytecode = createBytecode([
      Opcode.CONST_U8, 0, // 5
      Opcode.CONST_U8, 0, // 5
      Opcode.EQ,
      Opcode.RETURN,
    ], [5]);
    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(booleanValue(true));
  });

  it("should compare with EQ (false)", () => {
    const bytecode = createBytecode([
      Opcode.CONST_U8, 0, // 5
      Opcode.CONST_U8, 1, // 6
      Opcode.EQ,
      Opcode.RETURN,
    ], [5, 6]);
    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(booleanValue(false));
  });

  it("should compare with NE", () => {
    const bytecode = createBytecode([
      Opcode.CONST_U8, 0, // 5
      Opcode.CONST_U8, 1, // 6
      Opcode.NE,
      Opcode.RETURN,
    ], [5, 6]);
    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(booleanValue(true));
  });

  it("should compare with LT", () => {
    const bytecode = createBytecode([
      Opcode.CONST_U8, 0, // 5
      Opcode.CONST_U8, 1, // 10
      Opcode.LT,
      Opcode.RETURN,
    ], [5, 10]);
    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(booleanValue(true));
  });

  it("should compare with GT", () => {
    const bytecode = createBytecode([
      Opcode.CONST_U8, 0, // 10
      Opcode.CONST_U8, 1, // 5
      Opcode.GT,
      Opcode.RETURN,
    ], [10, 5]);
    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(booleanValue(true));
  });

  it("should compare with LE", () => {
    const bytecode = createBytecode([
      Opcode.CONST_U8, 0, // 5
      Opcode.CONST_U8, 0, // 5
      Opcode.LE,
      Opcode.RETURN,
    ], [5]);
    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(booleanValue(true));
  });

  it("should compare with GE", () => {
    const bytecode = createBytecode([
      Opcode.CONST_U8, 0, // 10
      Opcode.CONST_U8, 1, // 5
      Opcode.GE,
      Opcode.RETURN,
    ], [10, 5]);
    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(booleanValue(true));
  });
});

describe("VM - Logic", () => {
  it("should NOT true to false", () => {
    const bytecode = createBytecode([
      Opcode.CONST_TRUE,
      Opcode.NOT,
      Opcode.RETURN,
    ]);
    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(booleanValue(false));
  });

  it("should NOT false to true", () => {
    const bytecode = createBytecode([
      Opcode.CONST_FALSE,
      Opcode.NOT,
      Opcode.RETURN,
    ]);
    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(booleanValue(true));
  });

  it("should NULL_COALESCE with null", () => {
    const bytecode = createBytecode([
      Opcode.CONST_NULL,
      Opcode.CONST_U8, 0, // 42
      Opcode.NULL_COALESCE,
      Opcode.RETURN,
    ], [42]);
    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(numberValue(42));
  });

  it("should NULL_COALESCE with non-null", () => {
    const bytecode = createBytecode([
      Opcode.CONST_U8, 0, // 10
      Opcode.CONST_U8, 1, // 42
      Opcode.NULL_COALESCE,
      Opcode.RETURN,
    ], [10, 42]);
    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(numberValue(10));
  });
});

describe("VM - Control Flow", () => {
  it("should JUMP unconditionally", () => {
    const bytecode = createBytecode([
      Opcode.JUMP_U8, 2, // Jump forward 2 bytes (relative offset from IP=2 to offset 4)
      Opcode.CONST_ZERO, // Skipped (offset 2)
      Opcode.RETURN, // Skipped (offset 3)
      Opcode.CONST_ONE, // Target (offset 4)
      Opcode.RETURN,
    ]);
    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(numberValue(1));
  });

  it("should JUMP_IF_FALSE when false", () => {
    const bytecode = createBytecode([
      Opcode.CONST_FALSE, // offset 0
      Opcode.JUMP_IF_FALSE_U8, 2, // offset 1-2, jump forward 2 bytes (from IP=3 to offset 5)
      Opcode.CONST_ZERO, // offset 3, Skipped
      Opcode.RETURN, // offset 4, Skipped
      Opcode.CONST_ONE, // offset 5, Target
      Opcode.RETURN,
    ]);
    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(numberValue(1));
  });

  it("should not JUMP_IF_FALSE when true", () => {
    const bytecode = createBytecode([
      Opcode.CONST_TRUE, // offset 0
      Opcode.JUMP_IF_FALSE_U8, 2, // offset 1-2, Would jump forward 2 bytes but condition is true
      Opcode.CONST_ONE, // offset 3, executed
      Opcode.RETURN, // offset 4
      Opcode.CONST_ZERO, // offset 5, Not reached
      Opcode.RETURN,
    ]);
    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(numberValue(1));
  });

  it("should JUMP_IF_TRUE when true", () => {
    const bytecode = createBytecode([
      Opcode.CONST_TRUE, // offset 0
      Opcode.JUMP_IF_TRUE_U8, 2, // offset 1-2, jump forward 2 bytes (from IP=3 to offset 5)
      Opcode.CONST_ZERO, // offset 3, Skipped
      Opcode.RETURN, // offset 4, Skipped
      Opcode.CONST_ONE, // offset 5, Target
      Opcode.RETURN,
    ]);
    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(numberValue(1));
  });
});

describe("VM - Functions", () => {
  it("should create and call a simple closure", () => {
    // Function: (x) => x + 1
    const funcTemplate: FunctionTemplate = {
      nameIndex: 0,
      paramCount: 1,
      localCount: 1,
      upvalues: [],
      codeOffset: 0,
      codeLength: 5,
    };

    // Main function
    const mainTemplate: FunctionTemplate = {
      nameIndex: -1,
      paramCount: 1,
      localCount: 1,
      upvalues: [],
      codeOffset: 5,
      codeLength: 9,
    };

    const code = [
      // Function code (offset 0-4):
      Opcode.LOAD_LOCAL_U8, 0, // Load parameter x
      Opcode.CONST_ONE,
      Opcode.ADD,
      Opcode.RETURN,
      // Main code (offset 5-13):
      Opcode.MAKE_CLOSURE_U8, 0, // Create closure from template 0
      Opcode.CONST_U8, 0, // Push argument 5
      Opcode.CALL_U8, 1, // Call with 1 arg
      Opcode.RETURN,
    ];

    const bytecode = createBytecode(code, [5], ["add1"], [
      funcTemplate,
      mainTemplate,
    ]);
    bytecode.header.entryPoint = 1; // Start at main

    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(numberValue(6));
  });

  it("should handle nested function calls", () => {
    // inner: (x) => x * 2
    const innerTemplate: FunctionTemplate = {
      nameIndex: 0,
      paramCount: 1,
      localCount: 1,
      upvalues: [],
      codeOffset: 0,
      codeLength: 6,
    };

    // outer: (x) => inner(x) + 1
    const outerTemplate: FunctionTemplate = {
      nameIndex: 1,
      paramCount: 1,
      localCount: 1,
      upvalues: [],
      codeOffset: 6,
      codeLength: 9,
    };

    // main
    const mainTemplate: FunctionTemplate = {
      nameIndex: -1,
      paramCount: 1,
      localCount: 1,
      upvalues: [],
      codeOffset: 15,
      codeLength: 7,
    };

    const code = [
      // inner code (0-5):
      Opcode.LOAD_LOCAL_U8, 0, // Load x parameter
      Opcode.CONST_U8, 0, // 2
      Opcode.MUL, // x * 2
      Opcode.RETURN,
      // outer code (6-14):
      Opcode.MAKE_CLOSURE_U8, 0, // Create inner closure - pushes closure onto stack
      Opcode.LOAD_LOCAL_U8, 0, // Load parameter x - now stack is [inner_closure, x]
      Opcode.CALL_U8, 1, // Call inner with 1 arg (stack: [inner_closure, x] -> result)
      Opcode.CONST_ONE, // Push 1
      Opcode.ADD, // Add result + 1
      Opcode.RETURN,
      // main code (15-21):
      Opcode.MAKE_CLOSURE_U8, 1, // Create outer closure
      Opcode.CONST_U8, 1, // Push 5
      Opcode.CALL_U8, 1, // Call outer with 1 arg
      Opcode.RETURN,
    ];

    const bytecode = createBytecode(code, [2, 5], ["inner", "outer"], [
      innerTemplate,
      outerTemplate,
      mainTemplate,
    ]);
    bytecode.header.entryPoint = 2;

    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(numberValue(11)); // (5 * 2) + 1 = 11
  });

  it("should capture upvalues in closures", () => {
    // makeAdder: (x) => (y) => x + y
    const innerTemplate: FunctionTemplate = {
      nameIndex: 1,
      paramCount: 1,
      localCount: 1,
      upvalues: [{ isLocal: true, index: 0 }], // Capture x from parent
      codeOffset: 0,
      codeLength: 6,
    };

    const outerTemplate: FunctionTemplate = {
      nameIndex: 0,
      paramCount: 1,
      localCount: 1,
      upvalues: [],
      codeOffset: 6,
      codeLength: 3,
    };

    const mainTemplate: FunctionTemplate = {
      nameIndex: -1,
      paramCount: 1,
      localCount: 1,
      upvalues: [],
      codeOffset: 9, // outer ends at 6+3=9
      codeLength: 11,
    };

    const code = [
      // inner: (y) => x + y (0-5)
      Opcode.LOAD_UPVALUE_U8, 0, // Load captured x
      Opcode.LOAD_LOCAL_U8, 0, // Load parameter y
      Opcode.ADD,
      Opcode.RETURN,
      // outer: (x) => <inner closure> (6-9)
      Opcode.MAKE_CLOSURE_U8, 0, // Create inner with captured x
      Opcode.RETURN,
      // main (10-22)
      Opcode.MAKE_CLOSURE_U8, 1, // Create makeAdder
      Opcode.CONST_U8, 0, // 10
      Opcode.CALL_U8, 1, // Call makeAdder(10) -> returns inner closure
      // Now we have add10 closure on stack
      Opcode.CONST_U8, 1, // 5
      Opcode.CALL_U8, 1, // Call add10(5)
      Opcode.RETURN,
    ];

    const bytecode = createBytecode(code, [10, 5], ["makeAdder", "inner"], [
      innerTemplate,
      outerTemplate,
      mainTemplate,
    ]);
    bytecode.header.entryPoint = 2;

    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(numberValue(15)); // 10 + 5
  });
});

describe("VM - Builtins", () => {
  it("should call builtin function", () => {
    const bytecode = createBytecode(
      [
        Opcode.CONST_U8, 0, // "hello"
        Opcode.CALL_BUILTIN_U8_U8, 0, 1, // Call upper with 1 arg
        Opcode.RETURN,
      ],
      ["hello"],
      ["upper"]
    );
    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(stringValue("HELLO"));
  });

  it("should call builtin with multiple args", () => {
    const bytecode = createBytecode(
      [
        Opcode.CONST_U8, 0, // "hello world"
        Opcode.CONST_U8, 1, // " "
        Opcode.CALL_BUILTIN_U8_U8, 0, 2, // Call split with 2 args
        Opcode.RETURN,
      ],
      ["hello world", " "],
      ["split"]
    );
    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(
      arrayValue([stringValue("hello"), stringValue("world")])
    );
  });

  it("should throw on unknown builtin", () => {
    const bytecode = createBytecode(
      [
        Opcode.CONST_ONE,
        Opcode.CALL_BUILTIN_U8_U8, 0, 1,
        Opcode.RETURN,
      ],
      [],
      ["unknownBuiltin"]
    );
    const vm = new VM(bytecode, throwingEffectHandler);
    expect(() => vm.run(nullValue())).toThrow("Unknown builtin function");
  });
});

describe("VM - Arrays", () => {
  it("should create array with MAKE_ARRAY", () => {
    const bytecode = createBytecode([
      Opcode.CONST_ONE,
      Opcode.CONST_U8, 0, // 2
      Opcode.CONST_U8, 1, // 3
      Opcode.MAKE_ARRAY_U8, 3,
      Opcode.RETURN,
    ], [2, 3]);
    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(
      arrayValue([numberValue(1), numberValue(2), numberValue(3)])
    );
  });

  it("should index array with GET_INDEX", () => {
    const bytecode = createBytecode([
      Opcode.CONST_ONE,
      Opcode.CONST_U8, 0, // 2
      Opcode.CONST_U8, 1, // 3
      Opcode.MAKE_ARRAY_U8, 3,
      Opcode.CONST_ONE, // Index 1
      Opcode.GET_INDEX,
      Opcode.RETURN,
    ], [2, 3]);
    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(numberValue(2));
  });

  it("should return null for out of bounds index", () => {
    const bytecode = createBytecode([
      Opcode.CONST_ONE,
      Opcode.MAKE_ARRAY_U8, 1,
      Opcode.CONST_U8, 0, // Index 10
      Opcode.GET_INDEX,
      Opcode.RETURN,
    ], [10]);
    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(nullValue());
  });
});

describe("VM - Algebraic Effects", () => {
  it("should capture continuation on effect", () => {
    let capturedContinuation: Continuation | null = null;
    let capturedArgs: Value[] = [];

    const effectHandler: EffectHandler = (name, args, continuation) => {
      expect(name).toBe("test");
      capturedContinuation = continuation;
      capturedArgs = args;
    };

    const bytecode = createBytecode(
      [
        Opcode.CONST_U8, 0, // "hello"
        Opcode.EFFECT_U8_U8, 0, 1, // Perform effect "test" with 1 arg
        Opcode.RETURN,
      ],
      ["hello"],
      ["test"]
    );

    const vm = new VM(bytecode, effectHandler);
    vm.run(nullValue());

    expect(capturedContinuation).not.toBeNull();
    expect(capturedArgs).toEqual([stringValue("hello")]);
  });

  it("should resume continuation with value", (done) => {
    const effectHandler: EffectHandler = (name, args, continuation) => {
      // Resume with a different value
      continuation.resume(numberValue(42));
    };

    const bytecode = createBytecode(
      [
        Opcode.CONST_U8, 0, // "input"
        Opcode.EFFECT_U8_U8, 0, 1, // Perform effect, will be resumed with 42
        Opcode.RETURN, // Return the resumed value (42)
      ],
      ["input"],
      ["read"]
    );

    const vm = new VM(bytecode, effectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(numberValue(42));
    done();
  });

  it("should continue execution after resume", (done) => {
    const effectHandler: EffectHandler = (name, args, continuation) => {
      continuation.resume(numberValue(10));
    };

    const bytecode = createBytecode(
      [
        Opcode.CONST_U8, 0, // "test"
        Opcode.EFFECT_U8_U8, 0, 1, // Perform effect, resumed with 10
        Opcode.CONST_U8, 1, // 5
        Opcode.ADD, // 10 + 5 = 15
        Opcode.RETURN,
      ],
      ["test", 5],
      ["effect"]
    );

    const vm = new VM(bytecode, effectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(numberValue(15));
    done();
  });

  it("should enforce one-shot continuation", (done) => {
    let cont: Continuation | null = null;

    const effectHandler: EffectHandler = (name, args, continuation) => {
      cont = continuation;
      continuation.resume(numberValue(1));
    };

    const bytecode = createBytecode(
      [
        Opcode.CONST_NULL,
        Opcode.EFFECT_U8_U8, 0, 1,
        Opcode.RETURN,
      ],
      [],
      ["test"]
    );

    const vm = new VM(bytecode, effectHandler);
    vm.run(nullValue());

    // Try to resume again
    expect(() => cont!.resume(numberValue(2))).toThrow(
      "already been resumed"
    );
    done();
  });

  it("should handle multiple effects in sequence", (done) => {
    let effectCount = 0;

    const effectHandler: EffectHandler = (name, args, continuation) => {
      effectCount++;
      continuation.resume(numberValue(effectCount));
    };

    const bytecode = createBytecode(
      [
        Opcode.CONST_NULL,
        Opcode.EFFECT_U8_U8, 0, 1, // First effect, resumed with 1
        Opcode.CONST_NULL,
        Opcode.EFFECT_U8_U8, 0, 1, // Second effect, resumed with 2
        Opcode.ADD, // 1 + 2 = 3
        Opcode.RETURN,
      ],
      [],
      ["test"]
    );

    const vm = new VM(bytecode, effectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(numberValue(3));
    expect(effectCount).toBe(2);
    done();
  });

  it("should handle effect in function call", (done) => {
    const effectHandler: EffectHandler = (name, args, continuation) => {
      continuation.resume(numberValue(100));
    };

    // Function that performs effect
    const funcTemplate: FunctionTemplate = {
      nameIndex: 0,
      paramCount: 0,
      localCount: 0,
      upvalues: [],
      codeOffset: 0,
      codeLength: 5,
    };

    const mainTemplate: FunctionTemplate = {
      nameIndex: -1,
      paramCount: 1,
      localCount: 1,
      upvalues: [],
      codeOffset: 5,
      codeLength: 8,
    };

    const code = [
      // Function: () => effect("read", null)
      Opcode.CONST_NULL,
      Opcode.EFFECT_U8_U8, 0, 1,
      Opcode.RETURN,
      // Main
      Opcode.MAKE_CLOSURE_U8, 0,
      Opcode.CALL_U8, 0, // Call function
      Opcode.CONST_ONE,
      Opcode.ADD, // Add result + 1
      Opcode.RETURN,
    ];

    const bytecode = createBytecode(code, [], ["read", "func"], [
      funcTemplate,
      mainTemplate,
    ]);
    bytecode.header.entryPoint = 1;

    const vm = new VM(bytecode, effectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(numberValue(101)); // 100 + 1
    done();
  });
});

describe("VM - Error Handling", () => {
  it("should throw on stack underflow", () => {
    const bytecode = createBytecode([
      Opcode.POP, // Stack is empty!
      Opcode.RETURN,
    ]);
    const vm = new VM(bytecode, throwingEffectHandler);
    expect(() => vm.run(nullValue())).toThrow("Stack underflow");
  });

  it("should throw on invalid opcode", () => {
    const bytecode = createBytecode([
      0xff, // Invalid opcode
      Opcode.RETURN,
    ]);
    const vm = new VM(bytecode, throwingEffectHandler);
    expect(() => vm.run(nullValue())).toThrow("Unknown opcode");
  });

  it("should throw on calling non-function", () => {
    const bytecode = createBytecode([
      Opcode.CONST_ONE, // Not a function
      Opcode.CALL_U8, 0,
      Opcode.RETURN,
    ]);
    const vm = new VM(bytecode, throwingEffectHandler);
    expect(() => vm.run(nullValue())).toThrow("Cannot call non-function");
  });

  it("should throw on arity mismatch", () => {
    const funcTemplate: FunctionTemplate = {
      nameIndex: 0,
      paramCount: 2, // Expects 2 args
      localCount: 2,
      upvalues: [],
      codeOffset: 0,
      codeLength: 2,
    };

    const mainTemplate: FunctionTemplate = {
      nameIndex: -1,
      paramCount: 1,
      localCount: 1,
      upvalues: [],
      codeOffset: 2,
      codeLength: 6,
    };

    const code = [
      // Function
      Opcode.CONST_NULL,
      Opcode.RETURN,
      // Main
      Opcode.MAKE_CLOSURE_U8, 0,
      Opcode.CONST_ONE,
      Opcode.CALL_U8, 1, // Only 1 arg but expects 2
      Opcode.RETURN,
    ];

    const bytecode = createBytecode(code, [], ["func"], [
      funcTemplate,
      mainTemplate,
    ]);
    bytecode.header.entryPoint = 1;

    const vm = new VM(bytecode, throwingEffectHandler);
    expect(() => vm.run(nullValue())).toThrow("expects 2 arguments, got 1");
  });

  it("should throw on indexing non-array", () => {
    const bytecode = createBytecode([
      Opcode.CONST_ONE, // Not an array
      Opcode.CONST_ZERO,
      Opcode.GET_INDEX,
      Opcode.RETURN,
    ]);
    const vm = new VM(bytecode, throwingEffectHandler);
    expect(() => vm.run(nullValue())).toThrow("Cannot index non-array");
  });
});

describe("VM - Complex Programs", () => {
  it("should compute factorial iteratively", () => {
    // factorial: (n) => {
    //   let result = 1
    //   let i = n
    //   while (i > 1) {
    //     result = result * i
    //     i = i - 1
    //   }
    //   return result
    // }
    const funcTemplate: FunctionTemplate = {
      nameIndex: 0,
      paramCount: 1,
      localCount: 3, // n, result, i
      upvalues: [],
      codeOffset: 0,
      codeLength: 31,
    };

    const mainTemplate: FunctionTemplate = {
      nameIndex: -1,
      paramCount: 1,
      localCount: 1,
      upvalues: [],
      codeOffset: 31,
      codeLength: 7,
    };

    const code = [
      // Function code:
      // result = 1 (offset 0-2)
      Opcode.CONST_ONE, // 0
      Opcode.STORE_LOCAL_U8, 1, // 1-2
      // i = n (offset 3-6)
      Opcode.LOAD_LOCAL_U8, 0, // 3-4
      Opcode.STORE_LOCAL_U8, 2, // 5-6
      // loop start (offset 7)
      Opcode.LOAD_LOCAL_U8, 2, // i (7-8)
      Opcode.CONST_ONE, // 9
      Opcode.GT, // i > 1 (10)
      Opcode.JUMP_IF_FALSE_U8, 15, // Jump forward 15 bytes (from IP=13 to offset 28) (11-12)
      // result = result * i (offset 13-19)
      Opcode.LOAD_LOCAL_U8, 1, // result (13-14)
      Opcode.LOAD_LOCAL_U8, 2, // i (15-16)
      Opcode.MUL, // 17
      Opcode.STORE_LOCAL_U8, 1, // result (18-19)
      // i = i - 1 (offset 20-25)
      Opcode.LOAD_LOCAL_U8, 2, // i (20-21)
      Opcode.CONST_ONE, // 22
      Opcode.SUB, // 23
      Opcode.STORE_LOCAL_U8, 2, // i (24-25)
      Opcode.JUMP_U8, 235, // Jump back -21 bytes (from IP=28 to offset 7) (26-27)
      // end (offset 28-30)
      Opcode.LOAD_LOCAL_U8, 1, // Load result (28-29)
      Opcode.RETURN, // 30
      // Main: (offset 31-37)
      Opcode.MAKE_CLOSURE_U8, 0, // 31-32
      Opcode.CONST_U8, 0, // 5 (33-34)
      Opcode.CALL_U8, 1, // 35-36
      Opcode.RETURN, // 37
    ];

    const bytecode = createBytecode(code, [5], ["factorial"], [
      funcTemplate,
      mainTemplate,
    ]);
    bytecode.header.entryPoint = 1;

    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(numberValue(120)); // 5! = 120
  });

  it("should handle conditional execution", () => {
    // max: (a, b) => if (a > b) a else b
    // We'll encode: load a, load b, GT, if false jump to else, load a, return, else: load b, return
    const code = [
      // Function: max(a, b) - offsets 0-11
      Opcode.LOAD_LOCAL_U8, 0, // Load a (offset 0-1)
      Opcode.LOAD_LOCAL_U8, 1, // Load b (offset 2-3)
      Opcode.GT, // a > b? (offset 4)
      Opcode.JUMP_IF_FALSE_U8, 9, // If false, jump to offset 9 (offset 5-6)
      // Then branch:
      Opcode.LOAD_LOCAL_U8, 0, // Load a (offset 7-8)
      Opcode.RETURN, // Return a (offset 9)
      // Else branch (offset 10-11, but JUMP goes to 9 which is RETURN above)
      // So we need: jump past the else when then executes
      // Let me redo this properly with a JUMP after then
    ];

    // Actually, let me encode it as: if (a > b) { return a } else { return b }
    const funcCode = [
      Opcode.LOAD_LOCAL_U8, 0, // Load a (offset 0-1)
      Opcode.LOAD_LOCAL_U8, 1, // Load b (offset 2-3)
      Opcode.GT, // a > b? (offset 4)
      Opcode.JUMP_IF_FALSE_U8, 3, // If false, jump forward 3 bytes (from IP=7 to offset 10) (offset 5-6)
      // Then branch:
      Opcode.LOAD_LOCAL_U8, 0, // Load a (offset 7-8)
      Opcode.RETURN, // Return a (offset 9)
      // Else branch starts at offset 10:
      Opcode.LOAD_LOCAL_U8, 1, // Load b (offset 10-11)
      Opcode.RETURN, // Return b (offset 12)
    ];

    const mainCode = [
      Opcode.MAKE_CLOSURE_U8, 0,
      Opcode.CONST_U8, 0, // 10
      Opcode.CONST_U8, 1, // 20
      Opcode.CALL_U8, 2,
      Opcode.RETURN,
    ];

    const funcTemplate: FunctionTemplate = {
      nameIndex: 0,
      paramCount: 2,
      localCount: 2,
      upvalues: [],
      codeOffset: 0,
      codeLength: funcCode.length,
    };

    const mainTemplate: FunctionTemplate = {
      nameIndex: -1,
      paramCount: 1,
      localCount: 1,
      upvalues: [],
      codeOffset: funcCode.length,
      codeLength: mainCode.length,
    };

    const allCode = [...funcCode, ...mainCode];

    const bytecode = createBytecode(allCode, [10, 20], ["max"], [
      funcTemplate,
      mainTemplate,
    ]);
    bytecode.header.entryPoint = 1;

    const vm = new VM(bytecode, throwingEffectHandler);
    const result = vm.run(nullValue());
    expect(result).toEqual(numberValue(20));
  });
});
