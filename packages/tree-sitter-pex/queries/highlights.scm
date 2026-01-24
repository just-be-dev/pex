;; Syntax highlighting queries for PEX

;; Comments
(comment) @comment

;; Keywords and Effects
(effect_ident) @keyword

;; Special effect keywords
((effect_ident) @keyword.control
  (#match? @keyword.control "^(let|fn|if|match|print|debug):$"))

;; Built-in functions
((identifier) @function.builtin
  (#match? @function.builtin "^(split|join|trim|upper|lower|replace|match|test|map|filter|reduce|length|slice|concat|flatten|unique|sort|reverse|head|tail|take|drop|zip|unzip|range|sum|product|min|max|mean|floor|ceil|round|abs|sqrt|pow|log|exp|sin|cos|tan)$"))

;; Operators
((identifier) @operator
  (#match? @operator "^(\\+|-|\\*|/|%|==|!=|<|>|<=|>=|&&|\\|\\||!|\\?|:)$"))

;; Function calls (first element in a list)
(list
  .
  (atom
    (identifier) @function))

;; Source variables
(source_ref) @variable.builtin

;; Regular identifiers
(identifier) @variable

;; Literals
(number) @number
(string) @string
(boolean) @boolean
(null) @constant.builtin

;; Regex
(regex) @string.regexp

;; Escape sequences in strings
(escape_sequence) @string.escape

;; Punctuation
"(" @punctuation.bracket
")" @punctuation.bracket
"|" @punctuation.delimiter
";" @punctuation.delimiter

;; ERROR nodes for incomplete code
(ERROR) @error
