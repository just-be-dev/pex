#!/usr/bin/env bun

/**
 * PEX CLI - Command-line interface for the PEX interpreter
 */

import { parse } from "./lib/parser/index.ts";
import { lowerProgram } from "./lib/ir/lower.ts";
import { generateBytecode } from "./lib/codegen/bytecode.ts";
import { VM, type EffectHandler } from "./lib/vm/index.ts";
import { displayValue } from "./lib/vm/values.ts";
import { readFileSync } from "fs";

interface CLIOptions {
  shellMode: boolean;
  file?: string;
  expr?: string;
  input?: string;
  help: boolean;
}

function parseArgs(args: string[]): CLIOptions {
  const options: CLIOptions = {
    shellMode: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "-h":
      case "--help":
        options.help = true;
        break;

      case "-s":
      case "--shell":
        options.shellMode = true;
        break;

      case "-f":
      case "--file":
        if (i + 1 >= args.length) {
          console.error("Error: --file requires a file path");
          process.exit(1);
        }
        options.file = args[++i];
        break;

      case "-e":
      case "--expr":
        if (i + 1 >= args.length) {
          console.error("Error: --expr requires an expression");
          process.exit(1);
        }
        options.expr = args[++i];
        break;

      case "-i":
      case "--input":
        if (i + 1 >= args.length) {
          console.error("Error: --input requires a value");
          process.exit(1);
        }
        options.input = args[++i];
        break;

      default:
        if (arg && !arg.startsWith("-")) {
          // First non-option argument is treated as expression
          if (!options.expr && !options.file) {
            options.expr = arg;
          } else {
            console.error(`Error: Unknown argument: ${arg}`);
            process.exit(1);
          }
        } else {
          console.error(`Error: Unknown option: ${arg}`);
          process.exit(1);
        }
    }
  }

  return options;
}

function printHelp() {
  console.log(`
PEX Interpreter - Pipe Expression Language

USAGE:
  pex [OPTIONS] [EXPRESSION]
  pex [OPTIONS] --file <FILE>

OPTIONS:
  -h, --help           Show this help message
  -s, --shell          Enable shell mode (auto-inject $$)
  -e, --expr <EXPR>    Execute expression
  -f, --file <FILE>    Execute file
  -i, --input <VALUE>  Provide input value (JSON or string)

EXAMPLES:
  # Execute expression with input
  pex -i "hello world" "upper $$"

  # Execute in shell mode (auto-inject $$)
  pex -s -i "hello world" "upper | trim"

  # Execute file
  pex -f program.pex -i '["John", "Doe"]'

  # Pipe input from stdin
  echo "test@example.com" | pex "$$ | lower | trim"

  # Execute inline expression
  pex "join \\"Hello\\" \\" \\" \\"World\\""

For more information, see: https://github.com/your-repo/pex
`);
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];

  // Add a timeout to prevent hanging on open but idle stdin
  const timeoutMs = 5000; // 5 seconds
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Stdin read timeout")), timeoutMs);
  });

  try {
    await Promise.race([
      (async () => {
        for await (const chunk of process.stdin) {
          chunks.push(chunk);
        }
      })(),
      timeoutPromise,
    ]);
  } catch (error) {
    // If timeout, return empty string (no stdin data available)
    if ((error as Error).message === "Stdin read timeout") {
      return "";
    }
    throw error;
  }

  return Buffer.concat(chunks).toString("utf-8").trim();
}

function parseInput(inputStr: string): any {
  // Try to parse as JSON first
  try {
    return JSON.parse(inputStr);
  } catch {
    // If not valid JSON, treat as string
    return inputStr;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  // Get source code
  let source: string;
  if (options.file) {
    try {
      source = readFileSync(options.file, "utf-8");
    } catch (error) {
      console.error(`Error reading file '${options.file}': ${(error as Error).message}`);
      process.exit(1);
    }
  } else if (options.expr) {
    source = options.expr;
  } else {
    console.error("Error: Must provide either --expr or --file");
    printHelp();
    process.exit(1);
  }

  // Get input
  let input: any = null;
  if (options.input) {
    input = parseInput(options.input);
  } else if (!process.stdin.isTTY) {
    // Read from stdin if available
    const stdinData = await readStdin();
    if (stdinData) {
      input = parseInput(stdinData);
    }
  }

  // Execute
  try {
    // Parse
    const ast = parse(source, { shellMode: options.shellMode });

    // Lower to IR
    const irModule = lowerProgram(ast);

    // Generate bytecode
    const bytecode = generateBytecode(irModule);

    // Create effect handler (no-op for now)
    const effectHandler: EffectHandler = (name, _args, _continuation) => {
      console.error(`Unhandled effect: ${name}`);
      process.exit(1);
    };

    // Run VM
    const vm = new VM(bytecode, effectHandler);
    const result = vm.run(input ?? null);

    // Output result
    const resultStr = displayValue(result);
    if (resultStr !== "null") {
      console.log(resultStr);
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
      process.exit(1);
    } else {
      console.error(`Error: ${String(error)}`);
      process.exit(1);
    }
  }
}

main().catch((error) => {
  console.error("Fatal error:", error.message);
  if (process.env.DEBUG) {
    console.error(error.stack);
  }
  process.exit(1);
});
