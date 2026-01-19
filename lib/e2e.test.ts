/**
 * Comprehensive End-to-End Tests for the Complete PEX VM Pipeline
 *
 * Tests the entire compilation and execution pipeline:
 * Source → Tokenize → Parse → AST → IR → Bytecode → VM Execution
 *
 * Coverage:
 * - Basic programs (arithmetic, strings, arrays, literals)
 * - Functions and closures
 * - Recursive functions
 * - Pipelines with multiple stages
 * - Algebraic effects with custom handlers
 * - Complex nested expressions
 * - Error handling
 * - Real PEX programs from the specification
 */

import { describe, test as it, expect } from "bun:test";
import { parse } from "./parser/index.ts";
import { lowerProgram } from "./ir/lower.ts";
import { generateBytecode } from "./codegen/bytecode.ts";
import { VM, type EffectHandler, Continuation } from "./vm/vm.ts";
import {
  nullValue,
  booleanValue,
  numberValue,
  stringValue,
  arrayValue,
  type Value,
  displayValue,
} from "./vm/values.ts";

/**
 * Helper: Run a PEX source program through the complete pipeline
 */
function runPexProgram(source: string, input: Value = nullValue(), effectHandler?: EffectHandler): Value {
  // Parse source to AST
  const ast = parse(source);

  // Lower AST to IR
  const ir = lowerProgram(ast);

  // Generate bytecode from IR
  const bytecode = generateBytecode(ir);

  // Execute on VM
  const vm = new VM(
    bytecode,
    effectHandler || ((name, _args, _cont) => {
      throw new Error(`Unhandled effect: ${name}`);
    })
  );

  return vm.run(input);
}

describe("End-to-End Pipeline Tests", () => {
  describe("Basic Literals and Constants", () => {
    it("should execute null literal", () => {
      const result = runPexProgram("null");
      expect(result).toEqual(nullValue());
    });

    it("should execute boolean true", () => {
      const result = runPexProgram("true");
      expect(result).toEqual(booleanValue(true));
    });

    it("should execute boolean false", () => {
      const result = runPexProgram("false");
      expect(result).toEqual(booleanValue(false));
    });

    it("should execute integer literal", () => {
      const result = runPexProgram("42");
      expect(result).toEqual(numberValue(42));
    });

    it("should execute float literal", () => {
      const result = runPexProgram("3.14");
      expect(result).toEqual(numberValue(3.14));
    });

    it("should execute string literal", () => {
      const result = runPexProgram('"hello world"');
      expect(result).toEqual(stringValue("hello world"));
    });

    it("should execute zero", () => {
      const result = runPexProgram("0");
      expect(result).toEqual(numberValue(0));
    });

    it("should execute one", () => {
      const result = runPexProgram("1");
      expect(result).toEqual(numberValue(1));
    });
  });

  describe("Arithmetic Operations", () => {
    it("should execute simple addition", () => {
      const result = runPexProgram("(+ 10 20)");
      expect(result).toEqual(numberValue(30));
    });

    it("should execute simple subtraction", () => {
      const result = runPexProgram("(- 20 8)");
      expect(result).toEqual(numberValue(12));
    });

    it("should execute multiplication", () => {
      const result = runPexProgram("(* 6 7)");
      expect(result).toEqual(numberValue(42));
    });

    it("should execute division", () => {
      const result = runPexProgram("(/ 20 4)");
      expect(result).toEqual(numberValue(5));
    });

    it("should execute modulo", () => {
      const result = runPexProgram("(% 10 3)");
      expect(result).toEqual(numberValue(1));
    });

    it("should execute nested arithmetic", () => {
      const result = runPexProgram("(+ (* 2 3) (* 4 5))");
      expect(result).toEqual(numberValue(26)); // (2*3) + (4*5) = 6 + 20 = 26
    });

    it("should execute complex expression", () => {
      const result = runPexProgram("(* (+ 1 2) (- 10 5))");
      expect(result).toEqual(numberValue(15)); // (1+2) * (10-5) = 3 * 5 = 15
    });
  });

  describe("Comparison Operations", () => {
    it("should execute equality check (true)", () => {
      const result = runPexProgram("(== 5 5)");
      expect(result).toEqual(booleanValue(true));
    });

    it("should execute equality check (false)", () => {
      const result = runPexProgram("(== 5 6)");
      expect(result).toEqual(booleanValue(false));
    });

    it("should execute inequality check", () => {
      const result = runPexProgram("(!= 5 6)");
      expect(result).toEqual(booleanValue(true));
    });

    it("should execute less than", () => {
      const result = runPexProgram("(< 5 10)");
      expect(result).toEqual(booleanValue(true));
    });

    it("should execute greater than", () => {
      const result = runPexProgram("(> 10 5)");
      expect(result).toEqual(booleanValue(true));
    });

    it("should execute less than or equal", () => {
      const result = runPexProgram("(<= 5 5)");
      expect(result).toEqual(booleanValue(true));
    });

    it("should execute greater than or equal", () => {
      const result = runPexProgram("(>= 10 5)");
      expect(result).toEqual(booleanValue(true));
    });
  });

  describe("Conditional Expressions", () => {
    it("should execute if with true condition", () => {
      const result = runPexProgram('(if true "yes" "no")');
      expect(result).toEqual(stringValue("yes"));
    });

    it("should execute if with false condition", () => {
      const result = runPexProgram('(if false "yes" "no")');
      expect(result).toEqual(stringValue("no"));
    });

    it("should execute if with comparison", () => {
      const result = runPexProgram("(if (> 10 5) 1 0)");
      expect(result).toEqual(numberValue(1));
    });

    it("should execute nested if expressions", () => {
      const result = runPexProgram("(if (> 10 5) (if (< 3 4) 1 2) 3)");
      expect(result).toEqual(numberValue(1));
    });
  });

  describe("Variable Bindings", () => {
    it("should bind and use a simple variable", () => {
      const result = runPexProgram("let: x 10; x");
      expect(result).toEqual(numberValue(10));
    });

    it("should bind and use multiple variables", () => {
      const result = runPexProgram("let: x 10; let: y 20; (+ x y)");
      expect(result).toEqual(numberValue(30));
    });

    it("should bind with computed value", () => {
      const result = runPexProgram("let: x (* 3 4); (+ x 2)");
      expect(result).toEqual(numberValue(14));
    });

    it("should shadow variables", () => {
      const result = runPexProgram("let: x 10; let: x 20; x");
      expect(result).toEqual(numberValue(20));
    });
  });

  describe("Function Definitions and Calls", () => {
    it("should define and call a simple function", () => {
      const result = runPexProgram("fn: double (x) (* x 2); (double 5)");
      expect(result).toEqual(numberValue(10));
    });

    it("should define and call function with multiple parameters", () => {
      const result = runPexProgram("fn: add (a b) (+ a b); (add 10 20)");
      expect(result).toEqual(numberValue(30));
    });

    it("should handle function with no parameters", () => {
      const result = runPexProgram("fn: get_answer () 42; (get_answer)");
      expect(result).toEqual(numberValue(42));
    });

    it("should handle nested function calls", () => {
      const result = runPexProgram(`
        fn: double (x) (* x 2);
        fn: add_one (x) (+ x 1);
        (add_one (double 5))
      `);
      expect(result).toEqual(numberValue(11)); // double(5) = 10, add_one(10) = 11
    });

    it("should handle function composition", () => {
      const result = runPexProgram(`
        fn: square (x) (* x x);
        fn: add_ten (x) (+ x 10);
        (add_ten (square 5))
      `);
      expect(result).toEqual(numberValue(35)); // 5*5 + 10 = 35
    });
  });

  describe("Closures and Upvalues", () => {
    it("should capture variables in closures", () => {
      const result = runPexProgram(`
        let: x 10;
        fn: add_x (y) (+ x y);
        (add_x 5)
      `);
      expect(result).toEqual(numberValue(15));
    });

    it("should handle nested closures (make_adder)", () => {
      const result = runPexProgram(`
        fn: make_adder (x) (fn: inner (y) (+ x y)) inner;
        let: add_ten (make_adder 10);
        (add_ten 5)
      `);
      expect(result).toEqual(numberValue(15));
    });

    it("should capture multiple variables", () => {
      const result = runPexProgram(`
        let: a 10;
        let: b 20;
        fn: combine (x) (+ (+ a b) x);
        (combine 5)
      `);
      expect(result).toEqual(numberValue(35)); // 10 + 20 + 5
    });
  });

  describe("Recursive Functions", () => {
    it("should execute simple recursion (countdown)", () => {
      const result = runPexProgram(`
        fn: countdown (n)
          (if (<= n 0)
            0
            (countdown (- n 1)));
        (countdown 5)
      `);
      expect(result).toEqual(numberValue(0));
    });

    it("should calculate factorial recursively", () => {
      const result = runPexProgram(`
        fn: factorial (n)
          (if (<= n 1)
            1
            (* n (factorial (- n 1))));
        (factorial 5)
      `);
      expect(result).toEqual(numberValue(120)); // 5! = 120
    });

    it("should calculate fibonacci recursively", () => {
      const result = runPexProgram(`
        fn: fib (n)
          (if (<= n 1)
            n
            (+ (fib (- n 1)) (fib (- n 2))));
        (fib 7)
      `);
      expect(result).toEqual(numberValue(13)); // fib(7) = 13
    });

    it("should handle mutually recursive functions", () => {
      const result = runPexProgram(`
        fn: is_even (n)
          (if (== n 0)
            true
            (is_odd (- n 1)));
        fn: is_odd (n)
          (if (== n 0)
            false
            (is_even (- n 1)));
        (is_even 6)
      `);
      expect(result).toEqual(booleanValue(true));
    });
  });

  describe("Builtin Functions", () => {
    it("should call string upper", () => {
      const result = runPexProgram('(upper "hello")');
      expect(result).toEqual(stringValue("HELLO"));
    });

    it("should call string lower", () => {
      const result = runPexProgram('(lower "HELLO")');
      expect(result).toEqual(stringValue("hello"));
    });

    it("should call string trim", () => {
      const result = runPexProgram('(trim "  hello  ")');
      expect(result).toEqual(stringValue("hello"));
    });

    it("should call string split", () => {
      const result = runPexProgram('(split "a,b,c" ",")');
      expect(result).toEqual(
        arrayValue([
          stringValue("a"),
          stringValue("b"),
          stringValue("c"),
        ])
      );
    });

    it("should call string join", () => {
      const result = runPexProgram('(join "hello" " " "world")');
      expect(result).toEqual(stringValue("hello world"));
    });

    it("should call len on string", () => {
      const result = runPexProgram('(len "hello")');
      expect(result).toEqual(numberValue(5));
    });

    it("should call len on array", () => {
      const result = runPexProgram('(len (split "a,b,c" ","))');
      expect(result).toEqual(numberValue(3));
    });
  });

  describe("Pipeline Operations", () => {
    it("should execute simple pipeline with input", () => {
      const result = runPexProgram(
        "$$ | upper",
        stringValue("hello")
      );
      expect(result).toEqual(stringValue("HELLO"));
    });

    it("should execute multi-stage pipeline", () => {
      const result = runPexProgram(
        "$$ | lower | trim",
        stringValue("  HELLO  ")
      );
      expect(result).toEqual(stringValue("hello"));
    });

    it("should execute pipeline with function calls", () => {
      const result = runPexProgram(
        "fn: double (x) (* x 2); $$ | double",
        numberValue(5)
      );
      expect(result).toEqual(numberValue(10));
    });

    it("should execute complex pipeline with multiple operations", () => {
      const result = runPexProgram(
        '$$ | split " " | (len $)',
        stringValue("hello world test")
      );
      expect(result).toEqual(numberValue(3));
    });

    it("should reference $$ in pipeline", () => {
      const result = runPexProgram(
        "$$ | (* $ 2) | (+ $ $$)",
        numberValue(5)
      );
      expect(result).toEqual(numberValue(15)); // (5 * 2) + 5 = 15
    });
  });

  describe("Array Operations", () => {
    it("should create and index array", () => {
      const result = runPexProgram('(get (split "a,b,c" ",") 1)');
      expect(result).toEqual(stringValue("b"));
    });

    it("should get first element", () => {
      const result = runPexProgram('(first (split "a,b,c" ","))');
      expect(result).toEqual(stringValue("a"));
    });

    it("should get last element", () => {
      const result = runPexProgram('(last (split "a,b,c" ","))');
      expect(result).toEqual(stringValue("c"));
    });

    it("should handle out of bounds access", () => {
      const result = runPexProgram('(get (split "a,b" ",") 10)');
      expect(result).toEqual(nullValue());
    });
  });

  describe("Source Variable References", () => {
    it("should access $$ (program input)", () => {
      const result = runPexProgram("$$", numberValue(42));
      expect(result).toEqual(numberValue(42));
    });

    it("should access $0 from array input", () => {
      const result = runPexProgram(
        "$0",
        arrayValue([numberValue(10), numberValue(20)])
      );
      expect(result).toEqual(numberValue(10));
    });

    it("should access $1 from array input", () => {
      const result = runPexProgram(
        "$1",
        arrayValue([numberValue(10), numberValue(20)])
      );
      expect(result).toEqual(numberValue(20));
    });

    it("should use multiple source refs", () => {
      const result = runPexProgram(
        "(+ $0 $1)",
        arrayValue([numberValue(10), numberValue(20)])
      );
      expect(result).toEqual(numberValue(30));
    });
  });

  describe("Algebraic Effects", () => {
    it("should handle print effect", () => {
      let printed: string[] = [];
      const effectHandler: EffectHandler = (name, args, cont) => {
        if (name === "print") {
          printed.push(...args.map(v => displayValue(v)));
          cont.resume(nullValue());
        }
      };

      const result = runPexProgram(
        'print: "hello"; print: "world"; 42',
        nullValue(),
        effectHandler
      );

      expect(printed).toEqual(["hello", "world"]);
      expect(result).toEqual(numberValue(42));
    });

    it("should handle debug effect", () => {
      let debugged: Value[] = [];
      const effectHandler: EffectHandler = (name, args, cont) => {
        if (name === "debug") {
          debugged.push(...args);
          cont.resume(nullValue());
        }
      };

      const result = runPexProgram(
        "let: x 10; debug: x; debug: 20; (+ x 5)",
        nullValue(),
        effectHandler
      );

      expect(debugged).toEqual([numberValue(10), numberValue(20)]);
      expect(result).toEqual(numberValue(15));
    });

    it("should handle custom effect with continuation", () => {
      const effectHandler: EffectHandler = (name, args, cont) => {
        if (name === "double") {
          const value = args[0] as { type: "number"; value: number };
          cont.resume(numberValue(value.value * 2));
        }
      };

      const result = runPexProgram(
        "(+ (double: 5) 3)",
        nullValue(),
        effectHandler
      );

      expect(result).toEqual(numberValue(13)); // (5 * 2) + 3
    });

    it("should handle effect in function", () => {
      let logged: string[] = [];
      const effectHandler: EffectHandler = (name, args, cont) => {
        if (name === "log") {
          logged.push(...args.map(v => displayValue(v)));
          cont.resume(nullValue());
        }
      };

      const result = runPexProgram(
        `
        fn: process (x)
          (let: doubled (* x 2)
            (let: _ (log: doubled)
              doubled));
        (process 5)
        `,
        nullValue(),
        effectHandler
      );

      expect(logged).toEqual(["10"]);
      expect(result).toEqual(numberValue(10));
    });

    it("should handle multiple effects in sequence", () => {
      let effects: string[] = [];
      const effectHandler: EffectHandler = (name, args, cont) => {
        effects.push(name);
        cont.resume(nullValue());
      };

      runPexProgram(
        "(first: null); (second: null); (third: null); 42",
        nullValue(),
        effectHandler
      );

      expect(effects).toEqual(["first", "second", "third"]);
    });
  });

  describe("Complex Programs from PEX_SPEC.md", () => {
    it("should execute email normalization example", () => {
      const result = runPexProgram(
        '$$ | lower | trim | (replace $ /\\+.*@/ "@")',
        stringValue("  User+Tag@Example.COM  ")
      );
      expect(result).toEqual(stringValue("user@example.com"));
    });

    it("should execute temperature conversion", () => {
      const result = runPexProgram(`
        let: FREEZING 32;
        let: RATIO 1.8;
        fn: c_to_f (c) (+ (* c RATIO) FREEZING);
        (c_to_f 100)
      `);
      expect(result).toEqual(numberValue(212)); // 100C = 212F
    });

    it("should execute tax calculation", () => {
      const result = runPexProgram(`
        let: TAX_RATE 0.08;
        fn: add_tax (price) (* price (+ 1 TAX_RATE));
        (add_tax 100)
      `);
      expect(result).toEqual(numberValue(108)); // 100 * 1.08
    });

    it("should execute conditional processing", () => {
      const result = runPexProgram(`
        fn: categorize (n)
          (if (> n 100)
            "large"
            (if (> n 10)
              "medium"
              "small"));
        (categorize 50)
      `);
      expect(result).toEqual(stringValue("medium"));
    });

    it("should execute max function", () => {
      const result = runPexProgram(`
        fn: max (a b) (if (> a b) a b);
        (max 10 20)
      `);
      expect(result).toEqual(numberValue(20));
    });

    it("should execute string processing pipeline", () => {
      const result = runPexProgram(
        '$$ | split " " | (get $ 0) | upper',
        stringValue("hello world")
      );
      expect(result).toEqual(stringValue("HELLO"));
    });

    it("should execute word count", () => {
      const result = runPexProgram(`
        fn: word_count (text)
          (len (split text " "));
        (word_count "hello world test")
      `);
      expect(result).toEqual(numberValue(3));
    });
  });

  describe("Error Handling", () => {
    it("should handle division by zero", () => {
      expect(() => {
        runPexProgram("(/ 10 0)");
      }).toThrow("Division by zero");
    });

    it("should handle undefined variable", () => {
      expect(() => {
        runPexProgram("undefined_var");
      }).toThrow();
    });

    it("should handle wrong number of arguments", () => {
      expect(() => {
        runPexProgram("fn: add (a b) (+ a b); (add 1)");
      }).toThrow();
    });

    it("should handle calling non-function", () => {
      expect(() => {
        runPexProgram("let: x 10; (x)");
      }).toThrow();
    });

    it("should handle unhandled effect", () => {
      expect(() => {
        runPexProgram('(unknown: "test")');
      }).toThrow("Unhandled effect: unknown");
    });
  });

  describe("Null Coalescing", () => {
    it("should coalesce null to default", () => {
      const result = runPexProgram("(?? null 42)");
      expect(result).toEqual(numberValue(42));
    });

    it("should keep non-null value", () => {
      const result = runPexProgram("(?? 10 42)");
      expect(result).toEqual(numberValue(10));
    });

    it("should work with function results", () => {
      const result = runPexProgram('(?? (get (split "a,b" ",") 5) "default")');
      expect(result).toEqual(stringValue("default"));
    });
  });

  describe("Logic Operations", () => {
    it("should execute NOT with true", () => {
      const result = runPexProgram("(not true)");
      expect(result).toEqual(booleanValue(false));
    });

    it("should execute NOT with false", () => {
      const result = runPexProgram("(not false)");
      expect(result).toEqual(booleanValue(true));
    });

    it("should short-circuit AND (true path)", () => {
      const result = runPexProgram("(and true true)");
      expect(result).toEqual(booleanValue(true));
    });

    it("should short-circuit AND (false path)", () => {
      const result = runPexProgram("(and false true)");
      expect(result).toEqual(booleanValue(false));
    });

    it("should short-circuit OR (true path)", () => {
      const result = runPexProgram("(or true false)");
      expect(result).toEqual(booleanValue(true));
    });

    it("should short-circuit OR (false path)", () => {
      const result = runPexProgram("(or false false)");
      expect(result).toEqual(booleanValue(false));
    });
  });

  describe("Sequence Expressions", () => {
    it("should execute multiple expressions", () => {
      const result = runPexProgram("1; 2; 3");
      expect(result).toEqual(numberValue(3));
    });

    it("should execute expressions with side effects", () => {
      let effects: string[] = [];
      const effectHandler: EffectHandler = (name, args, cont) => {
        if (name === "log") {
          effects.push(displayValue(args[0]!));
        }
        cont.resume(nullValue());
      };

      const result = runPexProgram(
        '(log: "first"); (log: "second"); 42',
        nullValue(),
        effectHandler
      );

      expect(effects).toEqual(["first", "second"]);
      expect(result).toEqual(numberValue(42));
    });

    it("should bind variables in sequence", () => {
      const result = runPexProgram(`
        let: a 10;
        let: b 20;
        let: c (+ a b);
        c
      `);
      expect(result).toEqual(numberValue(30));
    });
  });

  describe("Real-World Scenarios", () => {
    it("should process email pipeline", () => {
      const result = runPexProgram(`
        fn: normalize_email (email)
          (let: lowered (lower email)
            (let: trimmed (trim lowered)
              trimmed));
        (normalize_email "  USER@EXAMPLE.COM  ")
      `);
      expect(result).toEqual(stringValue("user@example.com"));
    });

    it("should implement counter with closure", () => {
      const result = runPexProgram(`
        fn: make_counter (start)
          (fn: count (n) (+ start n)) count;
        let: counter (make_counter 100);
        (counter 42)
      `);
      expect(result).toEqual(numberValue(142));
    });

    it("should calculate sum with recursion", () => {
      const result = runPexProgram(`
        fn: sum (n)
          (if (<= n 0)
            0
            (+ n (sum (- n 1))));
        (sum 10)
      `);
      expect(result).toEqual(numberValue(55)); // 1+2+3+...+10 = 55
    });

    it("should validate and transform input", () => {
      const result = runPexProgram(`
        fn: safe_transform (text)
          (if (> (len text) 0)
            (upper (trim text))
            "EMPTY");
        (safe_transform "  hello  ")
      `);
      expect(result).toEqual(stringValue("HELLO"));
    });

    it("should handle empty input gracefully", () => {
      const result = runPexProgram(`
        fn: safe_transform (text)
          (if (> (len text) 0)
            (upper (trim text))
            "EMPTY");
        (safe_transform "")
      `);
      expect(result).toEqual(stringValue("EMPTY"));
    });
  });

  describe("Performance and Stress Tests", () => {
    it("should handle deep recursion (within limits)", () => {
      const result = runPexProgram(`
        fn: sum (n acc)
          (if (<= n 0)
            acc
            (sum (- n 1) (+ acc n)));
        (sum 100 0)
      `);
      expect(result).toEqual(numberValue(5050)); // Sum of 1 to 100
    });

    it("should handle multiple closures", () => {
      const result = runPexProgram(`
        fn: make_op (x) (fn: add_x (y) (+ x y)) add_x;
        let: add5 (make_op 5);
        let: add10 (make_op 10);
        (+ (add5 3) (add10 2))
      `);
      expect(result).toEqual(numberValue(20)); // (5+3) + (10+2) = 20
    });

    it("should handle many variable bindings", () => {
      const result = runPexProgram(`
        let: a 1;
        let: b 2;
        let: c 3;
        let: d 4;
        let: e 5;
        (+ (+ (+ (+ a b) c) d) e)
      `);
      expect(result).toEqual(numberValue(15));
    });

    it("should handle nested function calls", () => {
      const result = runPexProgram(`
        fn: f1 (x) (+ x 1);
        fn: f2 (x) (* x 2);
        fn: f3 (x) (- x 3);
        (f1 (f2 (f3 10)))
      `);
      expect(result).toEqual(numberValue(15)); // ((10-3)*2)+1 = 15
    });
  });
});

describe("Edge Cases and Corner Cases", () => {
  describe("Empty and Null Cases", () => {
    it("should handle empty string", () => {
      const result = runPexProgram('""');
      expect(result).toEqual(stringValue(""));
    });

    it("should handle operations on empty string", () => {
      const result = runPexProgram('(len "")');
      expect(result).toEqual(numberValue(0));
    });

    it("should handle null in conditionals", () => {
      const result = runPexProgram("(if null 1 2)");
      expect(result).toEqual(numberValue(2)); // null is falsy
    });
  });

  describe("Boundary Values", () => {
    it("should handle zero", () => {
      const result = runPexProgram("(* 0 100)");
      expect(result).toEqual(numberValue(0));
    });

    it("should handle negative numbers", () => {
      const result = runPexProgram("(+ -5 10)");
      expect(result).toEqual(numberValue(5));
    });

    it("should handle large numbers", () => {
      const result = runPexProgram("(* 1000 1000)");
      expect(result).toEqual(numberValue(1000000));
    });
  });

  describe("Type Coercion", () => {
    it("should handle truthy values in conditions", () => {
      const result = runPexProgram("(if 1 true false)");
      expect(result).toEqual(booleanValue(true));
    });

    it("should handle falsy values in conditions", () => {
      const result = runPexProgram("(if 0 true false)");
      expect(result).toEqual(booleanValue(false));
    });
  });
});
