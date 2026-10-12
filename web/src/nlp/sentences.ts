// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Text helpers ported from app.py: toks, split_sentences, parse_header, make_article, unique_sources.

import type { Article } from './types';
import { PY_SPACE, PY_WORD, isPyAlnum, pySplitLines, pySplitWhitespace, pyStrip } from './unicode';

export const MIN_WORDS = 5;

const NON_SPACE = new RegExp(`[^${PY_SPACE}]`, 'gu');

/** toks(t): lowercase each alphanumeric character, turn everything else except whitespace into a space, split. */
export function toks(t: string): string[] {
  // per-character lower() as in Python (no final-sigma context)
  return pySplitWhitespace(t.replace(NON_SPACE, (ch) => (isPyAlnum(ch) ? ch.toLowerCase() : ' ')));
}

// Python's re.IGNORECASE also matches 'i' against U+0130 (simple lowercase is 'i') and U+0131 (re's special
// case table); JS /iu case folding does not, so the 'i' in app.py's patterns is spelled out. (ſ/s and
// Kelvin sign/k already fold the same way in both.)
const I = '[i\\u0130\\u0131]';

const ABBR = new RegExp(
  `(?<![${PY_WORD}])(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|${I}nc|Ltd|Co|Corp|Govt|Gov|Gen|Col|Lt|No|Rs|Nos|approx|U\\.S|U\\.K|e\\.g|${I}\\.e)\\.`,
  'giu',
);
const WS_RUN = new RegExp(`[${PY_SPACE}]+`, 'gu');
const BOUNDARY = new RegExp(
  `(?:(?<=[.!?])|(?<=[.!?]["'\u201d\u2019)\\]]))[${PY_SPACE}]+(?=["'\u201c\u2018(\\[]?[A-Z0-9])`,
  'u',
);

export function splitSentences(text: string): string[] {
  let t = pyStrip(text.replace(WS_RUN, ' '));
  t = t.replace(ABBR, (m) => m.replaceAll('.', '<DOT>'));
  return t
    .split(BOUNDARY)
    .map((p) => pyStrip(p.replaceAll('<DOT>', '.')))
    .filter((p) => toks(p).length >= MIN_WORDS);
}

export interface HeaderMeta {
  source?: string;
  event?: string;
  title?: string;
  [key: string]: string | undefined;
}

const HEADER = new RegExp(`^(source|event|t${I}tle)[${PY_SPACE}]*:[${PY_SPACE}]*(.+)$`, 'iu');

/** Pull optional 'Source:', 'Event:', 'Title:' lines off the top of an article. */
export function parseHeader(text: string): [HeaderMeta, string] {
  const meta: HeaderMeta = {};
  const lines = pySplitLines(text);
  while (lines.length > 0) {
    const line = pyStrip(lines[0]!);
    const m = HEADER.exec(line);
    if (m) {
      meta[m[1]!.toLowerCase()] = pyStrip(m[2]!);
      lines.shift();
    } else if (!line) {
      lines.shift();
    } else {
      break;
    }
  }
  return [meta, lines.join('\n')];
}

export function makeArticle(raw: string, defaultSource: string): Article | null {
  const [meta, body] = parseHeader(raw);
  const sents = splitSentences(body);
  if (sents.length === 0) return null;
  return {
    event: meta.event ?? null,
    source: meta.source || defaultSource,
    title: meta.title ?? '',
    sents: sents.map((s) => [s, null] as const),
  };
}

/**
 * Make source names unique: the n-th article with a name becomes "name (n)", as in app.py.
 * Intentional fix: app.py can still produce duplicates (["A", "A", "A (2)"] -> A, A (2), A (2)); here the
 * number keeps increasing until the name is free. Returns new objects; the input is not mutated.
 */
export function uniqueSources<T extends { source: string }>(items: readonly T[]): T[] {
  const seen = new Map<string, number>();
  const used = new Set<string>();
  return items.map((d) => {
    const count = (seen.get(d.source) ?? 0) + 1;
    seen.set(d.source, count);
    let name = d.source;
    if (count > 1 || used.has(name)) {
      let n = Math.max(count, 2);
      while (used.has(`${d.source} (${n})`)) n++;
      name = `${d.source} (${n})`;
    }
    used.add(name);
    return { ...d, source: name };
  });
}
