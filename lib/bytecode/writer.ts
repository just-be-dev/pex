/**
 * Bytecode writer for binary serialization of PEX bytecode files.
 *
 * Serializes a BytecodeFile structure to a binary Uint8Array format
 * using little-endian byte order for all multi-byte values.
 */

import {
  type BytecodeFile,
  type Constant,
  ConstantType,
  type FunctionTemplate,
  type Upvalue,
  MAGIC_NUMBER,
  HeaderFlags,
  hasDebugInfo,
  type DebugInfo,
  type FunctionDebugInfo,
  type InstructionDebugInfo,
} from "./format";

/**
 * Error thrown when bytecode serialization fails.
 */
export class BytecodeWriterError extends Error {
  constructor(message: string) {
    super(`Bytecode writer error: ${message}`);
    this.name = "BytecodeWriterError";
  }
}

/**
 * Helper class to build a byte array incrementally.
 */
class ByteArrayBuilder {
  private chunks: Uint8Array[] = [];
  private currentSize = 0;

  /**
   * Write a single byte.
   */
  writeU8(value: number): void {
    if (value < 0 || value > 0xff || !Number.isInteger(value)) {
      throw new BytecodeWriterError(
        `Invalid u8 value: ${value} (must be 0-255)`
      );
    }
    const chunk = new Uint8Array(1);
    chunk[0] = value;
    this.chunks.push(chunk);
    this.currentSize += 1;
  }

  /**
   * Write a 16-bit unsigned integer (little-endian).
   */
  writeU16(value: number): void {
    if (value < 0 || value > 0xffff || !Number.isInteger(value)) {
      throw new BytecodeWriterError(
        `Invalid u16 value: ${value} (must be 0-65535)`
      );
    }
    const chunk = new Uint8Array(2);
    chunk[0] = value & 0xff;
    chunk[1] = (value >> 8) & 0xff;
    this.chunks.push(chunk);
    this.currentSize += 2;
  }

  /**
   * Write a 32-bit unsigned integer (little-endian).
   */
  writeU32(value: number): void {
    if (value < 0 || value > 0xffffffff || !Number.isInteger(value)) {
      throw new BytecodeWriterError(
        `Invalid u32 value: ${value} (must be 0-4294967295)`
      );
    }
    const chunk = new Uint8Array(4);
    chunk[0] = value & 0xff;
    chunk[1] = (value >> 8) & 0xff;
    chunk[2] = (value >> 16) & 0xff;
    chunk[3] = (value >> 24) & 0xff;
    this.chunks.push(chunk);
    this.currentSize += 4;
  }

  /**
   * Write a 32-bit signed integer (little-endian).
   */
  writeI32(value: number): void {
    if (
      value < -0x80000000 ||
      value > 0x7fffffff ||
      !Number.isInteger(value)
    ) {
      throw new BytecodeWriterError(
        `Invalid i32 value: ${value} (must be -2147483648 to 2147483647)`
      );
    }
    // Convert to unsigned representation
    const unsigned = value < 0 ? value + 0x100000000 : value;
    this.writeU32(unsigned);
  }

  /**
   * Write a 64-bit floating point number (little-endian).
   * Accepts all IEEE 754 values including NaN, Infinity, and -Infinity.
   */
  writeF64(value: number): void {
    if (typeof value !== "number") {
      throw new BytecodeWriterError(`Invalid f64 value: ${value} (not a number)`);
    }
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setFloat64(0, value, true); // true = little-endian
    const chunk = new Uint8Array(buffer);
    this.chunks.push(chunk);
    this.currentSize += 8;
  }

  /**
   * Write a length-prefixed UTF-8 string.
   * Format: u32 length + UTF-8 bytes
   */
  writeString(value: string): void {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(value);

    if (bytes.length > 0xffffffff) {
      throw new BytecodeWriterError(
        `String too long: ${bytes.length} bytes (max 4GB)`
      );
    }

    this.writeU32(bytes.length);
    if (bytes.length > 0) {
      this.chunks.push(bytes);
      this.currentSize += bytes.length;
    }
  }

  /**
   * Write raw bytes.
   */
  writeBytes(bytes: Uint8Array): void {
    if (bytes.length > 0) {
      this.chunks.push(bytes);
      this.currentSize += bytes.length;
    }
  }

  /**
   * Get the current byte offset (total size written so far).
   */
  getOffset(): number {
    return this.currentSize;
  }

  /**
   * Build the final byte array.
   */
  build(): Uint8Array {
    const result = new Uint8Array(this.currentSize);
    let offset = 0;
    for (const chunk of this.chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }
}

/**
 * Write a constant to the byte array builder.
 */
function writeConstant(builder: ByteArrayBuilder, constant: Constant): void {
  builder.writeU8(constant.type);

  switch (constant.type) {
    case ConstantType.NULL:
    case ConstantType.TRUE:
    case ConstantType.FALSE:
      // No additional data
      break;

    case ConstantType.INT32:
      builder.writeI32(constant.value);
      break;

    case ConstantType.FLOAT64:
      builder.writeF64(constant.value);
      break;

    case ConstantType.STRING:
      builder.writeString(constant.value);
      break;

    case ConstantType.REGEX:
      builder.writeString(constant.pattern);
      builder.writeString(constant.flags);
      break;

    default: {
      const exhaustiveCheck: never = constant;
      throw new BytecodeWriterError(
        `Unknown constant type: ${(exhaustiveCheck as Constant).type}`
      );
    }
  }
}

/**
 * Write the constant pool section.
 */
function writeConstantPool(
  builder: ByteArrayBuilder,
  constants: Constant[]
): void {
  // Write count
  if (constants.length > 0xffffffff) {
    throw new BytecodeWriterError(
      `Too many constants: ${constants.length} (max 4294967295)`
    );
  }
  builder.writeU32(constants.length);

  // Write each constant
  for (const constant of constants) {
    writeConstant(builder, constant);
  }
}

/**
 * Write the name table section.
 */
function writeNameTable(builder: ByteArrayBuilder, names: string[]): void {
  // Write count
  if (names.length > 0xffffffff) {
    throw new BytecodeWriterError(
      `Too many names: ${names.length} (max 4294967295)`
    );
  }
  builder.writeU32(names.length);

  // Write each name (length-prefixed string)
  for (const name of names) {
    builder.writeString(name);
  }
}

/**
 * Write an upvalue descriptor.
 */
function writeUpvalue(builder: ByteArrayBuilder, upvalue: Upvalue): void {
  // Write isLocal as u8 (0 = false, 1 = true)
  builder.writeU8(upvalue.isLocal ? 1 : 0);
  // Write index as u32
  if (upvalue.index < 0 || !Number.isInteger(upvalue.index)) {
    throw new BytecodeWriterError(
      `Invalid upvalue index: ${upvalue.index} (must be non-negative integer)`
    );
  }
  builder.writeU32(upvalue.index);
}

/**
 * Write a function template.
 */
function writeFunctionTemplate(
  builder: ByteArrayBuilder,
  template: FunctionTemplate
): void {
  // Validate name index
  if (!Number.isInteger(template.nameIndex)) {
    throw new BytecodeWriterError(
      `Invalid function name index: ${template.nameIndex} (must be integer)`
    );
  }
  builder.writeI32(template.nameIndex); // i32 to support -1 for anonymous

  // Validate and write param count
  if (
    template.paramCount < 0 ||
    !Number.isInteger(template.paramCount) ||
    template.paramCount > 0xffffffff
  ) {
    throw new BytecodeWriterError(
      `Invalid param count: ${template.paramCount} (must be 0-4294967295)`
    );
  }
  builder.writeU32(template.paramCount);

  // Validate and write local count
  if (
    template.localCount < 0 ||
    !Number.isInteger(template.localCount) ||
    template.localCount > 0xffffffff
  ) {
    throw new BytecodeWriterError(
      `Invalid local count: ${template.localCount} (must be 0-4294967295)`
    );
  }
  builder.writeU32(template.localCount);

  // Write upvalues count and data
  if (template.upvalues.length > 0xffffffff) {
    throw new BytecodeWriterError(
      `Too many upvalues: ${template.upvalues.length} (max 4294967295)`
    );
  }
  builder.writeU32(template.upvalues.length);
  for (const upvalue of template.upvalues) {
    writeUpvalue(builder, upvalue);
  }

  // Write code offset and length
  if (
    template.codeOffset < 0 ||
    !Number.isInteger(template.codeOffset) ||
    template.codeOffset > 0xffffffff
  ) {
    throw new BytecodeWriterError(
      `Invalid code offset: ${template.codeOffset} (must be 0-4294967295)`
    );
  }
  builder.writeU32(template.codeOffset);

  if (
    template.codeLength < 0 ||
    !Number.isInteger(template.codeLength) ||
    template.codeLength > 0xffffffff
  ) {
    throw new BytecodeWriterError(
      `Invalid code length: ${template.codeLength} (must be 0-4294967295)`
    );
  }
  builder.writeU32(template.codeLength);
}

/**
 * Write the function templates section.
 */
function writeFunctionTemplates(
  builder: ByteArrayBuilder,
  templates: FunctionTemplate[]
): void {
  // Write count
  if (templates.length > 0xffffffff) {
    throw new BytecodeWriterError(
      `Too many function templates: ${templates.length} (max 4294967295)`
    );
  }
  builder.writeU32(templates.length);

  // Write each template
  for (const template of templates) {
    writeFunctionTemplate(builder, template);
  }
}

/**
 * Write the code section.
 */
function writeCodeSection(builder: ByteArrayBuilder, code: Uint8Array): void {
  // Write length
  if (code.length > 0xffffffff) {
    throw new BytecodeWriterError(
      `Code section too large: ${code.length} bytes (max 4GB)`
    );
  }
  builder.writeU32(code.length);

  // Write code bytes
  builder.writeBytes(code);
}

/**
 * Write an instruction debug info entry.
 */
function writeInstructionDebugInfo(
  builder: ByteArrayBuilder,
  info: InstructionDebugInfo
): void {
  // Write byte offset
  if (
    info.byteOffset < 0 ||
    !Number.isInteger(info.byteOffset) ||
    info.byteOffset > 0xffffffff
  ) {
    throw new BytecodeWriterError(
      `Invalid instruction byte offset: ${info.byteOffset}`
    );
  }
  builder.writeU32(info.byteOffset);

  // Write source location (line and column)
  if (
    info.sourceLocation.line < 0 ||
    !Number.isInteger(info.sourceLocation.line) ||
    info.sourceLocation.line > 0xffffffff
  ) {
    throw new BytecodeWriterError(
      `Invalid source line: ${info.sourceLocation.line}`
    );
  }
  builder.writeU32(info.sourceLocation.line);

  if (
    info.sourceLocation.column < 0 ||
    !Number.isInteger(info.sourceLocation.column) ||
    info.sourceLocation.column > 0xffffffff
  ) {
    throw new BytecodeWriterError(
      `Invalid source column: ${info.sourceLocation.column}`
    );
  }
  builder.writeU32(info.sourceLocation.column);
}

/**
 * Write a function debug info entry.
 */
function writeFunctionDebugInfo(
  builder: ByteArrayBuilder,
  info: FunctionDebugInfo
): void {
  // Write function index
  if (
    info.functionIndex < 0 ||
    !Number.isInteger(info.functionIndex) ||
    info.functionIndex > 0xffffffff
  ) {
    throw new BytecodeWriterError(
      `Invalid function index in debug info: ${info.functionIndex}`
    );
  }
  builder.writeU32(info.functionIndex);

  // Write local names count and names
  if (info.localNames.length > 0xffffffff) {
    throw new BytecodeWriterError(
      `Too many local names: ${info.localNames.length}`
    );
  }
  builder.writeU32(info.localNames.length);
  for (const name of info.localNames) {
    builder.writeString(name);
  }

  // Write instruction debug info count and entries
  if (info.instructions.length > 0xffffffff) {
    throw new BytecodeWriterError(
      `Too many instruction debug entries: ${info.instructions.length}`
    );
  }
  builder.writeU32(info.instructions.length);
  for (const instrInfo of info.instructions) {
    writeInstructionDebugInfo(builder, instrInfo);
  }
}

/**
 * Write the optional debug info section.
 */
function writeDebugInfo(builder: ByteArrayBuilder, debugInfo: DebugInfo): void {
  // Write function debug info count
  if (debugInfo.functions.length > 0xffffffff) {
    throw new BytecodeWriterError(
      `Too many function debug entries: ${debugInfo.functions.length}`
    );
  }
  builder.writeU32(debugInfo.functions.length);

  // Write each function debug info
  for (const funcInfo of debugInfo.functions) {
    writeFunctionDebugInfo(builder, funcInfo);
  }
}

/**
 * Write a complete bytecode file to binary format.
 *
 * @param file The bytecode file to serialize
 * @returns Binary representation as Uint8Array
 * @throws BytecodeWriterError if serialization fails
 */
export function writeBytecode(file: BytecodeFile): Uint8Array {
  // Validate header
  if (file.header.magic !== MAGIC_NUMBER) {
    throw new BytecodeWriterError(
      `Invalid magic number: 0x${file.header.magic.toString(16)} (expected 0x${MAGIC_NUMBER.toString(16)})`
    );
  }

  if (
    file.header.versionMajor < 0 ||
    file.header.versionMajor > 255 ||
    !Number.isInteger(file.header.versionMajor)
  ) {
    throw new BytecodeWriterError(
      `Invalid version major: ${file.header.versionMajor} (must be 0-255)`
    );
  }

  if (
    file.header.versionMinor < 0 ||
    file.header.versionMinor > 255 ||
    !Number.isInteger(file.header.versionMinor)
  ) {
    throw new BytecodeWriterError(
      `Invalid version minor: ${file.header.versionMinor} (must be 0-255)`
    );
  }

  if (
    file.header.entryPoint < 0 ||
    !Number.isInteger(file.header.entryPoint) ||
    file.header.entryPoint > 0xffffffff
  ) {
    throw new BytecodeWriterError(
      `Invalid entry point: ${file.header.entryPoint} (must be 0-4294967295)`
    );
  }

  // Validate debug info presence
  const hasDebug = hasDebugInfo(file);
  if (hasDebug && !file.debugInfo) {
    throw new BytecodeWriterError(
      "Header indicates debug info present, but debugInfo field is missing"
    );
  }
  if (!hasDebug && file.debugInfo) {
    throw new BytecodeWriterError(
      "Debug info present but HAS_DEBUG_INFO flag not set in header"
    );
  }

  // Build sections separately to calculate offsets
  const sectionsBuilder = new ByteArrayBuilder();

  // Constant pool (starts immediately after header at offset 16)
  const constantPoolOffset = 16;
  writeConstantPool(sectionsBuilder, file.constantPool.constants);

  // Name table
  const nameTableOffset = constantPoolOffset + sectionsBuilder.getOffset();
  writeNameTable(sectionsBuilder, file.nameTable.names);

  // Function templates
  const functionTemplatesOffset =
    constantPoolOffset + sectionsBuilder.getOffset();
  writeFunctionTemplates(
    sectionsBuilder,
    file.functionTemplates.templates
  );

  // Code section
  const codeSectionOffset = constantPoolOffset + sectionsBuilder.getOffset();
  writeCodeSection(sectionsBuilder, file.codeSection.code);

  // Debug info (if present)
  const debugInfoOffset = hasDebug
    ? constantPoolOffset + sectionsBuilder.getOffset()
    : 0;
  if (hasDebug && file.debugInfo) {
    writeDebugInfo(sectionsBuilder, file.debugInfo);
  }

  // Now write the header with the correct constant pool offset
  const headerBuilder = new ByteArrayBuilder();
  headerBuilder.writeU32(file.header.magic);
  headerBuilder.writeU8(file.header.versionMajor);
  headerBuilder.writeU8(file.header.versionMinor);
  headerBuilder.writeU8(file.header.flags);
  headerBuilder.writeU8(file.header.reserved);
  headerBuilder.writeU32(file.header.entryPoint);
  headerBuilder.writeU32(constantPoolOffset);

  // Combine header and sections
  const header = headerBuilder.build();
  const sections = sectionsBuilder.build();

  // Validate header size
  if (header.length !== 16) {
    throw new BytecodeWriterError(
      `Internal error: header size is ${header.length}, expected 16 bytes`
    );
  }

  // Combine into final bytecode
  const result = new Uint8Array(header.length + sections.length);
  result.set(header, 0);
  result.set(sections, header.length);

  return result;
}

/**
 * Helper function to estimate the size of a bytecode file in bytes.
 * Useful for pre-allocating buffers or checking size limits.
 *
 * @param file The bytecode file to estimate
 * @returns Estimated size in bytes
 */
export function estimateBytecodeSize(file: BytecodeFile): number {
  let size = 16; // Header

  // Constant pool
  size += 4; // count
  for (const constant of file.constantPool.constants) {
    size += 1; // type tag
    switch (constant.type) {
      case ConstantType.NULL:
      case ConstantType.TRUE:
      case ConstantType.FALSE:
        break;
      case ConstantType.INT32:
        size += 4;
        break;
      case ConstantType.FLOAT64:
        size += 8;
        break;
      case ConstantType.STRING:
        size += 4 + new TextEncoder().encode(constant.value).length;
        break;
      case ConstantType.REGEX:
        size += 4 + new TextEncoder().encode(constant.pattern).length;
        size += 4 + new TextEncoder().encode(constant.flags).length;
        break;
    }
  }

  // Name table
  size += 4; // count
  for (const name of file.nameTable.names) {
    size += 4 + new TextEncoder().encode(name).length;
  }

  // Function templates
  size += 4; // count
  for (const template of file.functionTemplates.templates) {
    size += 4; // nameIndex
    size += 4; // paramCount
    size += 4; // localCount
    size += 4; // upvalues count
    size += template.upvalues.length * (1 + 4); // each upvalue: isLocal (u8) + index (u32)
    size += 4; // codeOffset
    size += 4; // codeLength
  }

  // Code section
  size += 4; // length
  size += file.codeSection.code.length;

  // Debug info
  if (hasDebugInfo(file) && file.debugInfo) {
    size += 4; // function count
    for (const funcInfo of file.debugInfo.functions) {
      size += 4; // functionIndex
      size += 4; // localNames count
      for (const name of funcInfo.localNames) {
        size += 4 + new TextEncoder().encode(name).length;
      }
      size += 4; // instructions count
      size += funcInfo.instructions.length * (4 + 4 + 4); // byteOffset + line + column
    }
  }

  return size;
}
