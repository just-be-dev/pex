/**
 * Tree-sitter Grammar for PEX Language
 */

module.exports = grammar({
  name: 'pex',

  extras: $ => [
    /\s/,
    $.comment,
  ],

  rules: {
    program: $ => repeat(seq(
      $.expression,
      optional(';'),
    )),

    expression: $ => choice(
      $.pipeline,
      $._primary_expr,
    ),

    pipeline: $ => prec.left(2, seq(
      $._primary_expr,
      repeat1(seq('|', $._primary_expr)),
    )),

    _primary_expr: $ => choice(
      $.implicit_call,
      $._single_expr,
    ),

    implicit_call: $ => prec.left(1, seq(
      $._single_expr,
      repeat1($._single_expr),
    )),

    _single_expr: $ => choice(
      $.list,
      $.atom,
    ),

    list: $ => seq(
      '(',
      optional($._list_contents),
      ')',
    ),

    _list_contents: $ => choice(
      // Pipeline inside parens
      $.pipeline,
      // Multiple elements (implicit call or atoms/lists)
      $._list_elements,
    ),

    _list_elements: $ => prec.left(seq(
      $._single_expr,
      repeat($._single_expr),
    )),

    atom: $ => choice(
      $.number,
      $.string,
      $.regex,
      $.boolean,
      $.null,
      $.source_ref,
      $.effect_ident,
      $.identifier,
    ),

    number: _ => /-?\d+(\.\d+)?/,

    string: $ => choice(
      seq(
        '"',
        repeat(choice(
          token.immediate(prec(1, /[^"\\]+/)),
          $.escape_sequence,
        )),
        '"',
      ),
      seq(
        "'",
        repeat(choice(
          token.immediate(prec(1, /[^'\\]+/)),
          $.escape_sequence,
        )),
        "'",
      ),
    ),

    escape_sequence: _ => token.immediate(seq(
      '\\',
      /./,
    )),

    regex: _ => token(seq(
      '/',
      repeat(choice(
        /[^/\\\n]+/,
        seq('\\', /./)
      )),
      '/',
      optional(/[gimsuvy]+/)
    )),

    boolean: _ => choice('true', 'false'),

    null: _ => 'null',

    source_ref: _ => choice(
      token('$$'),
      token(/\$\d+/),
      token('$'),
    ),

    effect_ident: _ => token(seq(
      /[a-zA-Z_][a-zA-Z0-9_]*/,
      ':',
    )),

    identifier: _ => /[a-zA-Z_<>=!?+\-*/%][a-zA-Z0-9_<>=!?+\-*/%]*/,

    comment: _ => token(seq(';;', /.*/)),
  },
});
