# PEX Lang

PEX (short for pipe expression language) is a small lisp-like language designed for data manipulation and transformation. It's designed to be terse and embeddable.

## Language Tour

### Basic Expressions

Let's write a simple expression to transform `"  USER@EXAMPLE.COM  "` into `"user@example.com"`

```lisp
(trim (lower $$))
```

`$$` represents input to the program.

### Pipeline Composition

PEX offers a pipeline syntax for cleaner composition.

The previous example can be rewritten as:

```lisp
$$ | trim | lower
```

Effectively the pipeline operator turns `x | y` into the s-expression `(y x)`. It's important to note that the pipeline operator inserts the input value as the first argument to the function on the right side of the pipeline.

So `x | (y z)` becomes `(y x z)`.

#### Explicit Pipeline Input with `$`

By default, the pipeline operator passes the left side as the first argument. But sometimes you need more control over where the input goes. Use `$` to explicitly specify the input position:

```lisp
;; Default: input goes to first argument
$$ | replace /\D/g ""
;; Becomes: (replace $$ /\D/g "")

;; Explicit: use $ to control positioning
$$ | join "prefix-" $ "-suffix"
;; Becomes: (join "prefix-" $$ "-suffix")

;; Multiple uses of $
$$ | if (> $ 10) $ 0
;; Becomes: (if (> $$ 10) $$ 0)
```

When `$` appears anywhere in an expression, the automatic first-argument injection is disabled, giving you full control.

#### Implicit Program Input

In the examples above, we explicitly used `$$` to reference the program input, but this isn't necessary. If the first expression in your program[^1] doesn't reference `$$` or `$`, the input is automatically injected as the first argument:

```lisp
;; Without auto-injection:
(lower $$)

;; With auto-injection (equivalent):
lower
;; Becomes: (lower $$)

;; Works with pipelines too:
lower | trim
;; Becomes: (trim (lower $$))
```

**The rule:** If `$` or `$$` appears anywhere in the first expression, no auto-injection occurs. This gives you full control when you need it:

```lisp
;; Uses $ explicitly, so no auto-injection
if (> $ 10) "big" "small"
;; Stays as: (if (> $ 10) "big" "small")
```

This auto-injection makes common transformations more concise while still allowing explicit control when needed

[^1]: By "first expression" we mean the first expression that isn't a function definition (`fn`) or variable binding (`let`). These definitions are evaluated first, then auto-injection applies to the first actual transformation expression.

### Conditionals

```lisp
;; Categorize by value
if (> $ 100) "expensive" "affordable"
;; Input: 150 → Output: "expensive"
;; Input: 50 → Output: "affordable"
```

### Functions and Constants

```lisp
;; Temperature conversion
let FREEZING 32;
let RATIO 1.8;

fn c_to_f (c)
  + (* c RATIO) FREEZING;

fn f_to_c (f)
  / (- f FREEZING) RATIO;

100 | c_to_f  ;; → 212
```

### Multi-Source Transformation

```lisp
;; Combine multiple inputs
join $0 " " $1 | trim
;; Input: ["John", "Doe"] → Output: "John Doe"
```

### Complex Data Processing

```lisp
;; Email cleaning with plus addressing removal
let EMAIL_REGEX /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

fn normalize (email)
  lower email | trim;

fn remove_plus (email)
  replace email /\+.*@/ "@";

fn process_email (email)
  normalize email | remove_plus;

process_email "User+spam@Example.COM"  ;; → "user@example.com"
```

To see more examples and the full specification, check out the [PEX Spec](PEX_SPEC.md).

## Development

This project uses [Mise](https://github.com/jdx/mise) to run scripts and manage dependencies.

If you don't already have mise installed, you can install it using the following command:

```bash
curl https://mise.run | sh
```

Once mise is installed, you can run the following command to setup the project:

```bash
mise install
```

### Monorepo Structure

This project is organized as a monorepo with multiple packages:

- **`packages/tree-sitter-pex/`** - Tree-sitter grammar for PEX language
  - Provides syntax highlighting and parsing for editors
  - See [packages/tree-sitter-pex/README.md](packages/tree-sitter-pex/README.md)

### Running Tasks

The project uses mise with monorepo support. You can run tasks using the `//` syntax:

```bash
# Run all tests across all packages
mise run '//...:test'

# Run tree-sitter grammar tests
mise run //packages/tree-sitter-pex:test

# Generate tree-sitter parser
mise run //packages/tree-sitter-pex:generate

# See all available tasks
mise tasks
```
