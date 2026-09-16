import { describe, expect, it } from 'vitest';
import { CortexError } from '../domain/errors.js';
import { extractFirstJsonObject, extractJSON } from './parseScene.js';

describe('extractFirstJsonObject', () => {
  it('returns null when there is no opening brace', () => {
    expect(extractFirstJsonObject('nope')).toBeNull();
    expect(extractFirstJsonObject('')).toBeNull();
  });

  it('returns the first balanced span, ignoring surrounding text', () => {
    expect(extractFirstJsonObject('x{"a":{"b":1}}y')).toBe('{"a":{"b":1}}');
  });

  it('returns null when the braces never balance', () => {
    expect(extractFirstJsonObject('{"a":1')).toBeNull();
  });

  it('does not count braces inside string values', () => {
    expect(extractFirstJsonObject('{"a":"}"}')).toBe('{"a":"}"}');
    expect(extractFirstJsonObject('{"a":"} { not real"}')).toBe('{"a":"} { not real"}');
  });

  it('respects escaped quotes and escaped backslashes', () => {
    expect(extractFirstJsonObject('{"a":"say \\"hi\\" }"}')).toBe('{"a":"say \\"hi\\" }"}');
    expect(extractFirstJsonObject('{"a":"back\\\\"}')).toBe('{"a":"back\\\\"}');
  });

  it('stops at the first top-level object', () => {
    expect(extractFirstJsonObject('{"a":1} {"b":2}')).toBe('{"a":1}');
  });
});

describe('extractJSON', () => {
  it('reads a fenced json block', () => {
    expect(extractJSON('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('reads a fenced block with no language tag', () => {
    expect(extractJSON('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('reads a bare object', () => {
    expect(extractJSON('{"a":1}')).toEqual({ a: 1 });
  });

  it('reads an object wrapped in prose', () => {
    expect(extractJSON('Here you go:\n{"a":1}\nHope that helps.')).toEqual({ a: 1 });
  });

  it('falls back to the raw text when the fenced block holds no object', () => {
    expect(extractJSON('```\nnotjson\n```\n{"a":1}')).toEqual({ a: 1 });
  });

  it('keeps braces that live inside string values', () => {
    expect(extractJSON('{"a":"} { not real"}')).toEqual({ a: '} { not real' });
  });

  it('keeps escaped quotes and backslashes inside strings', () => {
    expect(extractJSON('{"a":"say \\"hi\\" }"}')).toEqual({ a: 'say "hi" }' });
    expect(extractJSON('{"a":"back\\\\"}')).toEqual({ a: 'back\\' });
  });

  it('returns the first balanced object even when a stray empty one precedes it', () => {
    // Documents current behavior: `{}` is balanced and parses, so the scanner
    // never reaches the object the model actually wrote.
    expect(extractJSON('see {} then {"a":1}')).toEqual({});
  });

  it('throws PARSE_FAILURE for empty or non-string input', () => {
    for (const input of ['', '   ', null as unknown as string, undefined as unknown as string, 42 as unknown as string]) {
      expect(() => extractJSON(input)).toThrow(CortexError);
      try {
        extractJSON(input);
      } catch (err) {
        expect((err as CortexError).code).toBe('PARSE_FAILURE');
      }
    }
  });

  it('throws PARSE_FAILURE for garbage and for unrecoverable brace spans', () => {
    // Each of these reaches the widest-brace-span fallback and still fails.
    const bad = [
      'no json at all',
      '{"a":1',
      'Note { this } then {"a":1}',
      'Use {braces like this {"a": 1}',
      '{"a":1,} {"b":2}',
      '{"a": NaN} {"b":2}',
    ];
    for (const input of bad) {
      expect(() => extractJSON(input)).toThrow(CortexError);
      try {
        extractJSON(input);
      } catch (err) {
        expect((err as CortexError).code).toBe('PARSE_FAILURE');
      }
    }
  });
});
