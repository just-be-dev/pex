/**
 * Example PEX programs for the playground
 */

export interface Example {
  name: string;
  code: string;
  input?: string;
  description: string;
}

export const EXAMPLES: Example[] = [
  {
    name: "Simple Arithmetic",
    code: "(+ 1 2)",
    input: "null",
    description: "Basic arithmetic with numbers",
  },
  {
    name: "String Transform Pipeline",
    code: "$$ | lower | trim",
    input: '"  HELLO WORLD  "',
    description: "Transform input using pipe operations",
  },
  {
    name: "Fibonacci Function",
    code: `fn: fibonacci (n)
  (if (<= n 1)
    n
    (+ (fibonacci (- n 1)) (fibonacci (- n 2))));

(fibonacci $$)`,
    input: "10",
    description: "Recursive function to calculate Fibonacci numbers",
  },
  {
    name: "CSV Processing",
    code: `let: lines (split $$ "\\n");
let: process_line (fn (line)
  let: fields (split line ",");
  let: name (get fields 0);
  let: age (get fields 1);
  (join name " is " age " years old")
);
[
  (process_line (get lines 0))
  (process_line (get lines 1))
]`,
    input: '"Alice,30\\nBob,25"',
    description: "Parse and transform CSV data",
  },
  {
    name: "Conditionals",
    code: `if (> $$ 100)
  "expensive"
  "affordable"`,
    input: "150",
    description: "Conditional logic based on input value",
  },
  {
    name: "Closures (Make Adder)",
    code: `fn: make_adder (x)
  (fn (y) (+ x y));

let: add5 (make_adder 5);
let: add10 (make_adder 10);

[(add5 3) (add10 3) (add5 (add10 2))]`,
    input: "null",
    description: "Higher-order functions and closures",
  },
  {
    name: "Array Operations",
    code: `let: numbers [1 2 3 4 5];
let: doubled (map numbers (fn (x) (* x 2)));
let: sum (reduce doubled 0 (fn (acc x) (+ acc x)));
sum`,
    input: "null",
    description: "Working with arrays using map and reduce",
  },
  {
    name: "Object Manipulation",
    code: `let: person { name: "Alice" age: 30 city: "NYC" };
let: greeting (join "Hello, " (get person "name") " from " (get person "city"));
greeting`,
    input: "null",
    description: "Create and access object properties",
  },
];
