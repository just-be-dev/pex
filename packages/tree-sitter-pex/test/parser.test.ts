/**
 * TypeScript tests for PEX parser wrapper
 *
 * Note: These tests require the native module to be built first.
 * Run `npm install` or `node-gyp rebuild` to build the native parser.
 *
 * For now, these tests are skipped until native compilation is set up.
 */

import { describe, test, expect } from 'bun:test';

// Skip these tests for now - they require native module compilation
describe.skip('PEX Parser', () => {
  test.skip('setup native compilation first', () => {
    expect(true).toBe(true);
  });
});

/*
// Uncomment after setting up native module compilation
describe('PEX Parser (requires native build)', () => {
  const { parse, PEXParser } = require('../src/index.ts');
  test('parse simple pipeline', () => {
    const result = parse('$$ | lower | trim');
    expect(result.success).toBe(true);
    expect(result.rootNode.type).toBe('program');
    expect(result.errors.length).toBe(0);
  });

  test('parse function call', () => {
    const result = parse('(+ 1 2)');
    expect(result.success).toBe(true);
    expect(result.rootNode.type).toBe('program');
  });

  test('parse with error', () => {
    const result = parse('(unclosed');
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('find nodes of type', () => {
    const parser = new PEXParser();
    const result = parser.parse('a | b | c');

    const pipelines = parser.findNodesOfType(result.rootNode, 'pipeline');
    expect(pipelines.length).toBeGreaterThan(0);
  });

  test('get node text', () => {
    const parser = new PEXParser();
    const source = '"hello world"';
    const result = parser.parse(source);

    const text = parser.getNodeText(result.rootNode, source);
    expect(text).toBe(source);
  });

  test('parse multiple expressions with semicolons', () => {
    const result = parse('(let: x 42); (print: x)');
    expect(result.success).toBe(true);
    expect(result.rootNode.childCount).toBeGreaterThan(1);
  });

  test('parse effect identifiers', () => {
    const result = parse('(let: x 10)');
    expect(result.success).toBe(true);
  });

  test('parse source variables', () => {
    const parser = new PEXParser();
    const result = parser.parse('$$; $; $0; $1');

    const sourceRefs = parser.findNodesOfType(result.rootNode, 'source_ref');
    expect(sourceRefs.length).toBe(4);
  });

  test('parse regex literals', () => {
    const result = parse('/pattern/gi');
    expect(result.success).toBe(true);

    const parser = new PEXParser();
    const regexNodes = parser.findNodesOfType(result.rootNode, 'regex');
    expect(regexNodes.length).toBe(1);
  });

  test('parse nested lists', () => {
    const result = parse('(+ (* 2 3) 4)');
    expect(result.success).toBe(true);
  });
});
*/
