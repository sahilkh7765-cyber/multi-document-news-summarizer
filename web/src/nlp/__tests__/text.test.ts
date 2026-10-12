// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Parity of the text helpers with app.py: Unicode classes, toks, split_sentences, parse_header,
// make_article, unique_sources, ROUGE and Distinct.

import { describe, expect, it } from 'vitest';
import { distinct, rougeL, rougeN } from '../rouge';
import { makeArticle, parseHeader, splitSentences, toks, uniqueSources } from '../sentences';
import { ENGLISH_STOP_WORDS } from '../stopwords';
import { isPyAlnum, isPySpace, isPyWord } from '../unicode';
import { readJson } from './fixtures';

interface TextCases {
  split: { text: string; out: string[] }[];
  header: { text: string; meta: Record<string, string>; body: string }[];
  toks: { text: string; out: string[] }[];
  rouge: { cand: string; ref: string; r1: number; r2: number; rl: number; d1: number; d2: number }[];
  unique_sources: { names: string[]; collides: boolean; out: string[] }[];
  make_article: { name: string; raw: string; out: unknown }[];
}
const cases = readJson<TextCases>('fixtures/text_cases.json');

describe('unicode classes (sampled code-point table)', () => {
  const table = readJson<{ unidata_version: string; rows: [number, boolean, boolean, boolean, string, string][] }>(
    'fixtures/unicode_table.json',
  );
  // Code points unassigned (Cn) in Python's Unicode database may be assigned in the JS engine's newer one.
  const assigned = table.rows.filter((r) => r[5] !== 'Cn');
  it(`matches Python (unicodedata ${table.unidata_version}) on ${assigned.length} assigned code points`, () => {
    const bad: string[] = [];
    for (const [cp, alnum, space, word, lower] of assigned) {
      const ch = String.fromCodePoint(cp);
      const got = [isPyAlnum(ch), isPySpace(ch), isPyWord(ch), ch.toLowerCase()];
      if (got[0] !== alnum || got[1] !== space || got[2] !== word || got[3] !== lower) {
        bad.push(`U+${cp.toString(16).padStart(4, '0')} py=${JSON.stringify([alnum, space, word, lower])} js=${JSON.stringify(got)}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('stop words', () => {
  it("equals sklearn's ENGLISH_STOP_WORDS", () => {
    expect([...ENGLISH_STOP_WORDS].sort()).toEqual(readJson<string[]>('fixtures/stop_words.json'));
  });
});

describe('toks', () => {
  it.each(cases.toks.map((c, i) => [i, c] as const))('case %i', (_, c) => {
    expect(toks(c.text)).toEqual(c.out);
  });
});

describe('split_sentences', () => {
  it.each(cases.split.map((c, i) => [i, c] as const))('case %i', (_, c) => {
    expect(splitSentences(c.text)).toEqual(c.out);
  });
});

describe('parse_header', () => {
  it.each(cases.header.map((c, i) => [i, c] as const))('case %i', (_, c) => {
    const [meta, body] = parseHeader(c.text);
    expect({ ...meta }).toEqual(c.meta);
    expect(body).toBe(c.body);
  });
});

describe('make_article', () => {
  it.each(cases.make_article.map((c) => [c.name, c] as const))('%s', (_, c) => {
    expect(JSON.parse(JSON.stringify(makeArticle(c.raw, c.name.replace(/\.[^.]*$/, ''))))).toEqual(c.out);
  });
});

describe('unique_sources', () => {
  for (const c of cases.unique_sources) {
    const got = uniqueSources(c.names.map((source) => ({ source }))).map((d) => d.source);
    if (c.collides) {
      it(`fixes app.py's collision for ${JSON.stringify(c.names)} (python: ${JSON.stringify(c.out)})`, () => {
        expect(new Set(got).size).toBe(got.length);
      });
    } else {
      it(`matches app.py for ${JSON.stringify(c.names)}`, () => expect(got).toEqual(c.out));
    }
  }
});

describe('ROUGE and Distinct', () => {
  it.each(cases.rouge.map((c, i) => [i, c] as const))('case %i', (_, c) => {
    expect(Math.abs(rougeN(c.cand, c.ref, 1) - c.r1)).toBeLessThan(1e-9);
    expect(Math.abs(rougeN(c.cand, c.ref, 2) - c.r2)).toBeLessThan(1e-9);
    expect(Math.abs(rougeL(c.cand, c.ref) - c.rl)).toBeLessThan(1e-9);
    expect(Math.abs(distinct(c.cand, 1) - c.d1)).toBeLessThan(1e-9);
    expect(Math.abs(distinct(c.cand, 2) - c.d2)).toBeLessThan(1e-9);
  });
});
