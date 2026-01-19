/**
 * Example demonstrating the bytecode disassembler.
 *
 * Run with: bun examples/disassembler-demo.ts
 */

import { disassemble } from "../lib/bytecode/disassembler";
import type { BytecodeFile } from "../lib/bytecode/format";
import {
  MAGIC_NUMBER,
  VERSION_MAJOR,
  VERSION_MINOR,
  HeaderFlags,
  ConstantType,
} from "../lib/bytecode/format";
import { Opcode } from "../lib/bytecode/opcodes";

// Create a sample bytecode file representing:
// let: x 10
// let: y 20
// + x y
const sampleBytecode: BytecodeFile = {
  header: {
    magic: MAGIC_NUMBER,
    versionMajor: VERSION_MAJOR,
    versionMinor: VERSION_MINOR,
    flags: HeaderFlags.HAS_DEBUG_INFO,
    reserved: 0,
    entryPoint: 0,
    constantPoolOffset: 0,
  },
  constantPool: {
    constants: [
      { type: ConstantType.INT32, value: 10 },
      { type: ConstantType.INT32, value: 20 },
    ],
  },
  nameTable: {
    names: ["main", "x", "y", "add"],
  },
  functionTemplates: {
    templates: [
      {
        nameIndex: 0, // "main"
        paramCount: 0,
        localCount: 2, // x and y
        upvalues: [],
        codeOffset: 0,
        codeLength: 13,
      },
    ],
  },
  codeSection: {
    code: new Uint8Array([
      // let: x 10
      Opcode.CONST_U8,
      0, // Load constant 0 (10)
      Opcode.STORE_LOCAL_U8,
      0, // Store to local 0 (x)
      // let: y 20
      Opcode.CONST_U8,
      1, // Load constant 1 (20)
      Opcode.STORE_LOCAL_U8,
      1, // Store to local 1 (y)
      // + x y
      Opcode.LOAD_LOCAL_U8,
      0, // Load x
      Opcode.LOAD_LOCAL_U8,
      1, // Load y
      Opcode.ADD, // Add them
      // Return result
      Opcode.RETURN,
    ]),
  },
  debugInfo: {
    functions: [
      {
        functionIndex: 0,
        localNames: ["x", "y"],
        instructions: [
          { byteOffset: 0, sourceLocation: { line: 1, column: 0 } },
          { byteOffset: 2, sourceLocation: { line: 1, column: 5 } },
          { byteOffset: 4, sourceLocation: { line: 2, column: 0 } },
          { byteOffset: 6, sourceLocation: { line: 2, column: 5 } },
          { byteOffset: 8, sourceLocation: { line: 3, column: 0 } },
          { byteOffset: 10, sourceLocation: { line: 3, column: 3 } },
          { byteOffset: 11, sourceLocation: { line: 3, column: 5 } },
          { byteOffset: 12, sourceLocation: { line: 3, column: 7 } },
        ],
      },
    ],
  },
};

console.log("=".repeat(70));
console.log("PEX Bytecode Disassembler Demo");
console.log("=".repeat(70));
console.log();
console.log("Source code (conceptual):");
console.log("  let: x 10");
console.log("  let: y 20");
console.log("  + x y");
console.log();
console.log("=".repeat(70));
console.log();

// Disassemble the bytecode
const disassembly = disassemble(sampleBytecode);
console.log(disassembly);
