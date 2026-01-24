#include "tree_sitter/parser.h"

#if defined(__GNUC__) || defined(__clang__)
#pragma GCC diagnostic ignored "-Wmissing-field-initializers"
#endif

#define LANGUAGE_VERSION 14
#define STATE_COUNT 39
#define LARGE_STATE_COUNT 14
#define SYMBOL_COUNT 39
#define ALIAS_COUNT 0
#define TOKEN_COUNT 21
#define EXTERNAL_TOKEN_COUNT 0
#define FIELD_COUNT 0
#define MAX_ALIAS_SEQUENCE_LENGTH 3
#define PRODUCTION_ID_COUNT 1

enum ts_symbol_identifiers {
  anon_sym_SEMI = 1,
  anon_sym_PIPE = 2,
  anon_sym_LPAREN = 3,
  anon_sym_RPAREN = 4,
  sym_number = 5,
  anon_sym_DQUOTE = 6,
  aux_sym_string_token1 = 7,
  anon_sym_SQUOTE = 8,
  aux_sym_string_token2 = 9,
  sym_escape_sequence = 10,
  sym_regex = 11,
  anon_sym_true = 12,
  anon_sym_false = 13,
  sym_null = 14,
  anon_sym_DOLLAR_DOLLAR = 15,
  aux_sym_source_ref_token1 = 16,
  anon_sym_DOLLAR = 17,
  sym_effect_ident = 18,
  sym_identifier = 19,
  sym_comment = 20,
  sym_program = 21,
  sym_expression = 22,
  sym_pipeline = 23,
  sym__primary_expr = 24,
  sym_implicit_call = 25,
  sym__single_expr = 26,
  sym_list = 27,
  sym__list_contents = 28,
  sym__list_elements = 29,
  sym_atom = 30,
  sym_string = 31,
  sym_boolean = 32,
  sym_source_ref = 33,
  aux_sym_program_repeat1 = 34,
  aux_sym_pipeline_repeat1 = 35,
  aux_sym_implicit_call_repeat1 = 36,
  aux_sym_string_repeat1 = 37,
  aux_sym_string_repeat2 = 38,
};

static const char * const ts_symbol_names[] = {
  [ts_builtin_sym_end] = "end",
  [anon_sym_SEMI] = ";",
  [anon_sym_PIPE] = "|",
  [anon_sym_LPAREN] = "(",
  [anon_sym_RPAREN] = ")",
  [sym_number] = "number",
  [anon_sym_DQUOTE] = "\"",
  [aux_sym_string_token1] = "string_token1",
  [anon_sym_SQUOTE] = "'",
  [aux_sym_string_token2] = "string_token2",
  [sym_escape_sequence] = "escape_sequence",
  [sym_regex] = "regex",
  [anon_sym_true] = "true",
  [anon_sym_false] = "false",
  [sym_null] = "null",
  [anon_sym_DOLLAR_DOLLAR] = "$$",
  [aux_sym_source_ref_token1] = "source_ref_token1",
  [anon_sym_DOLLAR] = "$",
  [sym_effect_ident] = "effect_ident",
  [sym_identifier] = "identifier",
  [sym_comment] = "comment",
  [sym_program] = "program",
  [sym_expression] = "expression",
  [sym_pipeline] = "pipeline",
  [sym__primary_expr] = "_primary_expr",
  [sym_implicit_call] = "implicit_call",
  [sym__single_expr] = "_single_expr",
  [sym_list] = "list",
  [sym__list_contents] = "_list_contents",
  [sym__list_elements] = "_list_elements",
  [sym_atom] = "atom",
  [sym_string] = "string",
  [sym_boolean] = "boolean",
  [sym_source_ref] = "source_ref",
  [aux_sym_program_repeat1] = "program_repeat1",
  [aux_sym_pipeline_repeat1] = "pipeline_repeat1",
  [aux_sym_implicit_call_repeat1] = "implicit_call_repeat1",
  [aux_sym_string_repeat1] = "string_repeat1",
  [aux_sym_string_repeat2] = "string_repeat2",
};

static const TSSymbol ts_symbol_map[] = {
  [ts_builtin_sym_end] = ts_builtin_sym_end,
  [anon_sym_SEMI] = anon_sym_SEMI,
  [anon_sym_PIPE] = anon_sym_PIPE,
  [anon_sym_LPAREN] = anon_sym_LPAREN,
  [anon_sym_RPAREN] = anon_sym_RPAREN,
  [sym_number] = sym_number,
  [anon_sym_DQUOTE] = anon_sym_DQUOTE,
  [aux_sym_string_token1] = aux_sym_string_token1,
  [anon_sym_SQUOTE] = anon_sym_SQUOTE,
  [aux_sym_string_token2] = aux_sym_string_token2,
  [sym_escape_sequence] = sym_escape_sequence,
  [sym_regex] = sym_regex,
  [anon_sym_true] = anon_sym_true,
  [anon_sym_false] = anon_sym_false,
  [sym_null] = sym_null,
  [anon_sym_DOLLAR_DOLLAR] = anon_sym_DOLLAR_DOLLAR,
  [aux_sym_source_ref_token1] = aux_sym_source_ref_token1,
  [anon_sym_DOLLAR] = anon_sym_DOLLAR,
  [sym_effect_ident] = sym_effect_ident,
  [sym_identifier] = sym_identifier,
  [sym_comment] = sym_comment,
  [sym_program] = sym_program,
  [sym_expression] = sym_expression,
  [sym_pipeline] = sym_pipeline,
  [sym__primary_expr] = sym__primary_expr,
  [sym_implicit_call] = sym_implicit_call,
  [sym__single_expr] = sym__single_expr,
  [sym_list] = sym_list,
  [sym__list_contents] = sym__list_contents,
  [sym__list_elements] = sym__list_elements,
  [sym_atom] = sym_atom,
  [sym_string] = sym_string,
  [sym_boolean] = sym_boolean,
  [sym_source_ref] = sym_source_ref,
  [aux_sym_program_repeat1] = aux_sym_program_repeat1,
  [aux_sym_pipeline_repeat1] = aux_sym_pipeline_repeat1,
  [aux_sym_implicit_call_repeat1] = aux_sym_implicit_call_repeat1,
  [aux_sym_string_repeat1] = aux_sym_string_repeat1,
  [aux_sym_string_repeat2] = aux_sym_string_repeat2,
};

static const TSSymbolMetadata ts_symbol_metadata[] = {
  [ts_builtin_sym_end] = {
    .visible = false,
    .named = true,
  },
  [anon_sym_SEMI] = {
    .visible = true,
    .named = false,
  },
  [anon_sym_PIPE] = {
    .visible = true,
    .named = false,
  },
  [anon_sym_LPAREN] = {
    .visible = true,
    .named = false,
  },
  [anon_sym_RPAREN] = {
    .visible = true,
    .named = false,
  },
  [sym_number] = {
    .visible = true,
    .named = true,
  },
  [anon_sym_DQUOTE] = {
    .visible = true,
    .named = false,
  },
  [aux_sym_string_token1] = {
    .visible = false,
    .named = false,
  },
  [anon_sym_SQUOTE] = {
    .visible = true,
    .named = false,
  },
  [aux_sym_string_token2] = {
    .visible = false,
    .named = false,
  },
  [sym_escape_sequence] = {
    .visible = true,
    .named = true,
  },
  [sym_regex] = {
    .visible = true,
    .named = true,
  },
  [anon_sym_true] = {
    .visible = true,
    .named = false,
  },
  [anon_sym_false] = {
    .visible = true,
    .named = false,
  },
  [sym_null] = {
    .visible = true,
    .named = true,
  },
  [anon_sym_DOLLAR_DOLLAR] = {
    .visible = true,
    .named = false,
  },
  [aux_sym_source_ref_token1] = {
    .visible = false,
    .named = false,
  },
  [anon_sym_DOLLAR] = {
    .visible = true,
    .named = false,
  },
  [sym_effect_ident] = {
    .visible = true,
    .named = true,
  },
  [sym_identifier] = {
    .visible = true,
    .named = true,
  },
  [sym_comment] = {
    .visible = true,
    .named = true,
  },
  [sym_program] = {
    .visible = true,
    .named = true,
  },
  [sym_expression] = {
    .visible = true,
    .named = true,
  },
  [sym_pipeline] = {
    .visible = true,
    .named = true,
  },
  [sym__primary_expr] = {
    .visible = false,
    .named = true,
  },
  [sym_implicit_call] = {
    .visible = true,
    .named = true,
  },
  [sym__single_expr] = {
    .visible = false,
    .named = true,
  },
  [sym_list] = {
    .visible = true,
    .named = true,
  },
  [sym__list_contents] = {
    .visible = false,
    .named = true,
  },
  [sym__list_elements] = {
    .visible = false,
    .named = true,
  },
  [sym_atom] = {
    .visible = true,
    .named = true,
  },
  [sym_string] = {
    .visible = true,
    .named = true,
  },
  [sym_boolean] = {
    .visible = true,
    .named = true,
  },
  [sym_source_ref] = {
    .visible = true,
    .named = true,
  },
  [aux_sym_program_repeat1] = {
    .visible = false,
    .named = false,
  },
  [aux_sym_pipeline_repeat1] = {
    .visible = false,
    .named = false,
  },
  [aux_sym_implicit_call_repeat1] = {
    .visible = false,
    .named = false,
  },
  [aux_sym_string_repeat1] = {
    .visible = false,
    .named = false,
  },
  [aux_sym_string_repeat2] = {
    .visible = false,
    .named = false,
  },
};

static const TSSymbol ts_alias_sequences[PRODUCTION_ID_COUNT][MAX_ALIAS_SEQUENCE_LENGTH] = {
  [0] = {0},
};

static const uint16_t ts_non_terminal_alias_map[] = {
  0,
};

static const TSStateId ts_primary_state_ids[STATE_COUNT] = {
  [0] = 0,
  [1] = 1,
  [2] = 2,
  [3] = 3,
  [4] = 4,
  [5] = 5,
  [6] = 6,
  [7] = 7,
  [8] = 8,
  [9] = 7,
  [10] = 6,
  [11] = 11,
  [12] = 12,
  [13] = 12,
  [14] = 14,
  [15] = 15,
  [16] = 16,
  [17] = 17,
  [18] = 18,
  [19] = 19,
  [20] = 20,
  [21] = 21,
  [22] = 22,
  [23] = 23,
  [24] = 24,
  [25] = 25,
  [26] = 26,
  [27] = 27,
  [28] = 28,
  [29] = 29,
  [30] = 30,
  [31] = 31,
  [32] = 32,
  [33] = 33,
  [34] = 23,
  [35] = 19,
  [36] = 36,
  [37] = 37,
  [38] = 38,
};

static TSCharacterRange sym_identifier_character_set_2[] = {
  {'!', '!'}, {'%', '%'}, {'*', '+'}, {'-', '-'}, {'/', '9'}, {'<', '?'}, {'A', 'Z'}, {'_', '_'},
  {'a', 'z'},
};

static bool ts_lex(TSLexer *lexer, TSStateId state) {
  START_LEXER();
  eof = lexer->eof(lexer);
  switch (state) {
    case 0:
      if (eof) ADVANCE(8);
      ADVANCE_MAP(
        '"', 16,
        '$', 34,
        '\'', 21,
        '(', 11,
        ')', 12,
        '-', 48,
        '/', 36,
        ';', 9,
        '\\', 6,
        'f', 37,
        'n', 46,
        't', 43,
        '|', 10,
      );
      if (('\t' <= lookahead && lookahead <= '\r') ||
          lookahead == ' ') SKIP(7);
      if (lookahead == '!' ||
          lookahead == '%' ||
          lookahead == '*' ||
          lookahead == '+' ||
          ('<' <= lookahead && lookahead <= '?')) ADVANCE(49);
      if (('0' <= lookahead && lookahead <= '9')) ADVANCE(13);
      if (('A' <= lookahead && lookahead <= 'Z') ||
          lookahead == '_' ||
          ('a' <= lookahead && lookahead <= 'z')) ADVANCE(47);
      END_STATE();
    case 1:
      if (lookahead == '"') ADVANCE(16);
      if (lookahead == ';') ADVANCE(19);
      if (lookahead == '\\') ADVANCE(6);
      if (('\t' <= lookahead && lookahead <= '\r') ||
          lookahead == ' ') ADVANCE(18);
      if (lookahead != 0) ADVANCE(20);
      END_STATE();
    case 2:
      if (lookahead == '\'') ADVANCE(21);
      if (lookahead == ';') ADVANCE(24);
      if (lookahead == '\\') ADVANCE(6);
      if (('\t' <= lookahead && lookahead <= '\r') ||
          lookahead == ' ') ADVANCE(23);
      if (lookahead != 0) ADVANCE(25);
      END_STATE();
    case 3:
      if (lookahead == '/') ADVANCE(28);
      if (lookahead == '\\') ADVANCE(5);
      if (lookahead != 0 &&
          lookahead != '\n') ADVANCE(3);
      END_STATE();
    case 4:
      if (('0' <= lookahead && lookahead <= '9')) ADVANCE(15);
      END_STATE();
    case 5:
      if (lookahead != 0 &&
          lookahead != '\n') ADVANCE(3);
      END_STATE();
    case 6:
      if (lookahead != 0 &&
          lookahead != '\n') ADVANCE(26);
      END_STATE();
    case 7:
      if (eof) ADVANCE(8);
      ADVANCE_MAP(
        '"', 16,
        '$', 34,
        '\'', 21,
        '(', 11,
        ')', 12,
        '-', 48,
        '/', 36,
        ';', 9,
        'f', 37,
        'n', 46,
        't', 43,
        '|', 10,
      );
      if (('\t' <= lookahead && lookahead <= '\r') ||
          lookahead == ' ') SKIP(7);
      if (lookahead == '!' ||
          lookahead == '%' ||
          lookahead == '*' ||
          lookahead == '+' ||
          ('<' <= lookahead && lookahead <= '?')) ADVANCE(49);
      if (('0' <= lookahead && lookahead <= '9')) ADVANCE(13);
      if (('A' <= lookahead && lookahead <= 'Z') ||
          lookahead == '_' ||
          ('a' <= lookahead && lookahead <= 'z')) ADVANCE(47);
      END_STATE();
    case 8:
      ACCEPT_TOKEN(ts_builtin_sym_end);
      END_STATE();
    case 9:
      ACCEPT_TOKEN(anon_sym_SEMI);
      if (lookahead == ';') ADVANCE(50);
      END_STATE();
    case 10:
      ACCEPT_TOKEN(anon_sym_PIPE);
      END_STATE();
    case 11:
      ACCEPT_TOKEN(anon_sym_LPAREN);
      END_STATE();
    case 12:
      ACCEPT_TOKEN(anon_sym_RPAREN);
      END_STATE();
    case 13:
      ACCEPT_TOKEN(sym_number);
      if (lookahead == '.') ADVANCE(4);
      if (('0' <= lookahead && lookahead <= '9')) ADVANCE(13);
      END_STATE();
    case 14:
      ACCEPT_TOKEN(sym_number);
      if (lookahead == '.') ADVANCE(4);
      if (('0' <= lookahead && lookahead <= '9')) ADVANCE(14);
      if (set_contains(sym_identifier_character_set_2, 9, lookahead)) ADVANCE(49);
      END_STATE();
    case 15:
      ACCEPT_TOKEN(sym_number);
      if (('0' <= lookahead && lookahead <= '9')) ADVANCE(15);
      END_STATE();
    case 16:
      ACCEPT_TOKEN(anon_sym_DQUOTE);
      END_STATE();
    case 17:
      ACCEPT_TOKEN(aux_sym_string_token1);
      if (lookahead == '\n') ADVANCE(20);
      if (lookahead != 0 &&
          lookahead != '"' &&
          lookahead != '\\') ADVANCE(17);
      END_STATE();
    case 18:
      ACCEPT_TOKEN(aux_sym_string_token1);
      if (lookahead == ';') ADVANCE(19);
      if (('\t' <= lookahead && lookahead <= '\r') ||
          lookahead == ' ') ADVANCE(18);
      if (lookahead != 0 &&
          lookahead != '"' &&
          lookahead != '\\') ADVANCE(20);
      END_STATE();
    case 19:
      ACCEPT_TOKEN(aux_sym_string_token1);
      if (lookahead == ';') ADVANCE(17);
      if (lookahead != 0 &&
          lookahead != '"' &&
          lookahead != '\\') ADVANCE(20);
      END_STATE();
    case 20:
      ACCEPT_TOKEN(aux_sym_string_token1);
      if (lookahead != 0 &&
          lookahead != '"' &&
          lookahead != '\\') ADVANCE(20);
      END_STATE();
    case 21:
      ACCEPT_TOKEN(anon_sym_SQUOTE);
      END_STATE();
    case 22:
      ACCEPT_TOKEN(aux_sym_string_token2);
      if (lookahead == '\n') ADVANCE(25);
      if (lookahead != 0 &&
          lookahead != '\'' &&
          lookahead != '\\') ADVANCE(22);
      END_STATE();
    case 23:
      ACCEPT_TOKEN(aux_sym_string_token2);
      if (lookahead == ';') ADVANCE(24);
      if (('\t' <= lookahead && lookahead <= '\r') ||
          lookahead == ' ') ADVANCE(23);
      if (lookahead != 0 &&
          lookahead != '\'' &&
          lookahead != '\\') ADVANCE(25);
      END_STATE();
    case 24:
      ACCEPT_TOKEN(aux_sym_string_token2);
      if (lookahead == ';') ADVANCE(22);
      if (lookahead != 0 &&
          lookahead != '\'' &&
          lookahead != '\\') ADVANCE(25);
      END_STATE();
    case 25:
      ACCEPT_TOKEN(aux_sym_string_token2);
      if (lookahead != 0 &&
          lookahead != '\'' &&
          lookahead != '\\') ADVANCE(25);
      END_STATE();
    case 26:
      ACCEPT_TOKEN(sym_escape_sequence);
      END_STATE();
    case 27:
      ACCEPT_TOKEN(sym_regex);
      if (lookahead == 'g' ||
          lookahead == 'i' ||
          lookahead == 'm' ||
          lookahead == 's' ||
          lookahead == 'u' ||
          lookahead == 'v' ||
          lookahead == 'y') ADVANCE(27);
      if (set_contains(sym_identifier_character_set_2, 9, lookahead)) ADVANCE(49);
      END_STATE();
    case 28:
      ACCEPT_TOKEN(sym_regex);
      if (lookahead == 'g' ||
          lookahead == 'i' ||
          lookahead == 'm' ||
          lookahead == 's' ||
          lookahead == 'u' ||
          lookahead == 'v' ||
          lookahead == 'y') ADVANCE(28);
      END_STATE();
    case 29:
      ACCEPT_TOKEN(anon_sym_true);
      if (lookahead == ':') ADVANCE(35);
      if (lookahead == '!' ||
          lookahead == '%' ||
          lookahead == '*' ||
          lookahead == '+' ||
          lookahead == '-' ||
          lookahead == '/' ||
          ('<' <= lookahead && lookahead <= '?')) ADVANCE(49);
      if (('0' <= lookahead && lookahead <= '9') ||
          ('A' <= lookahead && lookahead <= 'Z') ||
          lookahead == '_' ||
          ('a' <= lookahead && lookahead <= 'z')) ADVANCE(47);
      END_STATE();
    case 30:
      ACCEPT_TOKEN(anon_sym_false);
      if (lookahead == ':') ADVANCE(35);
      if (lookahead == '!' ||
          lookahead == '%' ||
          lookahead == '*' ||
          lookahead == '+' ||
          lookahead == '-' ||
          lookahead == '/' ||
          ('<' <= lookahead && lookahead <= '?')) ADVANCE(49);
      if (('0' <= lookahead && lookahead <= '9') ||
          ('A' <= lookahead && lookahead <= 'Z') ||
          lookahead == '_' ||
          ('a' <= lookahead && lookahead <= 'z')) ADVANCE(47);
      END_STATE();
    case 31:
      ACCEPT_TOKEN(sym_null);
      if (lookahead == ':') ADVANCE(35);
      if (lookahead == '!' ||
          lookahead == '%' ||
          lookahead == '*' ||
          lookahead == '+' ||
          lookahead == '-' ||
          lookahead == '/' ||
          ('<' <= lookahead && lookahead <= '?')) ADVANCE(49);
      if (('0' <= lookahead && lookahead <= '9') ||
          ('A' <= lookahead && lookahead <= 'Z') ||
          lookahead == '_' ||
          ('a' <= lookahead && lookahead <= 'z')) ADVANCE(47);
      END_STATE();
    case 32:
      ACCEPT_TOKEN(anon_sym_DOLLAR_DOLLAR);
      END_STATE();
    case 33:
      ACCEPT_TOKEN(aux_sym_source_ref_token1);
      if (('0' <= lookahead && lookahead <= '9')) ADVANCE(33);
      END_STATE();
    case 34:
      ACCEPT_TOKEN(anon_sym_DOLLAR);
      if (lookahead == '$') ADVANCE(32);
      if (('0' <= lookahead && lookahead <= '9')) ADVANCE(33);
      END_STATE();
    case 35:
      ACCEPT_TOKEN(sym_effect_ident);
      END_STATE();
    case 36:
      ACCEPT_TOKEN(sym_identifier);
      if (lookahead == '/') ADVANCE(27);
      if (lookahead == '\\') ADVANCE(5);
      if (set_contains(sym_identifier_character_set_2, 9, lookahead)) ADVANCE(36);
      if (lookahead != 0 &&
          lookahead != '\n') ADVANCE(3);
      END_STATE();
    case 37:
      ACCEPT_TOKEN(sym_identifier);
      if (lookahead == ':') ADVANCE(35);
      if (lookahead == 'a') ADVANCE(40);
      if (lookahead == '!' ||
          lookahead == '%' ||
          lookahead == '*' ||
          lookahead == '+' ||
          lookahead == '-' ||
          lookahead == '/' ||
          ('<' <= lookahead && lookahead <= '?')) ADVANCE(49);
      if (('0' <= lookahead && lookahead <= '9') ||
          ('A' <= lookahead && lookahead <= 'Z') ||
          lookahead == '_' ||
          ('b' <= lookahead && lookahead <= 'z')) ADVANCE(47);
      END_STATE();
    case 38:
      ACCEPT_TOKEN(sym_identifier);
      if (lookahead == ':') ADVANCE(35);
      if (lookahead == 'e') ADVANCE(29);
      if (lookahead == '!' ||
          lookahead == '%' ||
          lookahead == '*' ||
          lookahead == '+' ||
          lookahead == '-' ||
          lookahead == '/' ||
          ('<' <= lookahead && lookahead <= '?')) ADVANCE(49);
      if (('0' <= lookahead && lookahead <= '9') ||
          ('A' <= lookahead && lookahead <= 'Z') ||
          lookahead == '_' ||
          ('a' <= lookahead && lookahead <= 'z')) ADVANCE(47);
      END_STATE();
    case 39:
      ACCEPT_TOKEN(sym_identifier);
      if (lookahead == ':') ADVANCE(35);
      if (lookahead == 'e') ADVANCE(30);
      if (lookahead == '!' ||
          lookahead == '%' ||
          lookahead == '*' ||
          lookahead == '+' ||
          lookahead == '-' ||
          lookahead == '/' ||
          ('<' <= lookahead && lookahead <= '?')) ADVANCE(49);
      if (('0' <= lookahead && lookahead <= '9') ||
          ('A' <= lookahead && lookahead <= 'Z') ||
          lookahead == '_' ||
          ('a' <= lookahead && lookahead <= 'z')) ADVANCE(47);
      END_STATE();
    case 40:
      ACCEPT_TOKEN(sym_identifier);
      if (lookahead == ':') ADVANCE(35);
      if (lookahead == 'l') ADVANCE(44);
      if (lookahead == '!' ||
          lookahead == '%' ||
          lookahead == '*' ||
          lookahead == '+' ||
          lookahead == '-' ||
          lookahead == '/' ||
          ('<' <= lookahead && lookahead <= '?')) ADVANCE(49);
      if (('0' <= lookahead && lookahead <= '9') ||
          ('A' <= lookahead && lookahead <= 'Z') ||
          lookahead == '_' ||
          ('a' <= lookahead && lookahead <= 'z')) ADVANCE(47);
      END_STATE();
    case 41:
      ACCEPT_TOKEN(sym_identifier);
      if (lookahead == ':') ADVANCE(35);
      if (lookahead == 'l') ADVANCE(31);
      if (lookahead == '!' ||
          lookahead == '%' ||
          lookahead == '*' ||
          lookahead == '+' ||
          lookahead == '-' ||
          lookahead == '/' ||
          ('<' <= lookahead && lookahead <= '?')) ADVANCE(49);
      if (('0' <= lookahead && lookahead <= '9') ||
          ('A' <= lookahead && lookahead <= 'Z') ||
          lookahead == '_' ||
          ('a' <= lookahead && lookahead <= 'z')) ADVANCE(47);
      END_STATE();
    case 42:
      ACCEPT_TOKEN(sym_identifier);
      if (lookahead == ':') ADVANCE(35);
      if (lookahead == 'l') ADVANCE(41);
      if (lookahead == '!' ||
          lookahead == '%' ||
          lookahead == '*' ||
          lookahead == '+' ||
          lookahead == '-' ||
          lookahead == '/' ||
          ('<' <= lookahead && lookahead <= '?')) ADVANCE(49);
      if (('0' <= lookahead && lookahead <= '9') ||
          ('A' <= lookahead && lookahead <= 'Z') ||
          lookahead == '_' ||
          ('a' <= lookahead && lookahead <= 'z')) ADVANCE(47);
      END_STATE();
    case 43:
      ACCEPT_TOKEN(sym_identifier);
      if (lookahead == ':') ADVANCE(35);
      if (lookahead == 'r') ADVANCE(45);
      if (lookahead == '!' ||
          lookahead == '%' ||
          lookahead == '*' ||
          lookahead == '+' ||
          lookahead == '-' ||
          lookahead == '/' ||
          ('<' <= lookahead && lookahead <= '?')) ADVANCE(49);
      if (('0' <= lookahead && lookahead <= '9') ||
          ('A' <= lookahead && lookahead <= 'Z') ||
          lookahead == '_' ||
          ('a' <= lookahead && lookahead <= 'z')) ADVANCE(47);
      END_STATE();
    case 44:
      ACCEPT_TOKEN(sym_identifier);
      if (lookahead == ':') ADVANCE(35);
      if (lookahead == 's') ADVANCE(39);
      if (lookahead == '!' ||
          lookahead == '%' ||
          lookahead == '*' ||
          lookahead == '+' ||
          lookahead == '-' ||
          lookahead == '/' ||
          ('<' <= lookahead && lookahead <= '?')) ADVANCE(49);
      if (('0' <= lookahead && lookahead <= '9') ||
          ('A' <= lookahead && lookahead <= 'Z') ||
          lookahead == '_' ||
          ('a' <= lookahead && lookahead <= 'z')) ADVANCE(47);
      END_STATE();
    case 45:
      ACCEPT_TOKEN(sym_identifier);
      if (lookahead == ':') ADVANCE(35);
      if (lookahead == 'u') ADVANCE(38);
      if (lookahead == '!' ||
          lookahead == '%' ||
          lookahead == '*' ||
          lookahead == '+' ||
          lookahead == '-' ||
          lookahead == '/' ||
          ('<' <= lookahead && lookahead <= '?')) ADVANCE(49);
      if (('0' <= lookahead && lookahead <= '9') ||
          ('A' <= lookahead && lookahead <= 'Z') ||
          lookahead == '_' ||
          ('a' <= lookahead && lookahead <= 'z')) ADVANCE(47);
      END_STATE();
    case 46:
      ACCEPT_TOKEN(sym_identifier);
      if (lookahead == ':') ADVANCE(35);
      if (lookahead == 'u') ADVANCE(42);
      if (lookahead == '!' ||
          lookahead == '%' ||
          lookahead == '*' ||
          lookahead == '+' ||
          lookahead == '-' ||
          lookahead == '/' ||
          ('<' <= lookahead && lookahead <= '?')) ADVANCE(49);
      if (('0' <= lookahead && lookahead <= '9') ||
          ('A' <= lookahead && lookahead <= 'Z') ||
          lookahead == '_' ||
          ('a' <= lookahead && lookahead <= 'z')) ADVANCE(47);
      END_STATE();
    case 47:
      ACCEPT_TOKEN(sym_identifier);
      if (lookahead == ':') ADVANCE(35);
      if (lookahead == '!' ||
          lookahead == '%' ||
          lookahead == '*' ||
          lookahead == '+' ||
          lookahead == '-' ||
          lookahead == '/' ||
          ('<' <= lookahead && lookahead <= '?')) ADVANCE(49);
      if (('0' <= lookahead && lookahead <= '9') ||
          ('A' <= lookahead && lookahead <= 'Z') ||
          lookahead == '_' ||
          ('a' <= lookahead && lookahead <= 'z')) ADVANCE(47);
      END_STATE();
    case 48:
      ACCEPT_TOKEN(sym_identifier);
      if (('0' <= lookahead && lookahead <= '9')) ADVANCE(14);
      if (set_contains(sym_identifier_character_set_2, 9, lookahead)) ADVANCE(49);
      END_STATE();
    case 49:
      ACCEPT_TOKEN(sym_identifier);
      if (set_contains(sym_identifier_character_set_2, 9, lookahead)) ADVANCE(49);
      END_STATE();
    case 50:
      ACCEPT_TOKEN(sym_comment);
      if (lookahead != 0 &&
          lookahead != '\n') ADVANCE(50);
      END_STATE();
    default:
      return false;
  }
}

static const TSLexMode ts_lex_modes[STATE_COUNT] = {
  [0] = {.lex_state = 0},
  [1] = {.lex_state = 0},
  [2] = {.lex_state = 0},
  [3] = {.lex_state = 0},
  [4] = {.lex_state = 0},
  [5] = {.lex_state = 0},
  [6] = {.lex_state = 0},
  [7] = {.lex_state = 0},
  [8] = {.lex_state = 0},
  [9] = {.lex_state = 0},
  [10] = {.lex_state = 0},
  [11] = {.lex_state = 0},
  [12] = {.lex_state = 0},
  [13] = {.lex_state = 0},
  [14] = {.lex_state = 0},
  [15] = {.lex_state = 0},
  [16] = {.lex_state = 0},
  [17] = {.lex_state = 0},
  [18] = {.lex_state = 0},
  [19] = {.lex_state = 0},
  [20] = {.lex_state = 0},
  [21] = {.lex_state = 0},
  [22] = {.lex_state = 0},
  [23] = {.lex_state = 0},
  [24] = {.lex_state = 0},
  [25] = {.lex_state = 0},
  [26] = {.lex_state = 0},
  [27] = {.lex_state = 0},
  [28] = {.lex_state = 1},
  [29] = {.lex_state = 2},
  [30] = {.lex_state = 2},
  [31] = {.lex_state = 1},
  [32] = {.lex_state = 2},
  [33] = {.lex_state = 1},
  [34] = {.lex_state = 0},
  [35] = {.lex_state = 0},
  [36] = {.lex_state = 0},
  [37] = {.lex_state = 0},
  [38] = {.lex_state = 0},
};

static const uint16_t ts_parse_table[LARGE_STATE_COUNT][SYMBOL_COUNT] = {
  [0] = {
    [ts_builtin_sym_end] = ACTIONS(1),
    [anon_sym_SEMI] = ACTIONS(1),
    [anon_sym_PIPE] = ACTIONS(1),
    [anon_sym_LPAREN] = ACTIONS(1),
    [anon_sym_RPAREN] = ACTIONS(1),
    [sym_number] = ACTIONS(1),
    [anon_sym_DQUOTE] = ACTIONS(1),
    [anon_sym_SQUOTE] = ACTIONS(1),
    [sym_escape_sequence] = ACTIONS(1),
    [sym_regex] = ACTIONS(1),
    [anon_sym_true] = ACTIONS(1),
    [anon_sym_false] = ACTIONS(1),
    [sym_null] = ACTIONS(1),
    [anon_sym_DOLLAR_DOLLAR] = ACTIONS(1),
    [aux_sym_source_ref_token1] = ACTIONS(1),
    [anon_sym_DOLLAR] = ACTIONS(1),
    [sym_effect_ident] = ACTIONS(1),
    [sym_identifier] = ACTIONS(1),
    [sym_comment] = ACTIONS(3),
  },
  [1] = {
    [sym_program] = STATE(37),
    [sym_expression] = STATE(26),
    [sym_pipeline] = STATE(25),
    [sym__primary_expr] = STATE(24),
    [sym_implicit_call] = STATE(24),
    [sym__single_expr] = STATE(7),
    [sym_list] = STATE(7),
    [sym_atom] = STATE(7),
    [sym_string] = STATE(22),
    [sym_boolean] = STATE(22),
    [sym_source_ref] = STATE(22),
    [aux_sym_program_repeat1] = STATE(4),
    [ts_builtin_sym_end] = ACTIONS(5),
    [anon_sym_LPAREN] = ACTIONS(7),
    [sym_number] = ACTIONS(9),
    [anon_sym_DQUOTE] = ACTIONS(11),
    [anon_sym_SQUOTE] = ACTIONS(13),
    [sym_regex] = ACTIONS(9),
    [anon_sym_true] = ACTIONS(15),
    [anon_sym_false] = ACTIONS(15),
    [sym_null] = ACTIONS(9),
    [anon_sym_DOLLAR_DOLLAR] = ACTIONS(17),
    [aux_sym_source_ref_token1] = ACTIONS(17),
    [anon_sym_DOLLAR] = ACTIONS(19),
    [sym_effect_ident] = ACTIONS(21),
    [sym_identifier] = ACTIONS(9),
    [sym_comment] = ACTIONS(3),
  },
  [2] = {
    [sym_pipeline] = STATE(38),
    [sym__primary_expr] = STATE(36),
    [sym_implicit_call] = STATE(36),
    [sym__single_expr] = STATE(8),
    [sym_list] = STATE(8),
    [sym__list_contents] = STATE(38),
    [sym__list_elements] = STATE(38),
    [sym_atom] = STATE(8),
    [sym_string] = STATE(22),
    [sym_boolean] = STATE(22),
    [sym_source_ref] = STATE(22),
    [anon_sym_LPAREN] = ACTIONS(7),
    [anon_sym_RPAREN] = ACTIONS(23),
    [sym_number] = ACTIONS(9),
    [anon_sym_DQUOTE] = ACTIONS(11),
    [anon_sym_SQUOTE] = ACTIONS(13),
    [sym_regex] = ACTIONS(9),
    [anon_sym_true] = ACTIONS(15),
    [anon_sym_false] = ACTIONS(15),
    [sym_null] = ACTIONS(9),
    [anon_sym_DOLLAR_DOLLAR] = ACTIONS(17),
    [aux_sym_source_ref_token1] = ACTIONS(17),
    [anon_sym_DOLLAR] = ACTIONS(19),
    [sym_effect_ident] = ACTIONS(21),
    [sym_identifier] = ACTIONS(9),
    [sym_comment] = ACTIONS(3),
  },
  [3] = {
    [sym_expression] = STATE(26),
    [sym_pipeline] = STATE(25),
    [sym__primary_expr] = STATE(24),
    [sym_implicit_call] = STATE(24),
    [sym__single_expr] = STATE(7),
    [sym_list] = STATE(7),
    [sym_atom] = STATE(7),
    [sym_string] = STATE(22),
    [sym_boolean] = STATE(22),
    [sym_source_ref] = STATE(22),
    [aux_sym_program_repeat1] = STATE(3),
    [ts_builtin_sym_end] = ACTIONS(25),
    [anon_sym_LPAREN] = ACTIONS(27),
    [sym_number] = ACTIONS(30),
    [anon_sym_DQUOTE] = ACTIONS(33),
    [anon_sym_SQUOTE] = ACTIONS(36),
    [sym_regex] = ACTIONS(30),
    [anon_sym_true] = ACTIONS(39),
    [anon_sym_false] = ACTIONS(39),
    [sym_null] = ACTIONS(30),
    [anon_sym_DOLLAR_DOLLAR] = ACTIONS(42),
    [aux_sym_source_ref_token1] = ACTIONS(42),
    [anon_sym_DOLLAR] = ACTIONS(45),
    [sym_effect_ident] = ACTIONS(48),
    [sym_identifier] = ACTIONS(30),
    [sym_comment] = ACTIONS(3),
  },
  [4] = {
    [sym_expression] = STATE(26),
    [sym_pipeline] = STATE(25),
    [sym__primary_expr] = STATE(24),
    [sym_implicit_call] = STATE(24),
    [sym__single_expr] = STATE(7),
    [sym_list] = STATE(7),
    [sym_atom] = STATE(7),
    [sym_string] = STATE(22),
    [sym_boolean] = STATE(22),
    [sym_source_ref] = STATE(22),
    [aux_sym_program_repeat1] = STATE(3),
    [ts_builtin_sym_end] = ACTIONS(51),
    [anon_sym_LPAREN] = ACTIONS(7),
    [sym_number] = ACTIONS(9),
    [anon_sym_DQUOTE] = ACTIONS(11),
    [anon_sym_SQUOTE] = ACTIONS(13),
    [sym_regex] = ACTIONS(9),
    [anon_sym_true] = ACTIONS(15),
    [anon_sym_false] = ACTIONS(15),
    [sym_null] = ACTIONS(9),
    [anon_sym_DOLLAR_DOLLAR] = ACTIONS(17),
    [aux_sym_source_ref_token1] = ACTIONS(17),
    [anon_sym_DOLLAR] = ACTIONS(19),
    [sym_effect_ident] = ACTIONS(21),
    [sym_identifier] = ACTIONS(9),
    [sym_comment] = ACTIONS(3),
  },
  [5] = {
    [sym__single_expr] = STATE(5),
    [sym_list] = STATE(5),
    [sym_atom] = STATE(5),
    [sym_string] = STATE(22),
    [sym_boolean] = STATE(22),
    [sym_source_ref] = STATE(22),
    [aux_sym_implicit_call_repeat1] = STATE(5),
    [ts_builtin_sym_end] = ACTIONS(53),
    [anon_sym_SEMI] = ACTIONS(55),
    [anon_sym_PIPE] = ACTIONS(53),
    [anon_sym_LPAREN] = ACTIONS(57),
    [anon_sym_RPAREN] = ACTIONS(53),
    [sym_number] = ACTIONS(60),
    [anon_sym_DQUOTE] = ACTIONS(63),
    [anon_sym_SQUOTE] = ACTIONS(66),
    [sym_regex] = ACTIONS(60),
    [anon_sym_true] = ACTIONS(69),
    [anon_sym_false] = ACTIONS(69),
    [sym_null] = ACTIONS(60),
    [anon_sym_DOLLAR_DOLLAR] = ACTIONS(72),
    [aux_sym_source_ref_token1] = ACTIONS(72),
    [anon_sym_DOLLAR] = ACTIONS(75),
    [sym_effect_ident] = ACTIONS(78),
    [sym_identifier] = ACTIONS(60),
    [sym_comment] = ACTIONS(3),
  },
  [6] = {
    [sym__single_expr] = STATE(5),
    [sym_list] = STATE(5),
    [sym_atom] = STATE(5),
    [sym_string] = STATE(22),
    [sym_boolean] = STATE(22),
    [sym_source_ref] = STATE(22),
    [aux_sym_implicit_call_repeat1] = STATE(5),
    [ts_builtin_sym_end] = ACTIONS(81),
    [anon_sym_SEMI] = ACTIONS(83),
    [anon_sym_PIPE] = ACTIONS(81),
    [anon_sym_LPAREN] = ACTIONS(81),
    [sym_number] = ACTIONS(83),
    [anon_sym_DQUOTE] = ACTIONS(81),
    [anon_sym_SQUOTE] = ACTIONS(81),
    [sym_regex] = ACTIONS(83),
    [anon_sym_true] = ACTIONS(83),
    [anon_sym_false] = ACTIONS(83),
    [sym_null] = ACTIONS(83),
    [anon_sym_DOLLAR_DOLLAR] = ACTIONS(81),
    [aux_sym_source_ref_token1] = ACTIONS(81),
    [anon_sym_DOLLAR] = ACTIONS(83),
    [sym_effect_ident] = ACTIONS(81),
    [sym_identifier] = ACTIONS(83),
    [sym_comment] = ACTIONS(3),
  },
  [7] = {
    [sym__single_expr] = STATE(6),
    [sym_list] = STATE(6),
    [sym_atom] = STATE(6),
    [sym_string] = STATE(22),
    [sym_boolean] = STATE(22),
    [sym_source_ref] = STATE(22),
    [aux_sym_implicit_call_repeat1] = STATE(6),
    [ts_builtin_sym_end] = ACTIONS(85),
    [anon_sym_SEMI] = ACTIONS(87),
    [anon_sym_PIPE] = ACTIONS(85),
    [anon_sym_LPAREN] = ACTIONS(7),
    [sym_number] = ACTIONS(9),
    [anon_sym_DQUOTE] = ACTIONS(11),
    [anon_sym_SQUOTE] = ACTIONS(13),
    [sym_regex] = ACTIONS(9),
    [anon_sym_true] = ACTIONS(15),
    [anon_sym_false] = ACTIONS(15),
    [sym_null] = ACTIONS(9),
    [anon_sym_DOLLAR_DOLLAR] = ACTIONS(17),
    [aux_sym_source_ref_token1] = ACTIONS(17),
    [anon_sym_DOLLAR] = ACTIONS(19),
    [sym_effect_ident] = ACTIONS(21),
    [sym_identifier] = ACTIONS(9),
    [sym_comment] = ACTIONS(3),
  },
  [8] = {
    [sym__single_expr] = STATE(11),
    [sym_list] = STATE(11),
    [sym_atom] = STATE(11),
    [sym_string] = STATE(22),
    [sym_boolean] = STATE(22),
    [sym_source_ref] = STATE(22),
    [aux_sym_implicit_call_repeat1] = STATE(11),
    [anon_sym_PIPE] = ACTIONS(85),
    [anon_sym_LPAREN] = ACTIONS(7),
    [anon_sym_RPAREN] = ACTIONS(89),
    [sym_number] = ACTIONS(9),
    [anon_sym_DQUOTE] = ACTIONS(11),
    [anon_sym_SQUOTE] = ACTIONS(13),
    [sym_regex] = ACTIONS(9),
    [anon_sym_true] = ACTIONS(15),
    [anon_sym_false] = ACTIONS(15),
    [sym_null] = ACTIONS(9),
    [anon_sym_DOLLAR_DOLLAR] = ACTIONS(17),
    [aux_sym_source_ref_token1] = ACTIONS(17),
    [anon_sym_DOLLAR] = ACTIONS(19),
    [sym_effect_ident] = ACTIONS(21),
    [sym_identifier] = ACTIONS(9),
    [sym_comment] = ACTIONS(3),
  },
  [9] = {
    [sym__single_expr] = STATE(10),
    [sym_list] = STATE(10),
    [sym_atom] = STATE(10),
    [sym_string] = STATE(22),
    [sym_boolean] = STATE(22),
    [sym_source_ref] = STATE(22),
    [aux_sym_implicit_call_repeat1] = STATE(10),
    [anon_sym_PIPE] = ACTIONS(85),
    [anon_sym_LPAREN] = ACTIONS(7),
    [anon_sym_RPAREN] = ACTIONS(85),
    [sym_number] = ACTIONS(9),
    [anon_sym_DQUOTE] = ACTIONS(11),
    [anon_sym_SQUOTE] = ACTIONS(13),
    [sym_regex] = ACTIONS(9),
    [anon_sym_true] = ACTIONS(15),
    [anon_sym_false] = ACTIONS(15),
    [sym_null] = ACTIONS(9),
    [anon_sym_DOLLAR_DOLLAR] = ACTIONS(17),
    [aux_sym_source_ref_token1] = ACTIONS(17),
    [anon_sym_DOLLAR] = ACTIONS(19),
    [sym_effect_ident] = ACTIONS(21),
    [sym_identifier] = ACTIONS(9),
    [sym_comment] = ACTIONS(3),
  },
  [10] = {
    [sym__single_expr] = STATE(5),
    [sym_list] = STATE(5),
    [sym_atom] = STATE(5),
    [sym_string] = STATE(22),
    [sym_boolean] = STATE(22),
    [sym_source_ref] = STATE(22),
    [aux_sym_implicit_call_repeat1] = STATE(5),
    [anon_sym_PIPE] = ACTIONS(81),
    [anon_sym_LPAREN] = ACTIONS(7),
    [anon_sym_RPAREN] = ACTIONS(81),
    [sym_number] = ACTIONS(9),
    [anon_sym_DQUOTE] = ACTIONS(11),
    [anon_sym_SQUOTE] = ACTIONS(13),
    [sym_regex] = ACTIONS(9),
    [anon_sym_true] = ACTIONS(15),
    [anon_sym_false] = ACTIONS(15),
    [sym_null] = ACTIONS(9),
    [anon_sym_DOLLAR_DOLLAR] = ACTIONS(17),
    [aux_sym_source_ref_token1] = ACTIONS(17),
    [anon_sym_DOLLAR] = ACTIONS(19),
    [sym_effect_ident] = ACTIONS(21),
    [sym_identifier] = ACTIONS(9),
    [sym_comment] = ACTIONS(3),
  },
  [11] = {
    [sym__single_expr] = STATE(5),
    [sym_list] = STATE(5),
    [sym_atom] = STATE(5),
    [sym_string] = STATE(22),
    [sym_boolean] = STATE(22),
    [sym_source_ref] = STATE(22),
    [aux_sym_implicit_call_repeat1] = STATE(5),
    [anon_sym_PIPE] = ACTIONS(81),
    [anon_sym_LPAREN] = ACTIONS(7),
    [anon_sym_RPAREN] = ACTIONS(91),
    [sym_number] = ACTIONS(9),
    [anon_sym_DQUOTE] = ACTIONS(11),
    [anon_sym_SQUOTE] = ACTIONS(13),
    [sym_regex] = ACTIONS(9),
    [anon_sym_true] = ACTIONS(15),
    [anon_sym_false] = ACTIONS(15),
    [sym_null] = ACTIONS(9),
    [anon_sym_DOLLAR_DOLLAR] = ACTIONS(17),
    [aux_sym_source_ref_token1] = ACTIONS(17),
    [anon_sym_DOLLAR] = ACTIONS(19),
    [sym_effect_ident] = ACTIONS(21),
    [sym_identifier] = ACTIONS(9),
    [sym_comment] = ACTIONS(3),
  },
  [12] = {
    [sym__primary_expr] = STATE(20),
    [sym_implicit_call] = STATE(20),
    [sym__single_expr] = STATE(9),
    [sym_list] = STATE(9),
    [sym_atom] = STATE(9),
    [sym_string] = STATE(22),
    [sym_boolean] = STATE(22),
    [sym_source_ref] = STATE(22),
    [anon_sym_LPAREN] = ACTIONS(7),
    [sym_number] = ACTIONS(9),
    [anon_sym_DQUOTE] = ACTIONS(11),
    [anon_sym_SQUOTE] = ACTIONS(13),
    [sym_regex] = ACTIONS(9),
    [anon_sym_true] = ACTIONS(15),
    [anon_sym_false] = ACTIONS(15),
    [sym_null] = ACTIONS(9),
    [anon_sym_DOLLAR_DOLLAR] = ACTIONS(17),
    [aux_sym_source_ref_token1] = ACTIONS(17),
    [anon_sym_DOLLAR] = ACTIONS(19),
    [sym_effect_ident] = ACTIONS(21),
    [sym_identifier] = ACTIONS(9),
    [sym_comment] = ACTIONS(3),
  },
  [13] = {
    [sym__primary_expr] = STATE(20),
    [sym_implicit_call] = STATE(20),
    [sym__single_expr] = STATE(7),
    [sym_list] = STATE(7),
    [sym_atom] = STATE(7),
    [sym_string] = STATE(22),
    [sym_boolean] = STATE(22),
    [sym_source_ref] = STATE(22),
    [anon_sym_LPAREN] = ACTIONS(7),
    [sym_number] = ACTIONS(9),
    [anon_sym_DQUOTE] = ACTIONS(11),
    [anon_sym_SQUOTE] = ACTIONS(13),
    [sym_regex] = ACTIONS(9),
    [anon_sym_true] = ACTIONS(15),
    [anon_sym_false] = ACTIONS(15),
    [sym_null] = ACTIONS(9),
    [anon_sym_DOLLAR_DOLLAR] = ACTIONS(17),
    [aux_sym_source_ref_token1] = ACTIONS(17),
    [anon_sym_DOLLAR] = ACTIONS(19),
    [sym_effect_ident] = ACTIONS(21),
    [sym_identifier] = ACTIONS(9),
    [sym_comment] = ACTIONS(3),
  },
};

static const uint16_t ts_small_parse_table[] = {
  [0] = 3,
    ACTIONS(3), 1,
      sym_comment,
    ACTIONS(95), 8,
      anon_sym_SEMI,
      sym_number,
      sym_regex,
      anon_sym_true,
      anon_sym_false,
      sym_null,
      anon_sym_DOLLAR,
      sym_identifier,
    ACTIONS(93), 9,
      ts_builtin_sym_end,
      anon_sym_PIPE,
      anon_sym_LPAREN,
      anon_sym_RPAREN,
      anon_sym_DQUOTE,
      anon_sym_SQUOTE,
      anon_sym_DOLLAR_DOLLAR,
      aux_sym_source_ref_token1,
      sym_effect_ident,
  [25] = 3,
    ACTIONS(3), 1,
      sym_comment,
    ACTIONS(99), 8,
      anon_sym_SEMI,
      sym_number,
      sym_regex,
      anon_sym_true,
      anon_sym_false,
      sym_null,
      anon_sym_DOLLAR,
      sym_identifier,
    ACTIONS(97), 9,
      ts_builtin_sym_end,
      anon_sym_PIPE,
      anon_sym_LPAREN,
      anon_sym_RPAREN,
      anon_sym_DQUOTE,
      anon_sym_SQUOTE,
      anon_sym_DOLLAR_DOLLAR,
      aux_sym_source_ref_token1,
      sym_effect_ident,
  [50] = 3,
    ACTIONS(3), 1,
      sym_comment,
    ACTIONS(103), 8,
      anon_sym_SEMI,
      sym_number,
      sym_regex,
      anon_sym_true,
      anon_sym_false,
      sym_null,
      anon_sym_DOLLAR,
      sym_identifier,
    ACTIONS(101), 9,
      ts_builtin_sym_end,
      anon_sym_PIPE,
      anon_sym_LPAREN,
      anon_sym_RPAREN,
      anon_sym_DQUOTE,
      anon_sym_SQUOTE,
      anon_sym_DOLLAR_DOLLAR,
      aux_sym_source_ref_token1,
      sym_effect_ident,
  [75] = 3,
    ACTIONS(3), 1,
      sym_comment,
    ACTIONS(107), 8,
      anon_sym_SEMI,
      sym_number,
      sym_regex,
      anon_sym_true,
      anon_sym_false,
      sym_null,
      anon_sym_DOLLAR,
      sym_identifier,
    ACTIONS(105), 9,
      ts_builtin_sym_end,
      anon_sym_PIPE,
      anon_sym_LPAREN,
      anon_sym_RPAREN,
      anon_sym_DQUOTE,
      anon_sym_SQUOTE,
      anon_sym_DOLLAR_DOLLAR,
      aux_sym_source_ref_token1,
      sym_effect_ident,
  [100] = 3,
    ACTIONS(3), 1,
      sym_comment,
    ACTIONS(111), 8,
      anon_sym_SEMI,
      sym_number,
      sym_regex,
      anon_sym_true,
      anon_sym_false,
      sym_null,
      anon_sym_DOLLAR,
      sym_identifier,
    ACTIONS(109), 9,
      ts_builtin_sym_end,
      anon_sym_PIPE,
      anon_sym_LPAREN,
      anon_sym_RPAREN,
      anon_sym_DQUOTE,
      anon_sym_SQUOTE,
      anon_sym_DOLLAR_DOLLAR,
      aux_sym_source_ref_token1,
      sym_effect_ident,
  [125] = 5,
    ACTIONS(3), 1,
      sym_comment,
    ACTIONS(117), 1,
      anon_sym_PIPE,
    STATE(19), 1,
      aux_sym_pipeline_repeat1,
    ACTIONS(113), 7,
      ts_builtin_sym_end,
      anon_sym_LPAREN,
      anon_sym_DQUOTE,
      anon_sym_SQUOTE,
      anon_sym_DOLLAR_DOLLAR,
      aux_sym_source_ref_token1,
      sym_effect_ident,
    ACTIONS(115), 8,
      anon_sym_SEMI,
      sym_number,
      sym_regex,
      anon_sym_true,
      anon_sym_false,
      sym_null,
      anon_sym_DOLLAR,
      sym_identifier,
  [154] = 3,
    ACTIONS(3), 1,
      sym_comment,
    ACTIONS(115), 8,
      anon_sym_SEMI,
      sym_number,
      sym_regex,
      anon_sym_true,
      anon_sym_false,
      sym_null,
      anon_sym_DOLLAR,
      sym_identifier,
    ACTIONS(113), 9,
      ts_builtin_sym_end,
      anon_sym_PIPE,
      anon_sym_LPAREN,
      anon_sym_RPAREN,
      anon_sym_DQUOTE,
      anon_sym_SQUOTE,
      anon_sym_DOLLAR_DOLLAR,
      aux_sym_source_ref_token1,
      sym_effect_ident,
  [179] = 3,
    ACTIONS(3), 1,
      sym_comment,
    ACTIONS(122), 8,
      anon_sym_SEMI,
      sym_number,
      sym_regex,
      anon_sym_true,
      anon_sym_false,
      sym_null,
      anon_sym_DOLLAR,
      sym_identifier,
    ACTIONS(120), 9,
      ts_builtin_sym_end,
      anon_sym_PIPE,
      anon_sym_LPAREN,
      anon_sym_RPAREN,
      anon_sym_DQUOTE,
      anon_sym_SQUOTE,
      anon_sym_DOLLAR_DOLLAR,
      aux_sym_source_ref_token1,
      sym_effect_ident,
  [204] = 3,
    ACTIONS(3), 1,
      sym_comment,
    ACTIONS(126), 8,
      anon_sym_SEMI,
      sym_number,
      sym_regex,
      anon_sym_true,
      anon_sym_false,
      sym_null,
      anon_sym_DOLLAR,
      sym_identifier,
    ACTIONS(124), 9,
      ts_builtin_sym_end,
      anon_sym_PIPE,
      anon_sym_LPAREN,
      anon_sym_RPAREN,
      anon_sym_DQUOTE,
      anon_sym_SQUOTE,
      anon_sym_DOLLAR_DOLLAR,
      aux_sym_source_ref_token1,
      sym_effect_ident,
  [229] = 5,
    ACTIONS(3), 1,
      sym_comment,
    ACTIONS(132), 1,
      anon_sym_PIPE,
    STATE(19), 1,
      aux_sym_pipeline_repeat1,
    ACTIONS(128), 7,
      ts_builtin_sym_end,
      anon_sym_LPAREN,
      anon_sym_DQUOTE,
      anon_sym_SQUOTE,
      anon_sym_DOLLAR_DOLLAR,
      aux_sym_source_ref_token1,
      sym_effect_ident,
    ACTIONS(130), 8,
      anon_sym_SEMI,
      sym_number,
      sym_regex,
      anon_sym_true,
      anon_sym_false,
      sym_null,
      anon_sym_DOLLAR,
      sym_identifier,
  [258] = 5,
    ACTIONS(3), 1,
      sym_comment,
    ACTIONS(132), 1,
      anon_sym_PIPE,
    STATE(23), 1,
      aux_sym_pipeline_repeat1,
    ACTIONS(134), 7,
      ts_builtin_sym_end,
      anon_sym_LPAREN,
      anon_sym_DQUOTE,
      anon_sym_SQUOTE,
      anon_sym_DOLLAR_DOLLAR,
      aux_sym_source_ref_token1,
      sym_effect_ident,
    ACTIONS(136), 8,
      anon_sym_SEMI,
      sym_number,
      sym_regex,
      anon_sym_true,
      anon_sym_false,
      sym_null,
      anon_sym_DOLLAR,
      sym_identifier,
  [287] = 3,
    ACTIONS(3), 1,
      sym_comment,
    ACTIONS(134), 7,
      ts_builtin_sym_end,
      anon_sym_LPAREN,
      anon_sym_DQUOTE,
      anon_sym_SQUOTE,
      anon_sym_DOLLAR_DOLLAR,
      aux_sym_source_ref_token1,
      sym_effect_ident,
    ACTIONS(136), 8,
      anon_sym_SEMI,
      sym_number,
      sym_regex,
      anon_sym_true,
      anon_sym_false,
      sym_null,
      anon_sym_DOLLAR,
      sym_identifier,
  [310] = 4,
    ACTIONS(3), 1,
      sym_comment,
    ACTIONS(140), 1,
      anon_sym_SEMI,
    ACTIONS(138), 7,
      ts_builtin_sym_end,
      anon_sym_LPAREN,
      anon_sym_DQUOTE,
      anon_sym_SQUOTE,
      anon_sym_DOLLAR_DOLLAR,
      aux_sym_source_ref_token1,
      sym_effect_ident,
    ACTIONS(142), 7,
      sym_number,
      sym_regex,
      anon_sym_true,
      anon_sym_false,
      sym_null,
      anon_sym_DOLLAR,
      sym_identifier,
  [335] = 3,
    ACTIONS(3), 1,
      sym_comment,
    ACTIONS(25), 7,
      ts_builtin_sym_end,
      anon_sym_LPAREN,
      anon_sym_DQUOTE,
      anon_sym_SQUOTE,
      anon_sym_DOLLAR_DOLLAR,
      aux_sym_source_ref_token1,
      sym_effect_ident,
    ACTIONS(144), 7,
      sym_number,
      sym_regex,
      anon_sym_true,
      anon_sym_false,
      sym_null,
      anon_sym_DOLLAR,
      sym_identifier,
  [357] = 4,
    ACTIONS(146), 1,
      anon_sym_DQUOTE,
    ACTIONS(151), 1,
      sym_comment,
    STATE(28), 1,
      aux_sym_string_repeat1,
    ACTIONS(148), 2,
      aux_sym_string_token1,
      sym_escape_sequence,
  [371] = 4,
    ACTIONS(151), 1,
      sym_comment,
    ACTIONS(153), 1,
      anon_sym_SQUOTE,
    STATE(29), 1,
      aux_sym_string_repeat2,
    ACTIONS(155), 2,
      aux_sym_string_token2,
      sym_escape_sequence,
  [385] = 4,
    ACTIONS(151), 1,
      sym_comment,
    ACTIONS(158), 1,
      anon_sym_SQUOTE,
    STATE(29), 1,
      aux_sym_string_repeat2,
    ACTIONS(160), 2,
      aux_sym_string_token2,
      sym_escape_sequence,
  [399] = 4,
    ACTIONS(151), 1,
      sym_comment,
    ACTIONS(158), 1,
      anon_sym_DQUOTE,
    STATE(28), 1,
      aux_sym_string_repeat1,
    ACTIONS(162), 2,
      aux_sym_string_token1,
      sym_escape_sequence,
  [413] = 4,
    ACTIONS(151), 1,
      sym_comment,
    ACTIONS(164), 1,
      anon_sym_SQUOTE,
    STATE(30), 1,
      aux_sym_string_repeat2,
    ACTIONS(166), 2,
      aux_sym_string_token2,
      sym_escape_sequence,
  [427] = 4,
    ACTIONS(151), 1,
      sym_comment,
    ACTIONS(164), 1,
      anon_sym_DQUOTE,
    STATE(31), 1,
      aux_sym_string_repeat1,
    ACTIONS(168), 2,
      aux_sym_string_token1,
      sym_escape_sequence,
  [441] = 4,
    ACTIONS(3), 1,
      sym_comment,
    ACTIONS(128), 1,
      anon_sym_RPAREN,
    ACTIONS(170), 1,
      anon_sym_PIPE,
    STATE(35), 1,
      aux_sym_pipeline_repeat1,
  [454] = 4,
    ACTIONS(3), 1,
      sym_comment,
    ACTIONS(113), 1,
      anon_sym_RPAREN,
    ACTIONS(172), 1,
      anon_sym_PIPE,
    STATE(35), 1,
      aux_sym_pipeline_repeat1,
  [467] = 3,
    ACTIONS(3), 1,
      sym_comment,
    ACTIONS(170), 1,
      anon_sym_PIPE,
    STATE(34), 1,
      aux_sym_pipeline_repeat1,
  [477] = 2,
    ACTIONS(3), 1,
      sym_comment,
    ACTIONS(175), 1,
      ts_builtin_sym_end,
  [484] = 2,
    ACTIONS(3), 1,
      sym_comment,
    ACTIONS(177), 1,
      anon_sym_RPAREN,
};

static const uint32_t ts_small_parse_table_map[] = {
  [SMALL_STATE(14)] = 0,
  [SMALL_STATE(15)] = 25,
  [SMALL_STATE(16)] = 50,
  [SMALL_STATE(17)] = 75,
  [SMALL_STATE(18)] = 100,
  [SMALL_STATE(19)] = 125,
  [SMALL_STATE(20)] = 154,
  [SMALL_STATE(21)] = 179,
  [SMALL_STATE(22)] = 204,
  [SMALL_STATE(23)] = 229,
  [SMALL_STATE(24)] = 258,
  [SMALL_STATE(25)] = 287,
  [SMALL_STATE(26)] = 310,
  [SMALL_STATE(27)] = 335,
  [SMALL_STATE(28)] = 357,
  [SMALL_STATE(29)] = 371,
  [SMALL_STATE(30)] = 385,
  [SMALL_STATE(31)] = 399,
  [SMALL_STATE(32)] = 413,
  [SMALL_STATE(33)] = 427,
  [SMALL_STATE(34)] = 441,
  [SMALL_STATE(35)] = 454,
  [SMALL_STATE(36)] = 467,
  [SMALL_STATE(37)] = 477,
  [SMALL_STATE(38)] = 484,
};

static const TSParseActionEntry ts_parse_actions[] = {
  [0] = {.entry = {.count = 0, .reusable = false}},
  [1] = {.entry = {.count = 1, .reusable = false}}, RECOVER(),
  [3] = {.entry = {.count = 1, .reusable = true}}, SHIFT_EXTRA(),
  [5] = {.entry = {.count = 1, .reusable = true}}, REDUCE(sym_program, 0, 0, 0),
  [7] = {.entry = {.count = 1, .reusable = true}}, SHIFT(2),
  [9] = {.entry = {.count = 1, .reusable = false}}, SHIFT(22),
  [11] = {.entry = {.count = 1, .reusable = true}}, SHIFT(33),
  [13] = {.entry = {.count = 1, .reusable = true}}, SHIFT(32),
  [15] = {.entry = {.count = 1, .reusable = false}}, SHIFT(16),
  [17] = {.entry = {.count = 1, .reusable = true}}, SHIFT(17),
  [19] = {.entry = {.count = 1, .reusable = false}}, SHIFT(17),
  [21] = {.entry = {.count = 1, .reusable = true}}, SHIFT(22),
  [23] = {.entry = {.count = 1, .reusable = true}}, SHIFT(21),
  [25] = {.entry = {.count = 1, .reusable = true}}, REDUCE(aux_sym_program_repeat1, 2, 0, 0),
  [27] = {.entry = {.count = 2, .reusable = true}}, REDUCE(aux_sym_program_repeat1, 2, 0, 0), SHIFT_REPEAT(2),
  [30] = {.entry = {.count = 2, .reusable = false}}, REDUCE(aux_sym_program_repeat1, 2, 0, 0), SHIFT_REPEAT(22),
  [33] = {.entry = {.count = 2, .reusable = true}}, REDUCE(aux_sym_program_repeat1, 2, 0, 0), SHIFT_REPEAT(33),
  [36] = {.entry = {.count = 2, .reusable = true}}, REDUCE(aux_sym_program_repeat1, 2, 0, 0), SHIFT_REPEAT(32),
  [39] = {.entry = {.count = 2, .reusable = false}}, REDUCE(aux_sym_program_repeat1, 2, 0, 0), SHIFT_REPEAT(16),
  [42] = {.entry = {.count = 2, .reusable = true}}, REDUCE(aux_sym_program_repeat1, 2, 0, 0), SHIFT_REPEAT(17),
  [45] = {.entry = {.count = 2, .reusable = false}}, REDUCE(aux_sym_program_repeat1, 2, 0, 0), SHIFT_REPEAT(17),
  [48] = {.entry = {.count = 2, .reusable = true}}, REDUCE(aux_sym_program_repeat1, 2, 0, 0), SHIFT_REPEAT(22),
  [51] = {.entry = {.count = 1, .reusable = true}}, REDUCE(sym_program, 1, 0, 0),
  [53] = {.entry = {.count = 1, .reusable = true}}, REDUCE(aux_sym_implicit_call_repeat1, 2, 0, 0),
  [55] = {.entry = {.count = 1, .reusable = false}}, REDUCE(aux_sym_implicit_call_repeat1, 2, 0, 0),
  [57] = {.entry = {.count = 2, .reusable = true}}, REDUCE(aux_sym_implicit_call_repeat1, 2, 0, 0), SHIFT_REPEAT(2),
  [60] = {.entry = {.count = 2, .reusable = false}}, REDUCE(aux_sym_implicit_call_repeat1, 2, 0, 0), SHIFT_REPEAT(22),
  [63] = {.entry = {.count = 2, .reusable = true}}, REDUCE(aux_sym_implicit_call_repeat1, 2, 0, 0), SHIFT_REPEAT(33),
  [66] = {.entry = {.count = 2, .reusable = true}}, REDUCE(aux_sym_implicit_call_repeat1, 2, 0, 0), SHIFT_REPEAT(32),
  [69] = {.entry = {.count = 2, .reusable = false}}, REDUCE(aux_sym_implicit_call_repeat1, 2, 0, 0), SHIFT_REPEAT(16),
  [72] = {.entry = {.count = 2, .reusable = true}}, REDUCE(aux_sym_implicit_call_repeat1, 2, 0, 0), SHIFT_REPEAT(17),
  [75] = {.entry = {.count = 2, .reusable = false}}, REDUCE(aux_sym_implicit_call_repeat1, 2, 0, 0), SHIFT_REPEAT(17),
  [78] = {.entry = {.count = 2, .reusable = true}}, REDUCE(aux_sym_implicit_call_repeat1, 2, 0, 0), SHIFT_REPEAT(22),
  [81] = {.entry = {.count = 1, .reusable = true}}, REDUCE(sym_implicit_call, 2, 0, 0),
  [83] = {.entry = {.count = 1, .reusable = false}}, REDUCE(sym_implicit_call, 2, 0, 0),
  [85] = {.entry = {.count = 1, .reusable = true}}, REDUCE(sym__primary_expr, 1, 0, 0),
  [87] = {.entry = {.count = 1, .reusable = false}}, REDUCE(sym__primary_expr, 1, 0, 0),
  [89] = {.entry = {.count = 1, .reusable = true}}, REDUCE(sym__list_elements, 1, 0, 0),
  [91] = {.entry = {.count = 1, .reusable = true}}, REDUCE(sym__list_elements, 2, 0, 0),
  [93] = {.entry = {.count = 1, .reusable = true}}, REDUCE(sym_list, 3, 0, 0),
  [95] = {.entry = {.count = 1, .reusable = false}}, REDUCE(sym_list, 3, 0, 0),
  [97] = {.entry = {.count = 1, .reusable = true}}, REDUCE(sym_string, 3, 0, 0),
  [99] = {.entry = {.count = 1, .reusable = false}}, REDUCE(sym_string, 3, 0, 0),
  [101] = {.entry = {.count = 1, .reusable = true}}, REDUCE(sym_boolean, 1, 0, 0),
  [103] = {.entry = {.count = 1, .reusable = false}}, REDUCE(sym_boolean, 1, 0, 0),
  [105] = {.entry = {.count = 1, .reusable = true}}, REDUCE(sym_source_ref, 1, 0, 0),
  [107] = {.entry = {.count = 1, .reusable = false}}, REDUCE(sym_source_ref, 1, 0, 0),
  [109] = {.entry = {.count = 1, .reusable = true}}, REDUCE(sym_string, 2, 0, 0),
  [111] = {.entry = {.count = 1, .reusable = false}}, REDUCE(sym_string, 2, 0, 0),
  [113] = {.entry = {.count = 1, .reusable = true}}, REDUCE(aux_sym_pipeline_repeat1, 2, 0, 0),
  [115] = {.entry = {.count = 1, .reusable = false}}, REDUCE(aux_sym_pipeline_repeat1, 2, 0, 0),
  [117] = {.entry = {.count = 2, .reusable = true}}, REDUCE(aux_sym_pipeline_repeat1, 2, 0, 0), SHIFT_REPEAT(13),
  [120] = {.entry = {.count = 1, .reusable = true}}, REDUCE(sym_list, 2, 0, 0),
  [122] = {.entry = {.count = 1, .reusable = false}}, REDUCE(sym_list, 2, 0, 0),
  [124] = {.entry = {.count = 1, .reusable = true}}, REDUCE(sym_atom, 1, 0, 0),
  [126] = {.entry = {.count = 1, .reusable = false}}, REDUCE(sym_atom, 1, 0, 0),
  [128] = {.entry = {.count = 1, .reusable = true}}, REDUCE(sym_pipeline, 2, 0, 0),
  [130] = {.entry = {.count = 1, .reusable = false}}, REDUCE(sym_pipeline, 2, 0, 0),
  [132] = {.entry = {.count = 1, .reusable = true}}, SHIFT(13),
  [134] = {.entry = {.count = 1, .reusable = true}}, REDUCE(sym_expression, 1, 0, 0),
  [136] = {.entry = {.count = 1, .reusable = false}}, REDUCE(sym_expression, 1, 0, 0),
  [138] = {.entry = {.count = 1, .reusable = true}}, REDUCE(aux_sym_program_repeat1, 1, 0, 0),
  [140] = {.entry = {.count = 1, .reusable = false}}, SHIFT(27),
  [142] = {.entry = {.count = 1, .reusable = false}}, REDUCE(aux_sym_program_repeat1, 1, 0, 0),
  [144] = {.entry = {.count = 1, .reusable = false}}, REDUCE(aux_sym_program_repeat1, 2, 0, 0),
  [146] = {.entry = {.count = 1, .reusable = false}}, REDUCE(aux_sym_string_repeat1, 2, 0, 0),
  [148] = {.entry = {.count = 2, .reusable = true}}, REDUCE(aux_sym_string_repeat1, 2, 0, 0), SHIFT_REPEAT(28),
  [151] = {.entry = {.count = 1, .reusable = false}}, SHIFT_EXTRA(),
  [153] = {.entry = {.count = 1, .reusable = false}}, REDUCE(aux_sym_string_repeat2, 2, 0, 0),
  [155] = {.entry = {.count = 2, .reusable = true}}, REDUCE(aux_sym_string_repeat2, 2, 0, 0), SHIFT_REPEAT(29),
  [158] = {.entry = {.count = 1, .reusable = false}}, SHIFT(15),
  [160] = {.entry = {.count = 1, .reusable = true}}, SHIFT(29),
  [162] = {.entry = {.count = 1, .reusable = true}}, SHIFT(28),
  [164] = {.entry = {.count = 1, .reusable = false}}, SHIFT(18),
  [166] = {.entry = {.count = 1, .reusable = true}}, SHIFT(30),
  [168] = {.entry = {.count = 1, .reusable = true}}, SHIFT(31),
  [170] = {.entry = {.count = 1, .reusable = true}}, SHIFT(12),
  [172] = {.entry = {.count = 2, .reusable = true}}, REDUCE(aux_sym_pipeline_repeat1, 2, 0, 0), SHIFT_REPEAT(12),
  [175] = {.entry = {.count = 1, .reusable = true}},  ACCEPT_INPUT(),
  [177] = {.entry = {.count = 1, .reusable = true}}, SHIFT(14),
};

#ifdef __cplusplus
extern "C" {
#endif
#ifdef TREE_SITTER_HIDE_SYMBOLS
#define TS_PUBLIC
#elif defined(_WIN32)
#define TS_PUBLIC __declspec(dllexport)
#else
#define TS_PUBLIC __attribute__((visibility("default")))
#endif

TS_PUBLIC const TSLanguage *tree_sitter_pex(void) {
  static const TSLanguage language = {
    .version = LANGUAGE_VERSION,
    .symbol_count = SYMBOL_COUNT,
    .alias_count = ALIAS_COUNT,
    .token_count = TOKEN_COUNT,
    .external_token_count = EXTERNAL_TOKEN_COUNT,
    .state_count = STATE_COUNT,
    .large_state_count = LARGE_STATE_COUNT,
    .production_id_count = PRODUCTION_ID_COUNT,
    .field_count = FIELD_COUNT,
    .max_alias_sequence_length = MAX_ALIAS_SEQUENCE_LENGTH,
    .parse_table = &ts_parse_table[0][0],
    .small_parse_table = ts_small_parse_table,
    .small_parse_table_map = ts_small_parse_table_map,
    .parse_actions = ts_parse_actions,
    .symbol_names = ts_symbol_names,
    .symbol_metadata = ts_symbol_metadata,
    .public_symbol_map = ts_symbol_map,
    .alias_map = ts_non_terminal_alias_map,
    .alias_sequences = &ts_alias_sequences[0][0],
    .lex_modes = ts_lex_modes,
    .lex_fn = ts_lex,
    .primary_state_ids = ts_primary_state_ids,
  };
  return &language;
}
#ifdef __cplusplus
}
#endif
