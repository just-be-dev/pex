/**
 * Bytecode reader for deserializing PEX bytecode files from binary format.
 *
 * Reads bytecode files in little-endian format with the following structure:
 * 1. Header (16 bytes) - magic number, version, flags, entry point
 * 2. Constant Pool - typed constant values
 * 3. Name Table - identifier strings
 * 4. Function Templates - compiled function metadata
 * 5. Code Section - raw bytecode instructions
 * 6. Debug Info (optional) - source mappings and variable names
 */

import {
  type BytecodeFile,
  type BytecodeHeader,
  type Constant,
  type ConstantPool,
  type ConstantType,
  type DebugInfo,
  type FunctionDebugInfo,
  type FunctionTemplate,
  type FunctionTemplates,
  type InstructionDebugInfo,
  type NameTable,
  type SourceLocation,
  type Upvalue,
  ConstantType as CT,
  HeaderFlags,
  MAGIC_NUMBER,
  VERSION_MAJOR,
} from "./format";

/**
 * Custom error class for bytecode reading errors.
 */
export class BytecodeReadError extends Error {
  constructor(message: string, public offset?: number) {
    super(message);
    this.name = "BytecodeReadError";
  }
}

/**
 * Binary reader with bounds checking and little-endian data access.
 */
class BinaryReader {
  private view: DataView;
  private offset: number = 0;

  constructor(bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  /**
   * Get current read offset.
   */
  getOffset(): number {
    return this.offset;
  }

  /**
   * Set read offset.
   */
  setOffset(offset: number): void {
    if (offset < 0 || offset > this.view.byteLength) {
      throw new BytecodeReadError(
        `Invalid offset ${offset} (buffer size: ${this.view.byteLength})`,
        this.offset
      );
    }
    this.offset = offset;
  }

  /**
   * Get remaining bytes available.
   */
  remaining(): number {
    return this.view.byteLength - this.offset;
  }

  /**
   * Check if there are at least N bytes remaining.
   */
  private ensureBytes(count: number): void {
    if (this.remaining() < count) {
      throw new BytecodeReadError(
        `Unexpected end of bytecode: need ${count} bytes, have ${this.remaining()}`,
        this.offset
      );
    }
  }

  /**
   * Read an unsigned 8-bit integer.
   */
  readU8(): number {
    this.ensureBytes(1);
    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  /**
   * Read an unsigned 16-bit integer (little-endian).
   */
  readU16(): number {
    this.ensureBytes(2);
    const value = this.view.getUint16(this.offset, true); // true = little-endian
    this.offset += 2;
    return value;
  }

  /**
   * Read an unsigned 32-bit integer (little-endian).
   */
  readU32(): number {
    this.ensureBytes(4);
    const value = this.view.getUint32(this.offset, true); // true = little-endian
    this.offset += 4;
    return value;
  }

  /**
   * Read a signed 32-bit integer (little-endian).
   */
  readI32(): number {
    this.ensureBytes(4);
    const value = this.view.getInt32(this.offset, true); // true = little-endian
    this.offset += 4;
    return value;
  }

  /**
   * Read a 64-bit floating point number (little-endian).
   */
  readF64(): number {
    this.ensureBytes(8);
    const value = this.view.getFloat64(this.offset, true); // true = little-endian
    this.offset += 8;
    return value;
  }

  /**
   * Read a UTF-8 string.
   * Format: u32 length, followed by UTF-8 bytes.
   */
  readString(): string {
    const length = this.readU32();
    this.ensureBytes(length);

    const bytes = new Uint8Array(
      this.view.buffer,
      this.view.byteOffset + this.offset,
      length
    );
    this.offset += length;

    // Decode UTF-8
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new BytecodeReadError(
        `Invalid UTF-8 string at offset ${this.offset - length}`,
        this.offset - length
      );
    }
  }

  /**
   * Read raw bytes.
   */
  readBytes(length: number): Uint8Array {
    this.ensureBytes(length);
    const bytes = new Uint8Array(
      this.view.buffer,
      this.view.byteOffset + this.offset,
      length
    );
    this.offset += length;
    return bytes;
  }
}

/**
 * Read and validate bytecode header.
 */
function readHeader(reader: BinaryReader): BytecodeHeader {
  const magic = reader.readU32();
  if (magic !== MAGIC_NUMBER) {
    throw new BytecodeReadError(
      `Invalid magic number: expected 0x${MAGIC_NUMBER.toString(16)}, got 0x${magic.toString(16)}`,
      reader.getOffset() - 4
    );
  }

  const versionMajor = reader.readU8();
  const versionMinor = reader.readU8();

  // Check version compatibility (allow same major version)
  if (versionMajor !== VERSION_MAJOR) {
    throw new BytecodeReadError(
      `Incompatible bytecode version: expected ${VERSION_MAJOR}.x, got ${versionMajor}.${versionMinor}`,
      reader.getOffset() - 2
    );
  }

  const flags = reader.readU8();
  const reserved = reader.readU8();
  const entryPoint = reader.readU32();
  const constantPoolOffset = reader.readU32();

  return {
    magic,
    versionMajor,
    versionMinor,
    flags,
    reserved,
    entryPoint,
    constantPoolOffset,
  };
}

/**
 * Read a single constant from the constant pool.
 */
function readConstant(reader: BinaryReader): Constant {
  const type = reader.readU8() as ConstantType;

  switch (type) {
    case CT.NULL:
      return { type: CT.NULL };

    case CT.TRUE:
      return { type: CT.TRUE };

    case CT.FALSE:
      return { type: CT.FALSE };

    case CT.INT32: {
      const value = reader.readI32();
      return { type: CT.INT32, value };
    }

    case CT.FLOAT64: {
      const value = reader.readF64();
      return { type: CT.FLOAT64, value };
    }

    case CT.STRING: {
      const value = reader.readString();
      return { type: CT.STRING, value };
    }

    case CT.REGEX: {
      const pattern = reader.readString();
      const flags = reader.readString();
      return { type: CT.REGEX, pattern, flags };
    }

    default:
      throw new BytecodeReadError(
        `Unknown constant type: ${type}`,
        reader.getOffset() - 1
      );
  }
}

/**
 * Read constant pool section.
 */
function readConstantPool(reader: BinaryReader): ConstantPool {
  const count = reader.readU32();
  const constants: Constant[] = [];

  for (let i = 0; i < count; i++) {
    try {
      constants.push(readConstant(reader));
    } catch (error) {
      if (error instanceof BytecodeReadError) {
        throw error;
      }
      throw new BytecodeReadError(
        `Error reading constant ${i}: ${error instanceof Error ? error.message : String(error)}`,
        reader.getOffset()
      );
    }
  }

  return { constants };
}

/**
 * Read name table section.
 */
function readNameTable(reader: BinaryReader): NameTable {
  const count = reader.readU32();
  const names: string[] = [];

  for (let i = 0; i < count; i++) {
    try {
      names.push(reader.readString());
    } catch (error) {
      if (error instanceof BytecodeReadError) {
        throw error;
      }
      throw new BytecodeReadError(
        `Error reading name ${i}: ${error instanceof Error ? error.message : String(error)}`,
        reader.getOffset()
      );
    }
  }

  return { names };
}

/**
 * Read a single upvalue descriptor.
 */
function readUpvalue(reader: BinaryReader): Upvalue {
  const isLocal = reader.readU8() !== 0;
  const index = reader.readU32();
  return { isLocal, index };
}

/**
 * Read a single function template.
 */
function readFunctionTemplate(reader: BinaryReader): FunctionTemplate {
  const nameIndex = reader.readI32(); // -1 for anonymous functions
  const paramCount = reader.readU32();
  const localCount = reader.readU32();

  const upvalueCount = reader.readU32();
  const upvalues: Upvalue[] = [];
  for (let i = 0; i < upvalueCount; i++) {
    upvalues.push(readUpvalue(reader));
  }

  const codeOffset = reader.readU32();
  const codeLength = reader.readU32();

  return {
    nameIndex,
    paramCount,
    localCount,
    upvalues,
    codeOffset,
    codeLength,
  };
}

/**
 * Read function templates section.
 */
function readFunctionTemplates(reader: BinaryReader): FunctionTemplates {
  const count = reader.readU32();
  const templates: FunctionTemplate[] = [];

  for (let i = 0; i < count; i++) {
    try {
      templates.push(readFunctionTemplate(reader));
    } catch (error) {
      if (error instanceof BytecodeReadError) {
        throw error;
      }
      throw new BytecodeReadError(
        `Error reading function template ${i}: ${error instanceof Error ? error.message : String(error)}`,
        reader.getOffset()
      );
    }
  }

  return { templates };
}

/**
 * Read code section.
 */
function readCodeSection(reader: BinaryReader): Uint8Array {
  const length = reader.readU32();
  return reader.readBytes(length);
}

/**
 * Read a source location.
 */
function readSourceLocation(reader: BinaryReader): SourceLocation {
  const line = reader.readU32();
  const column = reader.readU32();
  return { line, column };
}

/**
 * Read instruction debug info.
 */
function readInstructionDebugInfo(reader: BinaryReader): InstructionDebugInfo {
  const byteOffset = reader.readU32();
  const sourceLocation = readSourceLocation(reader);
  return { byteOffset, sourceLocation };
}

/**
 * Read function debug info.
 */
function readFunctionDebugInfo(reader: BinaryReader): FunctionDebugInfo {
  const functionIndex = reader.readU32();

  const localNameCount = reader.readU32();
  const localNames: string[] = [];
  for (let i = 0; i < localNameCount; i++) {
    localNames.push(reader.readString());
  }

  const instructionCount = reader.readU32();
  const instructions: InstructionDebugInfo[] = [];
  for (let i = 0; i < instructionCount; i++) {
    instructions.push(readInstructionDebugInfo(reader));
  }

  return { functionIndex, localNames, instructions };
}

/**
 * Read debug info section.
 */
function readDebugInfo(reader: BinaryReader): DebugInfo {
  const functionCount = reader.readU32();
  const functions: FunctionDebugInfo[] = [];

  for (let i = 0; i < functionCount; i++) {
    try {
      functions.push(readFunctionDebugInfo(reader));
    } catch (error) {
      if (error instanceof BytecodeReadError) {
        throw error;
      }
      throw new BytecodeReadError(
        `Error reading debug info for function ${i}: ${error instanceof Error ? error.message : String(error)}`,
        reader.getOffset()
      );
    }
  }

  return { functions };
}

/**
 * Validate function templates against code section.
 */
function validateFunctionTemplates(
  templates: FunctionTemplates,
  codeLength: number
): void {
  for (let i = 0; i < templates.templates.length; i++) {
    const template = templates.templates[i]!;

    // Check code offset bounds
    if (template.codeOffset < 0 || template.codeOffset >= codeLength) {
      throw new BytecodeReadError(
        `Function template ${i}: invalid code offset ${template.codeOffset} (code section length: ${codeLength})`
      );
    }

    // Check code length bounds
    if (
      template.codeLength < 0 ||
      template.codeOffset + template.codeLength > codeLength
    ) {
      throw new BytecodeReadError(
        `Function template ${i}: invalid code length ${template.codeLength} (offset: ${template.codeOffset}, code section length: ${codeLength})`
      );
    }

    // Validate counts
    if (template.paramCount < 0 || template.localCount < 0) {
      throw new BytecodeReadError(
        `Function template ${i}: invalid param/local count`
      );
    }

    if (template.paramCount > template.localCount) {
      throw new BytecodeReadError(
        `Function template ${i}: param count (${template.paramCount}) exceeds local count (${template.localCount})`
      );
    }
  }
}

/**
 * Read and deserialize a complete bytecode file from binary format.
 *
 * @param bytes - Binary bytecode data
 * @returns Deserialized bytecode file structure
 * @throws BytecodeReadError if the format is invalid or corrupted
 */
export function readBytecode(bytes: Uint8Array): BytecodeFile {
  const reader = new BinaryReader(bytes);

  try {
    // Read header
    const header = readHeader(reader);

    // Read constant pool
    const constantPool = readConstantPool(reader);

    // Read name table
    const nameTable = readNameTable(reader);

    // Read function templates
    const functionTemplates = readFunctionTemplates(reader);

    // Read code section
    const code = readCodeSection(reader);

    // Validate function templates against code section
    validateFunctionTemplates(functionTemplates, code.length);

    // Validate entry point
    if (
      header.entryPoint < 0 ||
      header.entryPoint >= functionTemplates.templates.length
    ) {
      throw new BytecodeReadError(
        `Invalid entry point: ${header.entryPoint} (function template count: ${functionTemplates.templates.length})`
      );
    }

    // Build the bytecode file
    const file: BytecodeFile = {
      header,
      constantPool,
      nameTable,
      functionTemplates,
      codeSection: { code },
    };

    // Read optional debug info section
    if ((header.flags & HeaderFlags.HAS_DEBUG_INFO) !== 0) {
      if (reader.remaining() > 0) {
        file.debugInfo = readDebugInfo(reader);
      } else {
        throw new BytecodeReadError(
          "Header indicates debug info, but no data remaining"
        );
      }
    }

    // Verify we've consumed all bytes (no trailing data)
    if (reader.remaining() > 0) {
      throw new BytecodeReadError(
        `Unexpected trailing data: ${reader.remaining()} bytes remaining`,
        reader.getOffset()
      );
    }

    return file;
  } catch (error) {
    if (error instanceof BytecodeReadError) {
      throw error;
    }
    throw new BytecodeReadError(
      `Failed to read bytecode: ${error instanceof Error ? error.message : String(error)}`,
      reader.getOffset()
    );
  }
}
