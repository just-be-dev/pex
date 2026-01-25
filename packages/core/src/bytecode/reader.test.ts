import { describe, test as it, expect } from "bun:test";
import { readBytecode, BytecodeReadError } from "./reader";
import {
  MAGIC_NUMBER,
  VERSION_MAJOR,
  VERSION_MINOR,
  HeaderFlags,
  ConstantType,
} from "./format";

/**
 * Helper to create a bytecode writer for testing.
 */
class TestBytecodeWriter {
  private bytes: number[] = [];

  writeU8(value: number): void {
    this.bytes.push(value & 0xff);
  }

  writeU16(value: number): void {
    this.bytes.push(value & 0xff);
    this.bytes.push((value >> 8) & 0xff);
  }

  writeU32(value: number): void {
    this.bytes.push(value & 0xff);
    this.bytes.push((value >> 8) & 0xff);
    this.bytes.push((value >> 16) & 0xff);
    this.bytes.push((value >> 24) & 0xff);
  }

  writeI32(value: number): void {
    this.writeU32(value >>> 0);
  }

  writeF64(value: number): void {
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setFloat64(0, value, true); // little-endian
    for (let i = 0; i < 8; i++) {
      this.bytes.push(view.getUint8(i));
    }
  }

  writeString(value: string): void {
    const encoded = new TextEncoder().encode(value);
    this.writeU32(encoded.length);
    for (let i = 0; i < encoded.length; i++) {
      this.bytes.push(encoded[i]!);
    }
  }

  toUint8Array(): Uint8Array {
    return new Uint8Array(this.bytes);
  }
}

/**
 * Create a minimal valid bytecode file for testing.
 */
function createMinimalBytecode(): Uint8Array {
  const writer = new TestBytecodeWriter();

  // Header (16 bytes)
  writer.writeU32(MAGIC_NUMBER);
  writer.writeU8(VERSION_MAJOR);
  writer.writeU8(VERSION_MINOR);
  writer.writeU8(HeaderFlags.NONE);
  writer.writeU8(0); // reserved
  writer.writeU32(0); // entry point
  writer.writeU32(0); // constant pool offset (unused)

  // Constant pool (empty)
  writer.writeU32(0); // count

  // Name table (empty)
  writer.writeU32(0); // count

  // Function templates (one entry point function)
  writer.writeU32(1); // count
  writer.writeI32(-1); // nameIndex (anonymous)
  writer.writeU32(0); // paramCount
  writer.writeU32(0); // localCount
  writer.writeU32(0); // upvalue count
  writer.writeU32(0); // codeOffset
  writer.writeU32(1); // codeLength

  // Code section (minimal: just a RETURN)
  writer.writeU32(1); // code length
  writer.writeU8(0x30); // RETURN opcode

  return writer.toUint8Array();
}

describe("BytecodeReader", () => {
  describe("readBytecode", () => {
    it("reads a minimal valid bytecode file", () => {
      const bytes = createMinimalBytecode();
      const file = readBytecode(bytes);

      expect(file.header.magic).toBe(MAGIC_NUMBER);
      expect(file.header.versionMajor).toBe(VERSION_MAJOR);
      expect(file.header.versionMinor).toBe(VERSION_MINOR);
      expect(file.header.flags).toBe(HeaderFlags.NONE);
      expect(file.header.entryPoint).toBe(0);

      expect(file.constantPool.constants).toHaveLength(0);
      expect(file.nameTable.names).toHaveLength(0);
      expect(file.functionTemplates.templates).toHaveLength(1);
      expect(file.codeSection.code).toHaveLength(1);
      expect(file.debugInfo).toBeUndefined();
    });

    it("validates magic number", () => {
      const writer = new TestBytecodeWriter();
      writer.writeU32(0xdeadbeef); // wrong magic
      writer.writeU8(VERSION_MAJOR);
      writer.writeU8(VERSION_MINOR);
      writer.writeU8(0);
      writer.writeU8(0);
      writer.writeU32(0);
      writer.writeU32(0);

      expect(() => readBytecode(writer.toUint8Array())).toThrow(
        BytecodeReadError
      );
      expect(() => readBytecode(writer.toUint8Array())).toThrow(/magic number/);
    });

    it("validates version compatibility", () => {
      const writer = new TestBytecodeWriter();
      writer.writeU32(MAGIC_NUMBER);
      writer.writeU8(99); // incompatible major version
      writer.writeU8(0);
      writer.writeU8(0);
      writer.writeU8(0);
      writer.writeU32(0);
      writer.writeU32(0);

      expect(() => readBytecode(writer.toUint8Array())).toThrow(
        BytecodeReadError
      );
      expect(() => readBytecode(writer.toUint8Array())).toThrow(/version/);
    });

    it("handles truncated header", () => {
      const writer = new TestBytecodeWriter();
      writer.writeU32(MAGIC_NUMBER);
      writer.writeU8(VERSION_MAJOR);
      // Truncated - missing rest of header

      expect(() => readBytecode(writer.toUint8Array())).toThrow(
        BytecodeReadError
      );
      expect(() => readBytecode(writer.toUint8Array())).toThrow(/end of bytecode/);
    });

    it("reads constants correctly", () => {
      const writer = new TestBytecodeWriter();

      // Header
      writer.writeU32(MAGIC_NUMBER);
      writer.writeU8(VERSION_MAJOR);
      writer.writeU8(VERSION_MINOR);
      writer.writeU8(HeaderFlags.NONE);
      writer.writeU8(0);
      writer.writeU32(0);
      writer.writeU32(0);

      // Constant pool
      writer.writeU32(7); // 7 constants
      writer.writeU8(ConstantType.NULL);
      writer.writeU8(ConstantType.TRUE);
      writer.writeU8(ConstantType.FALSE);
      writer.writeU8(ConstantType.INT32);
      writer.writeI32(42);
      writer.writeU8(ConstantType.FLOAT64);
      writer.writeF64(3.14159);
      writer.writeU8(ConstantType.STRING);
      writer.writeString("hello");
      writer.writeU8(ConstantType.REGEX);
      writer.writeString("\\d+");
      writer.writeString("g");

      // Name table (empty)
      writer.writeU32(0);

      // Function templates
      writer.writeU32(1);
      writer.writeI32(-1);
      writer.writeU32(0);
      writer.writeU32(0);
      writer.writeU32(0);
      writer.writeU32(0);
      writer.writeU32(1);

      // Code section
      writer.writeU32(1);
      writer.writeU8(0x30); // RETURN

      const file = readBytecode(writer.toUint8Array());

      expect(file.constantPool.constants).toHaveLength(7);
      expect(file.constantPool.constants[0]).toEqual({ type: ConstantType.NULL });
      expect(file.constantPool.constants[1]).toEqual({ type: ConstantType.TRUE });
      expect(file.constantPool.constants[2]).toEqual({ type: ConstantType.FALSE });
      expect(file.constantPool.constants[3]).toEqual({
        type: ConstantType.INT32,
        value: 42,
      });
      expect(file.constantPool.constants[4]).toEqual({
        type: ConstantType.FLOAT64,
        value: 3.14159,
      });
      expect(file.constantPool.constants[5]).toEqual({
        type: ConstantType.STRING,
        value: "hello",
      });
      expect(file.constantPool.constants[6]).toEqual({
        type: ConstantType.REGEX,
        pattern: "\\d+",
        flags: "g",
      });
    });

    it("reads name table correctly", () => {
      const writer = new TestBytecodeWriter();

      // Header
      writer.writeU32(MAGIC_NUMBER);
      writer.writeU8(VERSION_MAJOR);
      writer.writeU8(VERSION_MINOR);
      writer.writeU8(HeaderFlags.NONE);
      writer.writeU8(0);
      writer.writeU32(0);
      writer.writeU32(0);

      // Constant pool (empty)
      writer.writeU32(0);

      // Name table
      writer.writeU32(3);
      writer.writeString("foo");
      writer.writeString("bar");
      writer.writeString("baz");

      // Function templates
      writer.writeU32(1);
      writer.writeI32(-1);
      writer.writeU32(0);
      writer.writeU32(0);
      writer.writeU32(0);
      writer.writeU32(0);
      writer.writeU32(1);

      // Code section
      writer.writeU32(1);
      writer.writeU8(0x30);

      const file = readBytecode(writer.toUint8Array());

      expect(file.nameTable.names).toEqual(["foo", "bar", "baz"]);
    });

    it("reads function templates with upvalues", () => {
      const writer = new TestBytecodeWriter();

      // Header
      writer.writeU32(MAGIC_NUMBER);
      writer.writeU8(VERSION_MAJOR);
      writer.writeU8(VERSION_MINOR);
      writer.writeU8(HeaderFlags.NONE);
      writer.writeU8(0);
      writer.writeU32(0);
      writer.writeU32(0);

      // Constant pool (empty)
      writer.writeU32(0);

      // Name table
      writer.writeU32(1);
      writer.writeString("myFunc");

      // Function templates
      writer.writeU32(1);
      writer.writeI32(0); // nameIndex = 0 ("myFunc")
      writer.writeU32(2); // paramCount
      writer.writeU32(3); // localCount
      writer.writeU32(2); // 2 upvalues
      writer.writeU8(1); // isLocal = true
      writer.writeU32(0); // index = 0
      writer.writeU8(0); // isLocal = false
      writer.writeU32(1); // index = 1
      writer.writeU32(0); // codeOffset
      writer.writeU32(1); // codeLength

      // Code section
      writer.writeU32(1);
      writer.writeU8(0x30);

      const file = readBytecode(writer.toUint8Array());

      expect(file.functionTemplates.templates).toHaveLength(1);
      const template = file.functionTemplates.templates[0]!;
      expect(template.nameIndex).toBe(0);
      expect(template.paramCount).toBe(2);
      expect(template.localCount).toBe(3);
      expect(template.upvalues).toHaveLength(2);
      expect(template.upvalues[0]).toEqual({ isLocal: true, index: 0 });
      expect(template.upvalues[1]).toEqual({ isLocal: false, index: 1 });
    });

    it("reads debug info when flag is set", () => {
      const writer = new TestBytecodeWriter();

      // Header with debug flag
      writer.writeU32(MAGIC_NUMBER);
      writer.writeU8(VERSION_MAJOR);
      writer.writeU8(VERSION_MINOR);
      writer.writeU8(HeaderFlags.HAS_DEBUG_INFO);
      writer.writeU8(0);
      writer.writeU32(0);
      writer.writeU32(0);

      // Constant pool (empty)
      writer.writeU32(0);

      // Name table (empty)
      writer.writeU32(0);

      // Function templates
      writer.writeU32(1);
      writer.writeI32(-1);
      writer.writeU32(1); // paramCount
      writer.writeU32(2); // localCount
      writer.writeU32(0); // no upvalues
      writer.writeU32(0);
      writer.writeU32(1);

      // Code section
      writer.writeU32(1);
      writer.writeU8(0x30);

      // Debug info
      writer.writeU32(1); // 1 function
      writer.writeU32(0); // functionIndex = 0
      writer.writeU32(2); // 2 local names
      writer.writeString("param1");
      writer.writeString("local1");
      writer.writeU32(1); // 1 instruction
      writer.writeU32(0); // byteOffset = 0
      writer.writeU32(10); // line = 10
      writer.writeU32(5); // column = 5

      const file = readBytecode(writer.toUint8Array());

      expect(file.debugInfo).toBeDefined();
      expect(file.debugInfo!.functions).toHaveLength(1);
      expect(file.debugInfo!.functions[0]!.functionIndex).toBe(0);
      expect(file.debugInfo!.functions[0]!.localNames).toEqual([
        "param1",
        "local1",
      ]);
      expect(file.debugInfo!.functions[0]!.instructions).toHaveLength(1);
      expect(file.debugInfo!.functions[0]!.instructions[0]).toEqual({
        byteOffset: 0,
        sourceLocation: { line: 10, column: 5 },
      });
    });

    it("validates entry point index", () => {
      const writer = new TestBytecodeWriter();

      // Header with invalid entry point
      writer.writeU32(MAGIC_NUMBER);
      writer.writeU8(VERSION_MAJOR);
      writer.writeU8(VERSION_MINOR);
      writer.writeU8(HeaderFlags.NONE);
      writer.writeU8(0);
      writer.writeU32(5); // invalid - no such function
      writer.writeU32(0);

      // Constant pool (empty)
      writer.writeU32(0);

      // Name table (empty)
      writer.writeU32(0);

      // Function templates (only 1 function)
      writer.writeU32(1);
      writer.writeI32(-1);
      writer.writeU32(0);
      writer.writeU32(0);
      writer.writeU32(0);
      writer.writeU32(0);
      writer.writeU32(1);

      // Code section
      writer.writeU32(1);
      writer.writeU8(0x30);

      expect(() => readBytecode(writer.toUint8Array())).toThrow(
        BytecodeReadError
      );
      expect(() => readBytecode(writer.toUint8Array())).toThrow(/entry point/);
    });

    it("validates function template code bounds", () => {
      const writer = new TestBytecodeWriter();

      // Header
      writer.writeU32(MAGIC_NUMBER);
      writer.writeU8(VERSION_MAJOR);
      writer.writeU8(VERSION_MINOR);
      writer.writeU8(HeaderFlags.NONE);
      writer.writeU8(0);
      writer.writeU32(0);
      writer.writeU32(0);

      // Constant pool (empty)
      writer.writeU32(0);

      // Name table (empty)
      writer.writeU32(0);

      // Function templates with invalid code range
      writer.writeU32(1);
      writer.writeI32(-1);
      writer.writeU32(0);
      writer.writeU32(0);
      writer.writeU32(0);
      writer.writeU32(0); // codeOffset = 0
      writer.writeU32(10); // codeLength = 10, but code section is only 1 byte

      // Code section (too small)
      writer.writeU32(1);
      writer.writeU8(0x30);

      expect(() => readBytecode(writer.toUint8Array())).toThrow(
        BytecodeReadError
      );
      expect(() => readBytecode(writer.toUint8Array())).toThrow(/code length/);
    });

    it("rejects unknown constant type", () => {
      const writer = new TestBytecodeWriter();

      // Header
      writer.writeU32(MAGIC_NUMBER);
      writer.writeU8(VERSION_MAJOR);
      writer.writeU8(VERSION_MINOR);
      writer.writeU8(HeaderFlags.NONE);
      writer.writeU8(0);
      writer.writeU32(0);
      writer.writeU32(0);

      // Constant pool with invalid type
      writer.writeU32(1);
      writer.writeU8(99); // unknown constant type

      expect(() => readBytecode(writer.toUint8Array())).toThrow(
        BytecodeReadError
      );
      expect(() => readBytecode(writer.toUint8Array())).toThrow(/constant type/);
    });

    it("detects trailing data", () => {
      const bytes = createMinimalBytecode();
      const withTrailing = new Uint8Array(bytes.length + 10);
      withTrailing.set(bytes);
      // Extra bytes at the end

      expect(() => readBytecode(withTrailing)).toThrow(BytecodeReadError);
      expect(() => readBytecode(withTrailing)).toThrow(/trailing data/);
    });

    it("validates UTF-8 strings", () => {
      const writer = new TestBytecodeWriter();

      // Header
      writer.writeU32(MAGIC_NUMBER);
      writer.writeU8(VERSION_MAJOR);
      writer.writeU8(VERSION_MINOR);
      writer.writeU8(HeaderFlags.NONE);
      writer.writeU8(0);
      writer.writeU32(0);
      writer.writeU32(0);

      // Constant pool (empty)
      writer.writeU32(0);

      // Name table with invalid UTF-8
      writer.writeU32(1);
      writer.writeU32(2); // string length = 2
      writer.writeU8(0xff); // invalid UTF-8
      writer.writeU8(0xfe);

      expect(() => readBytecode(writer.toUint8Array())).toThrow(
        BytecodeReadError
      );
      expect(() => readBytecode(writer.toUint8Array())).toThrow(/UTF-8/);
    });
  });
});
