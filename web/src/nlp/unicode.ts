// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Python string semantics the pipeline depends on, expressed with Unicode-aware JS regexes.
//   str.isspace() / re \s  -> PY_SPACE (differs from JS \s: adds \x1c-\x1f and \x85, drops \ufeff)
//   str.isalnum()          -> \p{L} or \p{N}
//   re \w (str patterns)   -> \p{L}, \p{N} or '_'
// Checked against a sampled code-point table exported from Python (fixtures/unicode_table.json).

/** Character-class body for Python's whitespace (use inside [...]). */
export const PY_SPACE = '\\t\\n\\v\\f\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';
/** Character-class body for Python's \w (use inside [...]). */
export const PY_WORD = '\\p{L}\\p{N}_';

const SPACE_ONE = new RegExp(`^[${PY_SPACE}]$`, 'u');
const ALNUM_ONE = /^[\p{L}\p{N}]$/u;
const WORD_ONE = new RegExp(`^[${PY_WORD}]$`, 'u');
const SPACE_RUN = new RegExp(`[${PY_SPACE}]+`, 'u');
const LEADING = new RegExp(`^[${PY_SPACE}]+`, 'u');
const TRAILING = new RegExp(`[${PY_SPACE}]+$`, 'u');
const LINE_BREAK = /\r\n|[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]/;

export const isPySpace = (ch: string): boolean => SPACE_ONE.test(ch);
export const isPyAlnum = (ch: string): boolean => ALNUM_ONE.test(ch);
export const isPyWord = (ch: string): boolean => WORD_ONE.test(ch);

/** str.strip() */
export function pyStrip(s: string): string {
  return s.replace(LEADING, '').replace(TRAILING, '');
}

/** str.split() with no arguments. */
export function pySplitWhitespace(s: string): string[] {
  return s.split(SPACE_RUN).filter((p) => p !== '');
}

/** str.splitlines() */
export function pySplitLines(s: string): string[] {
  if (s === '') return [];
  const parts = s.split(LINE_BREAK);
  // a trailing line break does not produce a final empty line
  if (parts.length > 1 && parts[parts.length - 1] === '') parts.pop();
  return parts;
}

/** Compare strings by Unicode code point, like Python's str ordering (JS < compares UTF-16 units). */
export function compareCodePoints(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a.codePointAt(i)!;
    const y = b.codePointAt(i)!;
    if (x !== y) return x - y;
    if (x > 0xffff) i++;
  }
  return a.length - b.length;
}
