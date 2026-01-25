/**
 * PEX language support for CodeMirror
 *
 * Provides syntax highlighting using StreamLanguage for PEX code.
 */

import { StreamLanguage } from "@codemirror/language";
import { LanguageSupport } from "@codemirror/language";

// Simple stream parser for PEX syntax highlighting
const pexLanguage = StreamLanguage.define({
  name: "pex",

  token(stream, state) {
    // Skip whitespace
    if (stream.eatSpace()) {
      return null;
    }

    // Comments
    if (stream.match("//")) {
      stream.skipToEnd();
      return "comment";
    }

    // Source references
    if (stream.match(/\$\$|\$\d+|\$/)) {
      return "variableName.special";
    }

    // Numbers
    if (stream.match(/^-?\d+(\.\d+)?/)) {
      return "number";
    }

    // Strings
    if (stream.match(/^"(?:[^"\\]|\\.)*"/)) {
      return "string";
    }

    // Regex literals
    if (stream.match(/^\/(?:[^\/\\]|\\.)*\//)) {
      return "string.special";
    }

    // Booleans and null
    if (stream.match(/^(true|false|null)\b/)) {
      return "atom";
    }

    // Effect keywords (let:, fn:, if:, match:, print:, debug:)
    if (stream.match(/^(let|fn|if|match|print|debug|log|effect):/)) {
      return "keyword";
    }

    // Built-in functions
    if (stream.match(/^(split|join|trim|upper|lower|replace|match|test|map|filter|reduce|length|slice|concat|flatten|unique|sort|reverse|head|tail|take|drop|zip|unzip|range|sum|product|min|max|mean|floor|ceil|round|abs|sqrt|pow|log|exp|sin|cos|tan|get|set|keys|values|entries|has|delete)\b/)) {
      return "function.builtin";
    }

    // Operators
    if (stream.match(/^(\+|-|\*|\/|%|==|!=|<=|>=|<|>|&&|\|\||!|\?)/)) {
      return "operator";
    }

    // Punctuation
    if (stream.match(/^[()[\]{}]/)) {
      return "bracket";
    }

    if (stream.match(/^[|;]/)) {
      return "punctuation";
    }

    // Identifiers
    if (stream.match(/^[a-zA-Z_][a-zA-Z0-9_]*/)) {
      return "variableName";
    }

    // Fallback: consume one character
    stream.next();
    return null;
  },

  startState() {
    return {};
  },
});

/**
 * Create CodeMirror extension for PEX (synchronous version)
 */
export function pexLanguageSupport(): LanguageSupport {
  return new LanguageSupport(pexLanguage);
}
