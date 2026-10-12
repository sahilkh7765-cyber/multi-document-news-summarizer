// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// ROUGE-N F1, ROUGE-L F1 and Distinct-n, ported from app.py (all built on toks()).

import { toks } from './sentences';

// tokens never contain U+0000 (toks turns it into a space), so it is a safe n-gram key separator
const SEP = '\u0000';

export function ngrams(t: string, n: number): string[] {
  const w = toks(t);
  const out: string[] = [];
  for (let i = 0; i < w.length - n + 1; i++) out.push(w.slice(i, i + n).join(SEP));
  return out;
}

function countOf(grams: readonly string[]): Map<string, number> {
  const c = new Map<string, number>();
  for (const g of grams) c.set(g, (c.get(g) ?? 0) + 1);
  return c;
}

/** ROUGE-N F1 (app.py's rouge_n). */
export function rougeN(cand: string, ref: string, n: number): number {
  const c = ngrams(cand, n);
  const r = ngrams(ref, n);
  if (r.length === 0 || c.length === 0) return 0;
  const cc = countOf(c);
  const rc = countOf(r);
  let ov = 0;
  for (const [g, k] of cc) ov += Math.min(k, rc.get(g) ?? 0);
  const p = ov / c.length;
  const rr = ov / r.length;
  return p + rr === 0 ? 0 : (2 * p * rr) / (p + rr);
}

/** ROUGE-L F1 via longest common subsequence. */
export function rougeL(cand: string, ref: string): number {
  const a = toks(cand);
  const b = toks(ref);
  if (a.length === 0 || b.length === 0) return 0;
  let prev = new Int32Array(b.length + 1);
  let cur = new Int32Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1]! + 1 : Math.max(prev[j]!, cur[j - 1]!);
    }
    [prev, cur] = [cur, prev];
  }
  const l = prev[b.length]!;
  const p = l / a.length;
  const r = l / b.length;
  return p + r === 0 ? 0 : (2 * p * r) / (p + r);
}

export function distinct(text: string, n: number): number {
  const g = ngrams(text, n);
  return g.length === 0 ? 0 : new Set(g).size / g.length;
}
