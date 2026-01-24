# Tree-sitter PEX

A [Tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar for the PEX language - a pipeline-oriented expression language with S-expression support.

## Language Overview

PEX is a pipeline-oriented expression language that supports:

- **Pipelines**: Chain operations with `|` operator
- **S-expressions**: Lisp-style function calls with parentheses
- **Effects**: Side-effect operations with `:` postfix (e.g., `let:`, `fn:`)
- **Source variables**: Special variables `$`, `$$`, `$0`, `$1`, etc.
- **Multiple data types**: Numbers, strings, booleans, null, regex

### Syntax Examples

```pex
;; Simple pipeline
$$ | lower | trim

;; Function calls
(+ 1 2)
lower "HELLO"

;; Variable binding
(let: x 42)

;; Function definition
(fn: double (x) (* x 2))

;; Pipeline with regex
"foo  bar" | split /\s+/ | join "-"
```

## Installation

### NPM/Bun

```bash
bun add @pex/tree-sitter-pex
# or
npm install @pex/tree-sitter-pex
```

### From Source

```bash
cd packages/tree-sitter-pex
bun install
bun run generate
bun run build
```

## Usage

### TypeScript/JavaScript

```typescript
import { parse, PEXParser } from '@pex/tree-sitter-pex';

// Simple parsing
const result = parse('$$ | lower | trim');
console.log(result.success); // true
console.log(result.rootNode.toString());

// Using the parser class
const parser = new PEXParser();
const parseResult = parser.parse('(+ 1 2)');

// Get specific node types
const pipelines = parser.findNodesOfType(
  parseResult.rootNode,
  'pipeline'
);
```

### Tree-sitter CLI

```bash
# Parse a file
tree-sitter parse examples/basic.pex

# Test the grammar
tree-sitter test

# Generate highlighting
tree-sitter highlight examples/basic.pex
```

## Editor Integration

### Neovim

Add to your Neovim configuration:

```lua
-- ~/.config/nvim/queries/pex/highlights.scm
-- Copy from queries/highlights.scm

local parser_config = require("nvim-treesitter.parsers").get_parser_configs()
parser_config.pex = {
  install_info = {
    url = "/path/to/tree-sitter-pex",
    files = {"src/parser.c"},
  },
  filetype = "pex",
}
```

### VSCode

Create a VSCode extension using this grammar:

1. Follow the [vscode-tree-sitter guide](https://github.com/georgewfraser/vscode-tree-sitter)
2. Reference this package in your extension
3. Use the `queries/highlights.scm` for syntax highlighting

## Grammar Structure

### Core Rules

- **program**: Top-level container with expressions
- **expression**: Pipeline or primary expression
- **pipeline**: Chain of stages separated by `|`
- **list**: S-expression with parentheses `(...)`
- **implicit_call**: Space-separated atoms (e.g., `lower text`)
- **atom**: Primitive values (numbers, strings, identifiers, etc.)

### Atoms

- **number**: `42`, `3.14`, `-10`
- **string**: `"hello"`, `'world'` (with escape sequences)
- **regex**: `/pattern/flags`
- **boolean**: `true`, `false`
- **null**: `null`
- **source_ref**: `$`, `$$`, `$0`, `$1`, etc.
- **effect_ident**: `let:`, `fn:`, `print:`, etc.
- **identifier**: Regular identifiers and operators

### Precedence

1. **Pipeline** (highest): `a | b c` → `a | (b c)`
2. **Implicit call**: Space-separated grouping
3. **Atoms** (lowest): Individual values

## Development

### Build Commands

From the root directory (using mise monorepo syntax):

```bash
# Generate parser from grammar
mise run //packages/tree-sitter-pex:generate

# Build TypeScript files
mise run //packages/tree-sitter-pex:build

# Run all tests
mise run //packages/tree-sitter-pex:test

# Run only corpus tests
mise run //packages/tree-sitter-pex:test:corpus

# Parse example files
mise run //packages/tree-sitter-pex:parse examples/basic.pex

# Run all test tasks across all packages (wildcard)
mise run '//...:test'
```

From the package directory (`packages/tree-sitter-pex/`):

```bash
# Generate parser from grammar
mise run generate
# or: bun run generate

# Build TypeScript files
mise run build
# or: bun run build

# Run all tests
mise run test
# or: bun run test

# Run only corpus tests
mise run test:corpus
# or: bun run test:corpus

# Run only TypeScript tests
mise run test:unit
# or: bun run test:unit

# Parse example files
mise run parse examples/basic.pex
# or: bun run parse examples/basic.pex
```

### Testing

The grammar includes comprehensive tests:

- **Corpus tests** (`test/corpus/`): Tree-sitter format tests
  - Literals (numbers, strings, booleans, etc.)
  - Pipelines (simple, multi-stage, nested)
  - Effects (let, fn, print)
  - Functions (explicit, implicit, nested)
  - Error recovery (unclosed parens, incomplete expressions)

- **TypeScript tests** (`test/**/*.test.ts`): Unit tests for the wrapper

### Project Structure

```
packages/tree-sitter-pex/
├── grammar.js              # Grammar definition
├── package.json            # Package configuration
├── tsconfig.json           # TypeScript config
├── src/
│   ├── index.ts            # Main entry point
│   ├── parser.ts           # Parser wrapper
│   └── types.ts            # Type definitions
├── queries/
│   └── highlights.scm      # Syntax highlighting
├── test/
│   └── corpus/             # Corpus tests
│       ├── literals.txt
│       ├── pipelines.txt
│       ├── effects.txt
│       ├── functions.txt
│       └── error_recovery.txt
└── examples/               # Example PEX files
    ├── basic.pex
    ├── functions.pex
    └── pipeline.pex
```

## Contributing

1. Make changes to `grammar.js`
2. Run `bun run generate` to regenerate the parser
3. Add tests to `test/corpus/`
4. Run `bun run test` to verify
5. Update documentation as needed

## License

MIT License - see the root LICENSE file for details.

## References

- [PEX Specification](../../PEX_SPEC.md)
- [Tree-sitter Documentation](https://tree-sitter.github.io/tree-sitter/)
- [Writing a Tree-sitter Grammar](https://tree-sitter.github.io/tree-sitter/creating-parsers)
