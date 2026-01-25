import { describe, test as it, expect } from "bun:test";
import {
  disassemble,
  disassembleFunction,
  disassembleInstruction,
} from "./disassembler";
import type { BytecodeFile } from "./format";
import {
  MAGIC_NUMBER,
  VERSION_MAJOR,
  VERSION_MINOR,
  HeaderFlags,
  ConstantType,
} from "./format";
import { Opcode } from "./opcodes";

/**
 * Helper to create a simple bytecode file for testing.
 */
function createTestBytecodeFile(): BytecodeFile {
  return {
    header: {
      magic: MAGIC_NUMBER,
      versionMajor: VERSION_MAJOR,
      versionMinor: VERSION_MINOR,
      flags: HeaderFlags.NONE,
      reserved: 0,
      entryPoint: 0,
      constantPoolOffset: 0,
    },
    constantPool: {
      constants: [
        { type: ConstantType.NULL },
        { type: ConstantType.TRUE },
        { type: ConstantType.FALSE },
        { type: ConstantType.INT32, value: 42 },
        { type: ConstantType.FLOAT64, value: 3.14159 },
        { type: ConstantType.STRING, value: "hello" },
        { type: ConstantType.REGEX, pattern: "\\d+", flags: "g" },
      ],
    },
    nameTable: {
      names: ["main", "add", "x", "y"],
    },
    functionTemplates: {
      templates: [
        {
          nameIndex: 0, // "main"
          paramCount: 0,
          localCount: 2,
          upvalues: [],
          codeOffset: 0,
          codeLength: 10,
        },
      ],
    },
    codeSection: {
      code: new Uint8Array([
        Opcode.CONST_U8,
        3, // Load constant 3 (42)
        Opcode.STORE_LOCAL_U8,
        0, // Store to local 0
        Opcode.LOAD_LOCAL_U8,
        0, // Load local 0
        Opcode.CONST_ONE, // Push 1
        Opcode.ADD, // Add
        Opcode.POP, // Pop result
        Opcode.RETURN, // Return
      ]),
    },
  };
}

describe("disassembler", () => {
  describe("disassembleInstruction", () => {
    it("disassembles instructions without operands", () => {
      const code = new Uint8Array([Opcode.RETURN]);
      const result = disassembleInstruction(code, 0, []);

      expect(result.text).toBe("RETURN");
      expect(result.size).toBe(1);
    });

    it("disassembles instructions with u8 operands", () => {
      const code = new Uint8Array([Opcode.CONST_U8, 42]);
      const result = disassembleInstruction(code, 0, []);

      expect(result.text).toBe("CONST_U8 42");
      expect(result.size).toBe(2);
    });

    it("disassembles instructions with u16 operands", () => {
      const code = new Uint8Array([Opcode.CONST_U16, 0x12, 0x34]);
      const result = disassembleInstruction(code, 0, []);

      expect(result.text).toBe("CONST_U16 4660"); // 0x1234 = 4660
      expect(result.size).toBe(3);
    });

    it("disassembles instructions with u32 operands", () => {
      const code = new Uint8Array([
        Opcode.CONST_U32,
        0x12,
        0x34,
        0x56,
        0x78,
      ]);
      const result = disassembleInstruction(code, 0, []);

      expect(result.text).toBe("CONST_U32 305419896"); // 0x12345678
      expect(result.size).toBe(5);
    });

    it("disassembles CALL_BUILTIN with name and arg count", () => {
      const code = new Uint8Array([Opcode.CALL_BUILTIN_U8_U8, 1, 3]);
      const names = ["foo", "print", "add"];
      const result = disassembleInstruction(code, 0, names);

      expect(result.text).toBe('CALL_BUILTIN "print" 3');
      expect(result.size).toBe(3);
    });

    it("disassembles EFFECT with name and arg count", () => {
      const code = new Uint8Array([Opcode.EFFECT_U8_U8, 0, 2]);
      const names = ["read"];
      const result = disassembleInstruction(code, 0, names);

      expect(result.text).toBe('EFFECT "read" 2');
      expect(result.size).toBe(3);
    });

    it("handles invalid opcodes", () => {
      const code = new Uint8Array([0xff]);
      const result = disassembleInstruction(code, 0, []);

      expect(result.text).toContain("invalid opcode");
      expect(result.size).toBe(1);
    });

    it("handles end of code", () => {
      const code = new Uint8Array([]);
      const result = disassembleInstruction(code, 0, []);

      expect(result.text).toBe("<end of code>");
      expect(result.size).toBe(0);
    });

    it("handles truncated operands", () => {
      const code = new Uint8Array([Opcode.CONST_U8]); // Missing operand
      const result = disassembleInstruction(code, 0, []);

      // Disassembler will report the incomplete instruction
      // Size is 1 because we can't read the full operand
      expect(result.size).toBe(1);
      expect(result.text).toContain("CONST");
    });
  });

  describe("disassembleFunction", () => {
    it("disassembles a function with instructions", () => {
      const file = createTestBytecodeFile();
      const output = disassembleFunction(file, 0);

      expect(output).toContain("Function 0: main");
      expect(output).toContain("params: 0");
      expect(output).toContain("locals: 2");
      expect(output).toContain("0000: CONST_U8 3");
      expect(output).toContain("0002: STORE_LOCAL_U8 0");
      expect(output).toContain("0004: LOAD_LOCAL_U8 0");
      expect(output).toContain("0006: CONST_ONE");
      expect(output).toContain("0007: ADD");
      expect(output).toContain("0008: POP");
      expect(output).toContain("0009: RETURN");
    });

    it("shows upvalue information", () => {
      const file: BytecodeFile = {
        ...createTestBytecodeFile(),
        functionTemplates: {
          templates: [
            {
              nameIndex: 1, // "add"
              paramCount: 2,
              localCount: 3,
              upvalues: [
                { isLocal: true, index: 0 },
                { isLocal: false, index: 1 },
              ],
              codeOffset: 0,
              codeLength: 1,
            },
          ],
        },
        codeSection: {
          code: new Uint8Array([Opcode.RETURN]),
        },
      };

      const output = disassembleFunction(file, 0);

      expect(output).toContain("upvalues: 2");
      expect(output).toContain("Upvalues:");
      expect(output).toContain("0: local[0]");
      expect(output).toContain("1: upvalue[1]");
    });

    it("handles anonymous functions", () => {
      const file: BytecodeFile = {
        ...createTestBytecodeFile(),
        functionTemplates: {
          templates: [
            {
              nameIndex: -1, // Anonymous
              paramCount: 0,
              localCount: 0,
              upvalues: [],
              codeOffset: 0,
              codeLength: 1,
            },
          ],
        },
        codeSection: {
          code: new Uint8Array([Opcode.RETURN]),
        },
      };

      const output = disassembleFunction(file, 0);

      expect(output).toContain("Function 0: <anonymous>");
    });

    it("includes stack effect comments", () => {
      const file = createTestBytecodeFile();
      const output = disassembleFunction(file, 0);

      // Stack effects should be shown as comments
      expect(output).toContain("; a, b -> a+b"); // ADD instruction
      expect(output).toContain("; a ->"); // POP instruction
    });
  });

  describe("disassemble", () => {
    it("disassembles a complete bytecode file", () => {
      const file = createTestBytecodeFile();
      const output = disassemble(file);

      // Header
      expect(output).toContain("=== Bytecode File ===");
      expect(output).toContain("Magic: PEXB");
      expect(output).toContain(`Version: ${VERSION_MAJOR}.${VERSION_MINOR}`);
      expect(output).toContain("Entry Point: 0");

      // Constants
      expect(output).toContain("=== Constants (7) ===");
      expect(output).toContain("0: null");
      expect(output).toContain("1: true");
      expect(output).toContain("2: false");
      expect(output).toContain("3: 42");
      expect(output).toContain("4: 3.14159");
      expect(output).toContain('5: "hello"');
      expect(output).toContain("6: /\\d+/g");

      // Names
      expect(output).toContain("=== Names (4) ===");
      expect(output).toContain("0: main");
      expect(output).toContain("1: add");
      expect(output).toContain("2: x");
      expect(output).toContain("3: y");

      // Functions
      expect(output).toContain("=== Functions (1) ===");
      expect(output).toContain("Function 0: main");
    });

    it("includes debug info when present", () => {
      const file: BytecodeFile = {
        ...createTestBytecodeFile(),
        header: {
          ...createTestBytecodeFile().header,
          flags: HeaderFlags.HAS_DEBUG_INFO,
        },
        debugInfo: {
          functions: [
            {
              functionIndex: 0,
              localNames: ["x", "y"],
              instructions: [
                {
                  byteOffset: 0,
                  sourceLocation: { line: 10, column: 5 },
                },
                {
                  byteOffset: 2,
                  sourceLocation: { line: 11, column: 8 },
                },
              ],
            },
          ],
        },
      };

      const output = disassemble(file);

      expect(output).toContain("=== Debug Info ===");
      expect(output).toContain("Function 0:");
      expect(output).toContain("Locals:");
      expect(output).toContain("0: x");
      expect(output).toContain("1: y");
      expect(output).toContain("Source locations:");
      expect(output).toContain("Offset 0: line 10, col 5");
      expect(output).toContain("Offset 2: line 11, col 8");
    });

    it("shows header flags correctly", () => {
      const file: BytecodeFile = {
        ...createTestBytecodeFile(),
        header: {
          ...createTestBytecodeFile().header,
          flags: HeaderFlags.HAS_DEBUG_INFO,
        },
      };

      const output = disassemble(file);

      expect(output).toContain("Flags: HAS_DEBUG_INFO");
    });

    it("handles empty bytecode file", () => {
      const file: BytecodeFile = {
        header: {
          magic: MAGIC_NUMBER,
          versionMajor: VERSION_MAJOR,
          versionMinor: VERSION_MINOR,
          flags: HeaderFlags.NONE,
          reserved: 0,
          entryPoint: 0,
          constantPoolOffset: 0,
        },
        constantPool: {
          constants: [],
        },
        nameTable: {
          names: [],
        },
        functionTemplates: {
          templates: [],
        },
        codeSection: {
          code: new Uint8Array([]),
        },
      };

      const output = disassemble(file);

      expect(output).toContain("=== Constants (0) ===");
      expect(output).toContain("=== Names (0) ===");
      expect(output).toContain("=== Functions (0) ===");
    });

    it("limits debug info source locations display", () => {
      const file: BytecodeFile = {
        ...createTestBytecodeFile(),
        header: {
          ...createTestBytecodeFile().header,
          flags: HeaderFlags.HAS_DEBUG_INFO,
        },
        debugInfo: {
          functions: [
            {
              functionIndex: 0,
              localNames: [],
              instructions: Array.from({ length: 20 }, (_, i) => ({
                byteOffset: i * 2,
                sourceLocation: { line: i + 1, column: 0 },
              })),
            },
          ],
        },
      };

      const output = disassemble(file);

      // Should show first 5 and indicate more
      expect(output).toContain("... (15 more)");
    });
  });
});
