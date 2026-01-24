/**
 * PEX Playground - Main Application Logic
 *
 * Sets up the CodeMirror editor, handles example selection,
 * executes PEX code, and displays results.
 */

// PEX VM
import {
  executePEX,
  displayValue,
  nullValue,
  numberValue,
  stringValue,
  arrayValue,
  objectValue,
  booleanValue,
  type Value,
} from "../lib/vm/index.ts";
import { LexerError, ParseError } from "../lib/parser/index.ts";
import { VMError, VMRuntimeError } from "../lib/vm/index.ts";

// CodeMirror
import { EditorView, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { basicSetup } from "codemirror";

// PEX Language Support (Tree-sitter)
import { pexLanguageSupport } from "./lang-pex.ts";

// Examples
import { EXAMPLES, type Example } from "./examples.ts";

// =============================================================================
// Global State
// =============================================================================

let editor: EditorView | null = null;

// =============================================================================
// Editor Initialization
// =============================================================================

/**
 * Initialize the CodeMirror editor with syntax highlighting
 */
function initEditor(): EditorView {
  const pexLang = pexLanguageSupport();

  const view = new EditorView({
    doc: EXAMPLES[0]!.code,
    extensions: [
      basicSetup,
      pexLang, // PEX syntax highlighting via Tree-sitter
      keymap.of([
        ...defaultKeymap,
        indentWithTab,
        {
          key: "Ctrl-Enter",
          run: () => {
            runCode();
            return true;
          },
        },
        {
          key: "Cmd-Enter",
          run: () => {
            runCode();
            return true;
          },
        },
      ]),
      EditorView.lineWrapping,
    ],
    parent: document.getElementById("editor")!,
  });

  return view;
}

// =============================================================================
// Input Parsing
// =============================================================================

/**
 * Parse input string into a PEX Value
 *
 * Tries to parse as JSON first, falls back to string.
 * Special handling for "null" keyword.
 */
function parseInput(input: string): Value {
  const trimmed = input.trim();

  // Handle explicit null
  if (trimmed === "" || trimmed === "null") {
    return nullValue();
  }

  // Try to parse as JSON
  try {
    const parsed = JSON.parse(trimmed);
    return convertToValue(parsed);
  } catch {
    // If JSON parsing fails, treat as a string
    return stringValue(trimmed);
  }
}

/**
 * Convert JavaScript values to PEX Value types
 */
function convertToValue(val: unknown): Value {
  if (val === null || val === undefined) {
    return nullValue();
  }

  if (typeof val === "boolean") {
    return booleanValue(val);
  }

  if (typeof val === "number") {
    return numberValue(val);
  }

  if (typeof val === "string") {
    return stringValue(val);
  }

  if (Array.isArray(val)) {
    return arrayValue(val.map(convertToValue));
  }

  if (typeof val === "object") {
    const map = new Map<string, Value>();
    for (const [key, value] of Object.entries(val)) {
      map.set(key, convertToValue(value));
    }
    return objectValue(map);
  }

  // Fallback to null for unknown types
  return nullValue();
}

// =============================================================================
// Code Execution
// =============================================================================

/**
 * Execute PEX code with input and display result
 */
function runCode(): void {
  if (!editor) return;

  const code = editor.state.doc.toString();
  const inputElement = document.getElementById("input") as HTMLTextAreaElement;
  const outputElement = document.getElementById("output") as HTMLDivElement;

  // Clear previous output classes
  outputElement.className = "";

  try {
    // Parse input
    const input = parseInput(inputElement.value);

    // Execute PEX code
    const result = executePEX(code, { input });

    // Display result
    outputElement.textContent = displayValue(result);
    outputElement.classList.add("success");
  } catch (error) {
    // Format and display error
    const errorMessage = formatError(error);
    outputElement.textContent = errorMessage;
    outputElement.classList.add("error");
  }
}

/**
 * Format error messages based on error type
 */
function formatError(error: unknown): string {
  if (error instanceof LexerError) {
    return `Syntax Error (line ${error.line}, col ${error.column}): ${error.message}`;
  }

  if (error instanceof ParseError) {
    return `Parse Error (line ${error.line}, col ${error.column}): ${error.message}`;
  }

  if (error instanceof VMRuntimeError) {
    return `Runtime Error: ${error.message}`;
  }

  if (error instanceof VMError) {
    return `VM Error: ${error.message}`;
  }

  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }

  return `Unknown error: ${String(error)}`;
}

// =============================================================================
// Example Management
// =============================================================================

/**
 * Populate the examples dropdown
 */
function populateExamples(): void {
  const select = document.getElementById("examples") as HTMLSelectElement;

  for (const example of EXAMPLES) {
    const option = document.createElement("option");
    option.value = example.name;
    option.textContent = example.name;
    select.appendChild(option);
  }
}

/**
 * Handle example selection
 */
function handleExampleSelect(event: Event): void {
  if (!editor) return;

  const select = event.target as HTMLSelectElement;
  const exampleName = select.value;

  if (!exampleName) return;

  const example = EXAMPLES.find((ex) => ex.name === exampleName);
  if (!example) return;

  // Update editor content
  editor.dispatch({
    changes: {
      from: 0,
      to: editor.state.doc.length,
      insert: example.code,
    },
  });

  // Update input
  const inputElement = document.getElementById("input") as HTMLTextAreaElement;
  inputElement.value = example.input ?? "null";

  // Clear output
  const outputElement = document.getElementById("output") as HTMLDivElement;
  outputElement.textContent = "Ready. Click \"Run\" or press Ctrl+Enter to execute.";
  outputElement.className = "";
}

// =============================================================================
// Initialization
// =============================================================================

/**
 * Initialize the playground
 */
function init(): void {
  try {
    // Show loading state
    const outputElement = document.getElementById("output") as HTMLDivElement;
    outputElement.textContent = "Loading editor...";

    // Initialize editor with syntax highlighting
    editor = initEditor();

    // Populate examples dropdown
    populateExamples();

    // Load first example's input
    const inputElement = document.getElementById("input") as HTMLTextAreaElement;
    inputElement.value = EXAMPLES[0]!.input ?? "null";

    // Set up event listeners
    const runButton = document.getElementById("run-btn") as HTMLButtonElement;
    runButton.addEventListener("click", runCode);

    const examplesSelect = document.getElementById("examples") as HTMLSelectElement;
    examplesSelect.addEventListener("change", handleExampleSelect);

    // Update output to ready state
    outputElement.textContent = 'Ready. Click "Run" or press Ctrl+Enter to execute.';
    outputElement.className = "";
  } catch (error) {
    console.error("Failed to initialize playground:", error);
    const outputElement = document.getElementById("output") as HTMLDivElement;
    outputElement.textContent = `Failed to initialize: ${error instanceof Error ? error.message : String(error)}`;
    outputElement.classList.add("error");
  }
}

// Start the application when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
