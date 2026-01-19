/**
 * Example usage of the PEX VM public API.
 *
 * This file demonstrates the different ways to use the VM API:
 * 1. Simple one-shot execution with executePEX()
 * 2. Compile once, execute many times with compilePEX() + executeBytecode()
 * 3. Create a reusable VM instance with createVM()
 * 4. Handle algebraic effects with custom effect handlers
 */

import {
  executePEX,
  compilePEX,
  executeBytecode,
  createVM,
  numberValue,
  stringValue,
  nullValue,
  displayValue,
  type EffectHandler,
} from "./index.ts";

// =============================================================================
// Example 1: Simple one-shot execution
// =============================================================================

console.log("Example 1: Simple one-shot execution");
console.log("=====================================");

// Execute a simple arithmetic expression
const result1 = executePEX("(+ 1 2)");
console.log("(+ 1 2) =>", displayValue(result1)); // 3

// Execute with input
const result2 = executePEX("(* $$ 2)", {
  input: numberValue(21),
});
console.log("(* 21 2) =>", displayValue(result2)); // 42

// Execute string operations
const result3 = executePEX('(upper "hello world")');
console.log('(upper "hello world") =>', displayValue(result3)); // HELLO WORLD

console.log();

// =============================================================================
// Example 2: Compile once, execute many times
// =============================================================================

console.log("Example 2: Compile once, execute many");
console.log("======================================");

// Compile the program once
const bytecode = compilePEX("$$ | (split $ \" \") | (get $ 0) | upper");

// Execute with different inputs
const inputs = ["hello world", "foo bar", "test case"];
for (const input of inputs) {
  const result = executeBytecode(bytecode, {
    input: stringValue(input),
  });
  console.log(`"${input}" =>`, displayValue(result));
}

console.log();

// =============================================================================
// Example 3: Create a reusable VM instance
// =============================================================================

console.log("Example 3: Reusable VM instance");
console.log("================================");

// Compile and create VM
const bytecode2 = compilePEX(`
  fn: fibonacci (n)
    (if (<= n 1)
      n
      (+ (fibonacci (- n 1)) (fibonacci (- n 2))))
  (fibonacci $$)
`);
const vm = createVM(bytecode2);

// Execute multiple times with different inputs
console.log("Fibonacci sequence:");
for (let i = 0; i <= 10; i++) {
  const result = vm.run(numberValue(i));
  console.log(`  fib(${i}) =`, displayValue(result));
}

console.log();

// =============================================================================
// Example 4: Algebraic effects with custom handler
// =============================================================================

console.log("Example 4: Algebraic effects");
console.log("=============================");

// Create a custom effect handler that logs to console
const logs: string[] = [];
const effectHandler: EffectHandler = (name, args, continuation) => {
  if (name === "log") {
    // Handle the log effect by printing to console and saving to array
    const message = args.map((v) => displayValue(v)).join(" ");
    console.log("[LOG]", message);
    logs.push(message);
    // Resume execution with null (log doesn't return a value)
    continuation.resume(nullValue());
  } else if (name === "ask") {
    // Handle the ask effect by returning a mock value
    const question = displayValue(args[0]!);
    console.log("[ASK]", question);
    // In a real implementation, this would wait for user input
    // For demo purposes, we'll just return a fixed value
    continuation.resume(stringValue("World"));
  } else {
    throw new Error(`Unknown effect: ${name}`);
  }
};

// Execute a program with effects
const result4 = executePEX(
  `
  log: "Starting program...";
  let: name (effect ask "What is your name?");
  let: greeting (join "Hello, " name "!");
  log: greeting;
  greeting
`,
  { effectHandler }
);

console.log("Final result:", displayValue(result4));
console.log("Logged messages:", logs);

console.log();

// =============================================================================
// Example 5: Complex data transformations
// =============================================================================

console.log("Example 5: Complex data transformations");
console.log("========================================");

// Process CSV-like data
const csvData = stringValue("Alice,30,Engineer\nBob,25,Designer\nCarol,35,Manager");

const result5 = executePEX(
  `
  let: lines (split $$ "\\n");
  let: process_line (fn (line)
    let: fields (split line ",");
    let: name (get fields 0);
    let: age (get fields 1);
    let: role (get fields 2);
    (join name " is " age " years old and works as a " role)
  );
  [
    (process_line (get lines 0))
    (process_line (get lines 1))
    (process_line (get lines 2))
  ]
`,
  { input: csvData }
);

console.log("Processed data:");
if (result5.type === "array") {
  result5.elements.forEach((item, i) => {
    console.log(`  ${i + 1}.`, displayValue(item));
  });
}

console.log();

// =============================================================================
// Example 6: Closures and higher-order functions
// =============================================================================

console.log("Example 6: Closures and higher-order functions");
console.log("===============================================");

const result6 = executePEX(`
  // Create a function that makes adders
  fn: make_adder (x)
    (fn (y) (+ x y));

  // Create specific adders
  let: add5 (make_adder 5);
  let: add10 (make_adder 10);

  // Use them
  [(add5 3) (add10 3) (add5 (add10 2))]
`);

console.log("Results:", displayValue(result6)); // [8, 13, 17]

console.log();

// =============================================================================
// Example 7: Tax calculation with closures
// =============================================================================

console.log("Example 7: Tax calculation");
console.log("==========================");

const result7 = executePEX(`
  let: TAX_RATE 0.08;
  let: DISCOUNT_THRESHOLD 100;
  let: DISCOUNT_RATE 0.1;

  fn: calculate_total (price quantity)
    let: subtotal (* price quantity);
    let: discount
      (if (>= subtotal DISCOUNT_THRESHOLD)
        (* subtotal DISCOUNT_RATE)
        0);
    let: discounted (* subtotal (- 1 DISCOUNT_RATE));
    let: with_tax (* discounted (+ 1 TAX_RATE));
    with_tax;

  [
    (calculate_total 50 1)
    (calculate_total 50 2)
    (calculate_total 50 3)
  ]
`);

console.log("Order totals with tax and discount:", displayValue(result7));
// [54, 97.2, 145.8] - first order no discount, rest with discount
