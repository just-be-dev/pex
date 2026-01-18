# Pex Language Specification

**Pex** - The Pipe Expression Language for bidirectional schema transformations

Version: 0.1.0  
Last Updated: January 2026

---

## Overview

Pex is a minimal expression language designed for defining bidirectional data transformations (lenses) between schemas. It combines the simplicity of S-expressions with the readability of Unix-style pipes.

**Core Philosophy:**
- Expressions are S-expressions at heart
- Pipes (`|`) provide syntactic sugar for composition
- Semicolons (`;`) terminate expressions
- Parentheses only when needed for grouping
- First-class functions and constants
- Two modes: explicit by default (normal mode), convenient for shells (shell mode)

---

## Syntax

### Basic Expressions

```lisp
;; S-expression (canonical form)
(lower email)

;; Without parens (function call)
lower email

;; With pipes (left-to-right flow)
email | lower | trim

;; Pipes desugar to nested S-expressions
;; email | lower | trim  →  (trim (lower email))
```

### Operators

| Operator | Purpose | Example |
|----------|---------|---------|
| `|` | Pipeline composition | `a | b | c` |
| `;` | Expression terminator | `let x 10;` |
| `( )` | Grouping (only when needed) | `(if (> x 10) a b)` |

### Effects (Special Forms)

Effects use a `:` postfix to identify special forms used for side effects (bindings, logging, assertions, etc.). They can appear anywhere in an expression.

```lisp
;; Variable binding (no output)
let: NAME VALUE

;; Function definition (no output)
fn: NAME (PARAMS) BODY

;; Logging/debugging (no output)
print: EXPRESSION
debug: EXPRESSION
assert: EXPRESSION

;; Regular expressions (produce output)
if CONDITION TRUE_EXPR FALSE_EXPR
lower | trim
```

**The `:` postfix**: Marks identifiers as effects.

---

## Program Structure

A Pex program consists of **one or more top-level expressions**. Expressions may be **effects** (identifiers with `:` postfix) used for side effects.

**Effects** (`:` postfix) are regular expressions that:
- Are used for side effects (bindings, logging, assertions)
- Can appear at the top level or nested anywhere in the expression tree
- Can be used conditionally

**Effects include:**
- `let:` - Variable bindings
- `fn:` - Function definitions
- `print:` - Console output (for debugging)
- `debug:` - Debug logging
- `assert:` - Runtime assertions

### Basic Example

```lisp
;; Sequential effects (traditional style)
let: TAX_RATE 0.08
fn: add_tax (price) * price (+ 1 TAX_RATE)
add_tax $$
```

### Nested Effects

Effects are expressions, so they can nest:

```lisp
;; Nested bindings
(let: x 10
  (let: y 20
    (+ x y)))

;; Conditional effects
(if (> count 0)
  (let: result (* count 2) result)
  0)

;; Effects in function bodies
fn: process (data)
  (let: cleaned (trim data)
    (let: normalized (lower cleaned)
      normalized))
```

The semicolon (`;`) is purely optional syntactic sugar and has no semantic meaning.

---

## Source Variables

Pex distinguishes between the program input and pipeline values:

- **`$$`** - The original program input (constant throughout execution)
- **`$`** - The current pipeline value (changes at each `|` stage)
- **`$0`, `$1`, `$2`, ...** - Array elements when `$$` is an array

```lisp
;; With $ - refers to piped value
split " " | (if (> (len $) 0) $ [])
;;                      ^      ^
;;                  piped value from split

;; With $$ - refers to original program input
if (> (len $$) 100) "long" "short"

;; Mix both - $$ is original, $ is piped
split $$ " " | (if (> (len $) 2) $ [$$])
;;      ^^                ^        ^^
;;   original         piped     original

;; Array sources
;; input: [first_name, last_name]
join $0 " " $1   ;; $0 and $1 are elements of $$
```

### Understanding `$` vs `$$`

**`$$` - Program Input (Constant)**
- The value passed into the entire expression
- Never changes during execution

**`$` - Pipeline Variable (Dynamic)**
- The current value flowing through a pipeline
- Changes at each `|` stage
- Only exists within pipeline contexts

**Examples:**

```lisp
;; Pipeline with $ reference
split " " | (if (> (len $) 0) $ [])
→ $ refers to the result of split

;; Reference original input mid-pipeline
split " " | (if (> (len $$) 100) "long-original" $)
→ $$ is the original input
→ $ is the split result

;; Multi-source with array elements
;; input: ["Alice", "Smith"]
join $0 " " $1
→ $0 and $1 are $$[0] and $$[1]
```

---

## Shell Mode and Auto-Injection

Pex supports two modes of operation:

### Normal Mode (Default)
When parsing without `shellMode` option, **no automatic `$$` injection occurs**. You must explicitly reference source variables:

```lisp
;; Normal mode - explicit variables required
lower $$           ;; → (lower $$)
split $$ " "       ;; → (split $$ " ")
$$ | lower | trim  ;; → (trim (lower $$))
```

### Shell Mode
When parsing with `shellMode: true`, the **last expression** receives automatic `$$` injection. This mode is designed for interactive shell environments where the final result should operate on stdin/program input.

**Auto-injection Rules in Shell Mode:**
- Only the **last expression** gets `$$` auto-injected
- Injection only occurs if no source variables (`$`, `$$`, `$N`) are present
- Effects can receive injection (the `:` postfix doesn't prevent injection in shell mode)
- Explicit parentheses can receive injection (parentheses don't prevent injection in shell mode)

**Examples:**

```lisp
// Shell mode enabled
a; b; c
→ (a) (b) (c $$)
// Only last expression gets $$

lower
→ (lower $$)
// Single expression gets $$

lower | trim
→ (trim (lower $$))
// $$ injected at pipeline start

let: x 10
→ (let: x 10 $$)
// Effects can receive $$ in shell mode

(foo bar)
→ (foo $$ bar)
// Explicit parens can receive $$ in shell mode

;; No injection when variables present
lower $$
→ (lower $$)
// Already has $$, no injection

split " " | (len $)
→ (len (split " "))
// Has $ reference, no injection
```

**Injection Position:**
When `$$` is injected, it's placed after the callee (first element):
```lisp
split " "     →  (split $$ " ")
a | b         →  (b a $$)
a | b | c     →  (c b a $$)
```

**Why Two Modes?**
- **Normal mode** gives precise control for library code and complex transformations
- **Shell mode** provides convenience for interactive use where the final expression typically operates on input

---

## Normalization (Token-Level Desugaring)

Pex syntax is normalized to pure S-expressions **before parsing**. The normalizer operates on the token stream and accepts a `shellMode` option that controls `$$` auto-injection.

```lisp
;; Source
let: x 10
x | double | add_ten

;; Normalized tokens (what the parser sees, in normal mode)
(let: x 10)
(add_ten (double x))

;; In shell mode, last expression gets $$ if no source vars present
;; Would need explicit x to avoid: x $$ | double | add_ten
```

**Pipeline normalization:**
```
a | b       →  (b a)
a | b | c   →  (c (b a))
```

**Auto-injection in shell mode (last expression only):**
```
;; shellMode: true
lower       →  (lower $$)           # Last expression gets $$
a; b; c     →  (a) (b) (c $$)       # Only last expression
lower | trim →  (trim (lower $$))   # Pipeline start gets $$

;; shellMode: false (default)
lower       →  (lower)              # No injection
a; b; c     →  (a) (b) (c)          # No injection
lower | trim →  (trim (lower))      # No injection
```

**No auto-injection when source variables present:**
```
;; True regardless of mode
if $$ "yes" "no"          →  (if $$ "yes" "no")
split " " | (len $)       →  (len (split " "))
join $0 " " $1            →  (join $0 " " $1)
```

**Parentheses simplification:**
```
((expr))      →  (expr)         # Remove redundant nesting
(foo (bar))   →  (foo bar)      # Remove parens around single identifier when nested
(bar)         →  (bar)          # Keep top-level parens
```

**In shell mode, explicit parentheses can receive injection:**
```
;; shellMode: true
(foo bar)     →  (foo $$ bar)   # Explicit parens can receive $$
foo bar       →  (foo $$ bar)   # Implicit parens also receive $$

;; shellMode: false
(foo bar)     →  (foo bar)      # No injection
foo bar       →  (foo bar)      # No injection
```

**Effects normalize to S-expressions:**
```
;; shellMode: false
let: x 10          →  (let: x 10)
fn: f (x) body     →  (fn: f (x) body)
print: "hello"     →  (print: "hello")

;; shellMode: true (effects CAN receive $$ if last expression)
let: x 10          →  (let: x 10 $$)
print: "hello"     →  (print: "hello" $$)
```

**Operator tokenization:**
All arithmetic (`+`, `-`, `*`, `/`, `%`), comparison (`==`, `!=`, `<`, `>`, `<=`, `>=`), and logical operators (`and`, `or`, `not`, `??`) are tokenized as regular identifiers, not special operator tokens. This allows them to be treated uniformly as callable functions.

---

## Type System

Pex is dynamically typed with the following value types:

- **null** - `null`
- **boolean** - `true`, `false`
- **number** - `42`, `3.14`, `-10`
- **string** - `"hello"`, `'world'`
- **array** - (runtime only, no literal syntax yet)
- **object** - (runtime only, no literal syntax yet)

**Regex literals:**
```lisp
/pattern/flags
/\d+/g
/[A-Z]/
```

---

## Built-in Functions

### String Operations
```lisp
split str delimiter [limit]    ;; Split string
join ...strs                    ;; Concatenate strings
trim str                        ;; Remove whitespace
upper str                       ;; Uppercase
lower str                       ;; Lowercase
replace str pattern replacement ;; Replace text
substring str start [end]       ;; Extract substring
len str                         ;; String length
```

### Type Conversion
```lisp
int value      ;; Parse to integer (0 on error)
float value    ;; Parse to float (0.0 on error)
string value   ;; Convert to string
bool value     ;; Truthy conversion
```

### Array Operations
```lisp
first arr                ;; First element
last arr                 ;; Last element
get arr index [default]  ;; Safe array access
len arr                  ;; Array length
```

### Logic & Comparison
```lisp
if condition true_val false_val
and a b
or a b
not a

== a b
!= a b
< a b
> a b
<= a b
>= a b
```

### Math
```lisp
+ ...args    ;; Addition (variadic)
- a b        ;; Subtraction
* ...args    ;; Multiplication (variadic)
/ a b        ;; Division
% a b        ;; Modulo
```

### Null Handling
```lisp
?? value default   ;; Null coalescing
```

---

## Debugging and Logging

Effects (`:` postfix) can be used for debugging. They're regular expressions that can appear anywhere:

```lisp
;; Print to console
print: "Processing started"
print: (join "Input length: " (len $$))

;; Debug output (more detailed)
debug: $$
debug: (join "Variables: x=" x " y=" y)

;; Runtime assertions
assert: (!= $$ null)
assert: (> (len $$) 0)
```

### Example with Debugging

```lisp
fn: process_email (email)
  print: "Normalizing email"
  let: normalized (lower email | trim)
  debug: normalized
  
  assert: (> (len normalized) 0)
  
  print: "Removing plus aliases"
  let: cleaned (replace normalized /\+.*@/ "@")
  debug: cleaned
  
  cleaned

;; The output is just the cleaned email
;; All print/debug/assert forms don't contribute to output
process_email $$
```

### Conditional Debugging

```lisp
fn: safe_process (data)
  let: is_dev (== ENV "development")
  
  ;; Only debug in development
  if is_dev
    (print: "Development mode")
    null
  
  let: result (transform data)
  
  if is_dev
    (debug: result)
    null
  
  result
```

---

## Function Definitions

```lisp
;; Basic function
fn: double (x) * x 2

;; Using in expression
double 5    ;; → 10

;; Multi-step function
fn: normalize_email (email)
  let: lowered (lower email)
  let: trimmed (trim lowered)
  trimmed

;; With pipes
fn: clean (email)
  email | lower | trim | replace /\+.*@/ "@"
```

---

## Variable Bindings

```lisp
;; Constants
let: TAX_RATE 0.08
let: PI 3.14159

;; Using constants
fn: add_tax (price)
  * price (+ 1 TAX_RATE)

;; Local bindings in functions
fn: process (x)
  let: doubled (* x 2)
  let: squared (* doubled doubled)
  + squared 10
```

---

## Modules

Modules are `.pex` files containing definitions:

```lisp
;; email.pex

let: EMAIL_REGEX /^[^\s@]+@[^\s@]+\.[^\s@]+$/

fn: normalize (email)
  lower email | trim

fn: extract_domain (email)
  split email "@" | get 1 ""

fn: is_valid (email)
  != (match email EMAIL_REGEX) null
```

**Using modules:**

```yaml
# In lens config
modules:
  - email: ./modules/email.pex
  - str: ./modules/string-utils.pex

lenses:
  - transform:
      source: raw_email
      target: clean_email
      expr: email.normalize $
```

**Namespace syntax:** `module.function`

---

## Grammar

```ebnf
program    := expression*

expression := pipeline

pipeline   := primary ('|' primary)*

primary    := atom
           |  call
           |  effect
           |  '(' expression ')'

call       := IDENTIFIER argument*

effect     := EFFECT_IDENT argument*

argument   := atom
           |  '(' expression ')'

atom       := NUMBER
           |  STRING
           |  REGEX
           |  BOOLEAN
           |  NULL
           |  IDENTIFIER

EFFECT_IDENT := IDENTIFIER ':'
```

**Note:** Effects (EFFECT_IDENT) are identifiers followed by `:`. In shell mode, they can receive `$$` injection when they are the last expression.

---

## Compilation Pipeline

```
Source Code (.pex)
    ↓
Tokenize (recognize |, :, etc.)
    ↓
Normalize (convert to canonical S-expressions BEFORE parsing)
  - Accept shellMode option to control $$ injection
  - In shell mode: inject $$ into last expression only
    ↓
Parse (build AST from normalized tokens)
    ↓
Compile (generate bytecode)
    ↓
Bytecode (.pexb)
```

**Key invariants:**
- Normalization happens BEFORE parsing, not after
- The normalizer converts pipes to nested parentheses
- In **shell mode**: Injects `$$` into the last expression when no source variables present
- In **normal mode**: No automatic `$$` injection occurs
- After normalization, only canonical S-expression tokens exist
- The parser only sees normalized token streams (no pipes, no semicolons)
- Effects (`:` postfix) are parsed as regular identifiers (EFFECT_IDENT tokens)
- The compiler, VM, and all tools only understand pure S-expressions

---

## Examples

### Simple Transformations

```lisp
;; Shell mode examples (auto-injected $$)
lower | trim                          ;; → (trim (lower $$))
replace /\D/g ""                      ;; → (replace $$ /\D/g "")

;; Normal mode examples (explicit source variables)
$$ | lower | trim                     ;; → (trim (lower $$))
replace $$ /\D/g ""                   ;; → (replace $$ /\D/g "")

;; Conditional using program input (works in both modes)
if (> $$ 10) "big" "small"

;; Conditional using piped value (works in both modes)
$$ | lower | if (> (len $) 5) $ "short"
```

### With Definitions

```lisp
let: FREEZING 32
let: RATIO 1.8

fn: c_to_f (c)
  + (* c RATIO) FREEZING

fn: f_to_c (f)
  / (- f FREEZING) RATIO

;; Use it (shell mode with explicit input)
$$ | c_to_f    ;; → 212 (when input is 100)

;; Or in shell mode
c_to_f         ;; → (c_to_f $$) if last expression
```

### Complex Module

```lisp
;; text-utils.pex

let: WORD_SEP /[\s-_]+/

fn: words (text)
  split text WORD_SEP

fn: word_count (text)
  len (words text)

fn: acronym (text)
  let: word_list (words text)
  let: initials (map word_list (fn (w) substring w 0 1))
  upper (join initials "")

fn: title_case (text)
  let: word_list (words text)
  let: capitalized (map word_list (fn (w) 
    join (upper (substring w 0 1)) (lower (substring w 1))))
  join capitalized " "
```

### Email Processing Pipeline

```lisp
;; email-utils.pex

let: EMAIL_REGEX /^[^\s@]+@[^\s@]+\.[^\s@]+$/
let: PLUS_PATTERN /\+.*@/

fn: normalize (email)
  lower email | trim

fn: remove_plus (email)
  replace email PLUS_PATTERN "@"

fn: mask (email)
  let: parts (split email "@")
  let: local (get parts 0)
  let: domain (get parts 1)
  join (substring local 0 2) "***@" domain

fn: safe_email (email)
  normalize email | remove_plus | mask

;; Usage in transform
;; Shell mode - auto-injected $$:
safe_email                              ;; → (safe_email $$)

;; Normal mode - explicit:
safe_email $$

;; Shell mode with pipeline and conditional:
normalize | if (> (len $$) 50) (substring $ 0 50) $
;; Here $$ is original input length, $ is normalized result

;; Normal mode requires explicit $$:
$$ | normalize | if (> (len $$) 50) (substring $ 0 50) $
```

---

## Lens Configuration

Pex expressions are used in lens transformation configs. Lenses typically use **shell mode** for convenience, allowing the last expression to auto-receive program input.

```yaml
lenses:
  # Simple transformation (shell mode - auto-injected $$)
  - transform:
      source: email
      target: email_clean
      expr: lower | trim
      # Normalized: (trim (lower $$))

  # Normal mode - explicit variables required
  - transform:
      source: email
      target: email_clean
      expr: $$ | lower | trim
      # Same result, explicit control

  # With effects (bindings and functions)
  - transform:
      source: temperature_c
      target: temperature_f
      expr: |
        let: FREEZING 32
        fn: c_to_f (c) + (* c 1.8) FREEZING
        c_to_f $$
      # Explicit $$ ensures correct input

  # Multi-source (using $0, $1 which reference $$)
  - transform:
      source: [first_name, last_name]
      target: full_name
      expr: join $0 " " $1 | trim
      # Source vars present, no auto-injection

  # Using modules
  - transform:
      source: raw_email
      target: domain
      expr: email.extract_domain $$
      # Explicit $$ is clearer

  # Pipeline with original input reference
  - transform:
      source: text
      target: summary
      expr: |
        $$ | split " " |
          if (> (len $$) 100)
            (get $ 0 10)
            $
      # Explicit $$ at start for clarity

  # With debugging (shell mode)
  - transform:
      source: data
      target: result
      expr: |
        print: "Processing data"
        debug: $$
        let: cleaned (trim $$)
        print: "Cleaned"
        upper cleaned
      # Last expr gets $$ in shell mode: (upper cleaned $$)
```

---

## File Extensions

- `.pex` - Source code
- `.pexb` - Compiled bytecode
- `.pexbc` - Alternative bytecode extension

---

## Bytecode Format

### Binary Structure

```
[Magic Number: 4 bytes]  "PEXB" (0x50455842)
[Version: 4 bytes]       Format version (currently 1)

[Constant Pool]
  [Count: 4 bytes]
  [Constants: variable]
    [Type: 1 byte]       0=null, 1=bool, 2=number, 3=string
    [Value: variable]    Encoded based on type

[Name Table]
  [Count: 4 bytes]
  [Names: variable]
    [Length: 4 bytes]
    [UTF-8 bytes]

[Code Section]
  [Instruction Count: 4 bytes]
  [Instructions: variable]
    [OpCode: 1 byte]
    [Operand: 4 bytes]   (0 if no operand)
```

### Instruction Set

| OpCode | Name | Operand | Description |
|--------|------|---------|-------------|
| 0x01 | LOAD_CONST | const_idx | Load constant from pool |
| 0x02 | LOAD_VAR | name_idx | Load variable |
| 0x03 | STORE_VAR | name_idx | Store variable |
| 0x04 | POP | - | Pop stack top |
| 0x10 | MAKE_FUNCTION | name_idx | Create function |
| 0x11 | CALL | arg_count | Call function |
| 0x12 | RETURN | - | Return from function |
| 0x20 | ADD | - | Binary addition |
| 0x21 | SUB | - | Binary subtraction |
| 0x22 | MUL | - | Binary multiplication |
| 0x23 | DIV | - | Binary division |
| 0x24 | MOD | - | Binary modulo |
| 0x30 | EQ | - | Equality test |
| 0x31 | NE | - | Inequality test |
| 0x32 | LT | - | Less than |
| 0x33 | GT | - | Greater than |
| 0x34 | LE | - | Less than or equal |
| 0x35 | GE | - | Greater than or equal |
| 0x40 | AND | - | Logical AND |
| 0x41 | OR | - | Logical OR |
| 0x42 | NOT | - | Logical NOT |
| 0x50 | JUMP | offset | Unconditional jump |
| 0x51 | JUMP_IF_FALSE | offset | Conditional jump |
| 0x60 | LOAD_BUILTIN | name_idx | Load builtin function |

---

## Design Principles

1. **Minimal syntax** - Only essential operators
2. **S-expressions at core** - Uniform internal representation
3. **Normalize before parsing** - Convert to canonical form before building the AST
4. **Pipes for readability** - But they're just syntactic sugar
5. **Explicit by default** - Normal mode requires explicit source variables; shell mode provides convenience
6. **First-class functions** - Functions are values
7. **Compiled to bytecode** - Fast execution, compact storage
8. **Effects are expressions** - `:` postfix marks side effects, can appear anywhere
9. **Operators as identifiers** - Uniform treatment of all callable functions
10. **Two modes** - Normal mode for precision, shell mode for convenience

---

## Future Considerations

Potential additions (not yet implemented):

- Array literals: `[1, 2, 3]`
- Object literals: `{x: 10, y: 20}`
- Pattern matching: `match value { ... }`
- List comprehensions: `[x * 2 | x <- list]`
- Anonymous functions: `(fn (x) * x 2)`
- Import statements: `import email;`
- Type annotations (optional): `fn add (x: int) (y: int) : int`
- Destructuring: `let [a, b] (split text " ");`
- Spread operator: `[...arr1, ...arr2]`
- String interpolation: `` `Hello ${name}` ``

---

## Comparison to Other Languages

### vs Lisp/Scheme
- **Similarity:** S-expressions, first-class functions
- **Difference:** Pipes for readability, designed for data transformation

### vs Haskell/ML
- **Similarity:** Function composition, transformation pipelines
- **Difference:** Dynamic typing, simpler syntax, bytecode compilation

### vs Unix Shell
- **Similarity:** Pipe operator for composition
- **Difference:** Proper data structures, functions as values, bidirectional

### vs JavaScript
- **Similarity:** Dynamic typing, functional features
- **Difference:** Minimal syntax, compiled bytecode, no mutation

---

## Implementation Notes

### Implementation Architecture

**Tokenization:**
- Recognize pipes (`|`), semicolons (`;`), and effect identifiers (`:` postfix)
- Treat all arithmetic and logical operators as `IDENTIFIER` tokens
- Distinguish regex literals from division using context-aware lexing

**Normalization (BEFORE parsing):**
- Accept `shellMode` option to control `$$` injection behavior
- Convert pipes to nested parentheses: `a | b | c` → `(c (b a))`
- Split at semicolons into independent expression groups
- Track which group is the last expression
- In **shell mode**: Inject `$$` into the last expression only (when no source refs present)
- In **normal mode**: No automatic `$$` injection
- Simplify redundant parentheses around single identifiers when nested

**Shell Mode Injection Details:**
- Only the last expression group receives `$$` injection
- Injection position: after the callee (first element)
- No injection if any source variable (`$`, `$$`, `$N`) is already present
- Effects can receive injection (`:` postfix doesn't prevent injection in shell mode)
- Explicit parentheses can receive injection (parentheses don't prevent injection in shell mode)

**Parsing:**
- Build AST from normalized token stream (no pipes or semicolons)
- Parser only sees canonical S-expression structure
- Effects (EFFECT_IDENT) are parsed as regular identifiers (atoms)
- Operators are parsed as callable identifiers
- Parser accepts `ParseOptions` with `shellMode` flag (for metadata/debugging)

**Post-parsing:**
- All subsequent phases work with pure S-expressions via the AST

### Compiler Optimization Opportunities
- Constant folding: `(+ 1 2)` → `3`
- Dead code elimination
- Tail call optimization
- Inline simple functions
- Common subexpression elimination

### Runtime Considerations
- Stack-based VM for simplicity
- Register-based VM for performance (future)
- JIT compilation (future)
- Garbage collection for function closures

---

## Error Messages

Pex should provide clear, helpful error messages:

```
Parse Error: Unexpected token 'foo' at line 3, column 12
  let x = 10;
           ^
Expected: expression, got '='

Type Error: Function 'split' expects 2 arguments, got 1
  split email
  ^^^^^
Note: split requires (string, delimiter)

Runtime Error: Undefined variable 'unknown'
  unknown | lower
  ^^^^^^^
Did you mean: 'normalize'?
```

---

## Standard Library Organization

Recommended module structure:

```
modules/
  string/
    case.pex        # upper, lower, capitalize, etc.
    split.pex       # split operations and parsing
    format.pex      # interpolation, padding, etc.
  
  validation/
    email.pex       # email validation
    phone.pex       # phone number validation
    url.pex         # URL validation
  
  transform/
    date.pex        # date transformations
    number.pex      # number formatting
    currency.pex    # currency operations
  
  collection/
    array.pex       # array operations
    object.pex      # object operations
```

---

## Community & Contribution

### Style Guide
- Use lowercase for function names: `normalize_email` not `normalizeEmail`
- Use UPPERCASE for constants: `TAX_RATE` not `taxRate`
- Prefer pipes for readability in simple cases
- Use explicit S-expressions for complex logic
- Keep functions small and focused
- Document modules with comments

### Module Publishing
- Modules should be self-contained `.pex` files
- Include examples in comments
- Export clear, well-named functions
- Avoid side effects in modules

---

*Pex: Pipe data through transformations*

---

## Appendix A: Complete Example

```lisp
;; user-transform.pex
;; Transforms user data between API formats

let: API_V1_DOMAIN "api.example.com"
let: API_V2_DOMAIN "api-v2.example.com"

fn: normalize_email (email)
  lower email | trim | replace /\+.*@/ "@"

fn: format_phone (phone)
  let: digits (replace phone /\D/g "")
  if (== (len digits) 10)
    (join "(" (substring digits 0 3) ") " 
          (substring digits 3 6) "-" 
          (substring digits 6 10))
    phone

fn: full_name (first last middle)
  if (> (len middle) 0)
    (join first " " middle " " last | trim)
    (join first " " last | trim)

;; Main transformation
;; Takes user_data object and transforms it
fn: transform_user (user_data)
  let: email (normalize_email (get user_data "email" ""))
  let: phone (format_phone (get user_data "phone" ""))
  let: name (full_name 
    (get user_data "first_name" "")
    (get user_data "last_name" "")
    (get user_data "middle_name" ""))
  
  ;; Return transformed object
  {
    emailAddress: email,
    phoneNumber: phone,
    displayName: name
  }
```

Usage in lens configuration:

```yaml
modules:
  - user: ./modules/user-transform.pex

lenses:
  - transform:
      source: api_v1_user
      target: api_v2_user
      expr: user.transform_user $$
```

---

## Appendix B: Grammar in Full EBNF

```ebnf
(* Lexical Grammar *)
DIGIT      = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" ;
LETTER     = "a" | ... | "z" | "A" | ... | "Z" ;
WHITESPACE = " " | "\t" | "\n" | "\r" ;

(* Tokens *)
NUMBER     = ["-"] DIGIT+ ["." DIGIT+] ;
STRING     = '"' (ANY_CHAR - '"')* '"' 
           | "'" (ANY_CHAR - "'")* "'" ;
REGEX      = "/" (ANY_CHAR - "/")* "/" [FLAGS] ;
FLAGS      = ("g" | "i" | "m" | "s" | "u" | "v" | "y")* ;
BOOLEAN    = "true" | "false" ;
NULL       = "null" ;
IDENTIFIER = (LETTER | "_" | "$") (LETTER | DIGIT | "_" | "$")* ;
EFFECT_IDENT = IDENTIFIER ":" ;

(* Syntactic Grammar *)
program    = expression* ;

expression = pipeline ;

pipeline   = primary ("|" primary)* ;

primary    = atom
           | call
           | effect
           | "(" expression ")" ;

call       = IDENTIFIER argument* ;

effect     = EFFECT_IDENT argument* ;

argument   = atom
           | "(" expression ")" ;

atom       = NUMBER
           | STRING
           | REGEX
           | BOOLEAN
           | NULL
           | IDENTIFIER ;
```

---

End of Specification
