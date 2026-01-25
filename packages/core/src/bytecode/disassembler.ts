/**
 * Bytecode disassembler for PEX.
 * Converts binary bytecode to human-readable text format for debugging.
 */

import type {
  BytecodeFile,
  Constant,
  FunctionTemplate,
} from "./format.ts";
import { ConstantType } from "./format.ts";
import {
  Opcode,
  OPCODE_METADATA,
  OperandType,
  isValidOpcode,
} from "./opcodes.ts";

/**
 * Result of disassembling a single instruction.
 */
export interface DisassembledInstruction {
  text: string; // Human-readable instruction text
  size: number; // Total instruction size in bytes
}

/**
 * Disassemble an entire bytecode file to human-readable text.
 */
export function disassemble(file: BytecodeFile): string {
  const lines: string[] = [];

  // Header
  lines.push("=== Bytecode File ===");
  lines.push(`Magic: ${magicToString(file.header.magic)}`);
  lines.push(
    `Version: ${file.header.versionMajor}.${file.header.versionMinor}`
  );
  lines.push(`Entry Point: ${file.header.entryPoint}`);
  lines.push(`Flags: ${formatFlags(file.header.flags)}`);
  lines.push("");

  // Constant pool
  lines.push(`=== Constants (${file.constantPool.constants.length}) ===`);
  for (let i = 0; i < file.constantPool.constants.length; i++) {
    const constant = file.constantPool.constants[i];
    if (constant) {
      lines.push(`${i}: ${formatConstant(constant)}`);
    }
  }
  lines.push("");

  // Name table
  lines.push(`=== Names (${file.nameTable.names.length}) ===`);
  for (let i = 0; i < file.nameTable.names.length; i++) {
    lines.push(`${i}: ${file.nameTable.names[i]}`);
  }
  lines.push("");

  // Functions
  lines.push(
    `=== Functions (${file.functionTemplates.templates.length}) ===`
  );
  for (let i = 0; i < file.functionTemplates.templates.length; i++) {
    lines.push(disassembleFunction(file, i));
    lines.push("");
  }

  // Debug info
  if (file.debugInfo) {
    lines.push("=== Debug Info ===");
    for (const funcDebug of file.debugInfo.functions) {
      lines.push(`Function ${funcDebug.functionIndex}:`);

      // Local names
      if (funcDebug.localNames.length > 0) {
        lines.push("  Locals:");
        for (let i = 0; i < funcDebug.localNames.length; i++) {
          lines.push(`    ${i}: ${funcDebug.localNames[i]}`);
        }
      }

      // Source locations (sample a few)
      if (funcDebug.instructions.length > 0) {
        lines.push("  Source locations:");
        const sampleSize = Math.min(5, funcDebug.instructions.length);
        for (let i = 0; i < sampleSize; i++) {
          const info = funcDebug.instructions[i];
          if (info) {
            lines.push(
              `    Offset ${info.byteOffset}: line ${info.sourceLocation.line}, col ${info.sourceLocation.column}`
            );
          }
        }
        if (funcDebug.instructions.length > sampleSize) {
          lines.push(
            `    ... (${funcDebug.instructions.length - sampleSize} more)`
          );
        }
      }

      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * Disassemble a single function.
 */
export function disassembleFunction(
  file: BytecodeFile,
  funcIndex: number
): string {
  const template = file.functionTemplates.templates[funcIndex];
  if (!template) {
    return `Function ${funcIndex}: <invalid function index>`;
  }

  const lines: string[] = [];

  // Function header
  const funcName = getFunctionName(file, template);
  lines.push(
    `Function ${funcIndex}: ${funcName} (params: ${template.paramCount}, locals: ${template.localCount}, upvalues: ${template.upvalues.length})`
  );

  // Upvalues info
  if (template.upvalues.length > 0) {
    lines.push("  Upvalues:");
    for (let i = 0; i < template.upvalues.length; i++) {
      const upvalue = template.upvalues[i];
      if (upvalue) {
        const source = upvalue.isLocal ? "local" : "upvalue";
        lines.push(`    ${i}: ${source}[${upvalue.index}]`);
      }
    }
  }

  // Get function bytecode slice
  const code = file.codeSection.code.slice(
    template.codeOffset,
    template.codeOffset + template.codeLength
  );

  // Disassemble instructions
  let offset = 0;
  while (offset < code.length) {
    const result = disassembleInstruction(code, offset, file.nameTable.names);

    // Format: "  0000: INSTRUCTION"
    const offsetStr = offset.toString().padStart(4, "0");
    const instruction = result.text;

    // Try to add a helpful comment
    const opcodeValue = code[offset];
    if (opcodeValue !== undefined) {
      const comment = generateComment(
        opcodeValue,
        result,
        file,
        template.codeOffset + offset
      );

      if (comment) {
        lines.push(`  ${offsetStr}: ${instruction.padEnd(30)} ; ${comment}`);
      } else {
        lines.push(`  ${offsetStr}: ${instruction}`);
      }
    }

    offset += result.size;
  }

  return lines.join("\n");
}

/**
 * Disassemble a single instruction at a given offset.
 */
export function disassembleInstruction(
  code: Uint8Array,
  offset: number,
  names: string[]
): DisassembledInstruction {
  if (offset >= code.length) {
    return {
      text: "<end of code>",
      size: 0,
    };
  }

  const opcodeValue = code[offset];
  if (opcodeValue === undefined) {
    return {
      text: "<invalid offset>",
      size: 1,
    };
  }

  // Check if valid opcode
  if (!isValidOpcode(opcodeValue)) {
    return {
      text: `<invalid opcode 0x${opcodeValue.toString(16).padStart(2, "0")}>`,
      size: 1,
    };
  }

  const opcode = opcodeValue as Opcode;
  const metadata = OPCODE_METADATA[opcode];
  const operandType = metadata.operandType;

  // Read operand if present
  let operand: number | null = null;
  let size = 1;

  switch (operandType) {
    case OperandType.U8:
      if (offset + 1 < code.length) {
        const byte = code[offset + 1];
        if (byte !== undefined) {
          operand = byte;
        }
        size = 2;
      }
      break;
    case OperandType.U16:
      if (offset + 2 < code.length) {
        const b1 = code[offset + 1];
        const b2 = code[offset + 2];
        if (b1 !== undefined && b2 !== undefined) {
          operand = (b1 << 8) | b2;
        }
        size = 3;
      }
      break;
    case OperandType.U32:
      if (offset + 4 < code.length) {
        const b1 = code[offset + 1];
        const b2 = code[offset + 2];
        const b3 = code[offset + 3];
        const b4 = code[offset + 4];
        if (
          b1 !== undefined &&
          b2 !== undefined &&
          b3 !== undefined &&
          b4 !== undefined
        ) {
          operand = (b1 << 24) | (b2 << 16) | (b3 << 8) | b4;
        }
        size = 5;
      }
      break;
    case OperandType.NONE:
      break;
  }

  // Format instruction
  let text = metadata.name;

  // Handle special cases with multiple operands
  if (
    opcode === Opcode.CALL_BUILTIN_U8_U8 ||
    opcode === Opcode.CALL_BUILTIN_U16_U8 ||
    opcode === Opcode.CALL_BUILTIN_U32_U8 ||
    opcode === Opcode.EFFECT_U8_U8 ||
    opcode === Opcode.EFFECT_U16_U8 ||
    opcode === Opcode.EFFECT_U32_U8
  ) {
    // These have two operands: name_idx and arg_count
    if (operand !== null) {
      const nameIdx = operand;
      const name = names[nameIdx] || `<unknown ${nameIdx}>`;

      // Read second operand (arg count - always u8)
      const argCountByte = code[offset + size];
      const argCount = argCountByte !== undefined ? argCountByte : 0;
      size++;

      text += ` "${name}" ${argCount}`;
    }
  } else if (operand !== null) {
    // Single operand - show the value
    const sizeHint = getSizeHint(operandType);
    text += `_${sizeHint} ${operand}`;
  }

  return { text, size };
}

/**
 * Generate a helpful comment for an instruction.
 */
function generateComment(
  opcode: number,
  _result: DisassembledInstruction,
  _file: BytecodeFile,
  _absoluteOffset: number
): string | null {
  if (!isValidOpcode(opcode)) {
    return null;
  }

  const metadata = OPCODE_METADATA[opcode as Opcode];

  // Show stack effect
  if (metadata.stackEffect) {
    return metadata.stackEffect;
  }

  return null;
}

/**
 * Get the size hint suffix for operand type.
 */
function getSizeHint(type: OperandType): string {
  switch (type) {
    case OperandType.U8:
      return "U8";
    case OperandType.U16:
      return "U16";
    case OperandType.U32:
      return "U32";
    default:
      return "";
  }
}

/**
 * Get a function's name from the name table.
 */
function getFunctionName(file: BytecodeFile, template: FunctionTemplate): string {
  if (template.nameIndex === -1) {
    return "<anonymous>";
  }
  const name = file.nameTable.names[template.nameIndex];
  return name || `<unknown ${template.nameIndex}>`;
}

/**
 * Format magic number as ASCII string.
 */
function magicToString(magic: number): string {
  const bytes = [
    (magic >> 24) & 0xff,
    (magic >> 16) & 0xff,
    (magic >> 8) & 0xff,
    magic & 0xff,
  ];
  return bytes.map((b) => String.fromCharCode(b)).join("");
}

/**
 * Format header flags.
 */
function formatFlags(flags: number): string {
  const flagNames: string[] = [];

  if (flags & 0x01) {
    flagNames.push("HAS_DEBUG_INFO");
  }

  if (flagNames.length === 0) {
    return "NONE";
  }

  return flagNames.join(" | ");
}

/**
 * Format a constant value.
 */
function formatConstant(constant: Constant): string {
  switch (constant.type) {
    case ConstantType.NULL:
      return "null";
    case ConstantType.TRUE:
      return "true";
    case ConstantType.FALSE:
      return "false";
    case ConstantType.INT32:
      return constant.value.toString();
    case ConstantType.FLOAT64:
      return constant.value.toString();
    case ConstantType.STRING:
      return JSON.stringify(constant.value);
    case ConstantType.REGEX:
      return `/${constant.pattern}/${constant.flags}`;
    default:
      return "<unknown constant type>";
  }
}
