// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// TfidfVectorizer(stop_words='english', sublinear_tf=True) and cosine_similarity, as sklearn computes them:
//   tokens   : doc.lower(), then every match of (?u)\b\w\w+\b (= maximal runs of 2+ word chars), minus stop words
//   tf       : 1 + ln(count)
//   idf      : ln((n + 1) / (df + 1)) + 1                      (smooth_idf=True)
//   row      : tf * idf, then L2-normalised
// Each row stores its terms in the order sklearn's CSR matrix does (by the term's first appearance in the
// corpus), because that order fixes the floating-point summation order of norms and dot products.

import { ENGLISH_STOP_WORDS } from './stopwords';
import { PY_WORD, compareCodePoints } from './unicode';

const TOKEN = new RegExp(`[${PY_WORD}]{2,}`, 'gu');

export function analyze(doc: string): string[] {
  const out: string[] = [];
  for (const m of doc.toLowerCase().matchAll(TOKEN)) {
    if (!ENGLISH_STOP_WORDS.has(m[0])) out.push(m[0]);
  }
  return out;
}

export interface SparseRow {
  /** feature indices (into the alphabetically sorted vocabulary), in sklearn's storage order */
  idx: Int32Array;
  val: Float64Array;
}

export interface TfidfMatrix {
  vocab: string[];
  idf: Float64Array;
  rows: SparseRow[];
}

/**
 * fit_transform. sklearn raises "empty vocabulary" when every token is a stop word; here that case
 * yields all-zero rows instead (documented in PARITY.md).
 */
export function tfidf(docs: readonly string[]): TfidfMatrix {
  const firstId = new Map<string, number>();
  const counts: Map<number, number>[] = [];
  for (const doc of docs) {
    const c = new Map<number, number>();
    for (const tok of analyze(doc)) {
      let id = firstId.get(tok);
      if (id === undefined) {
        id = firstId.size;
        firstId.set(tok, id);
      }
      c.set(id, (c.get(id) ?? 0) + 1);
    }
    counts.push(c);
  }

  const vocab = [...firstId.keys()].sort(compareCodePoints);
  const feature = new Int32Array(firstId.size); // first-appearance id -> sorted feature index
  vocab.forEach((term, f) => {
    feature[firstId.get(term)!] = f;
  });

  const df = new Float64Array(vocab.length);
  for (const c of counts) for (const id of c.keys()) df[feature[id]!]! += 1;
  const n = docs.length;
  const idf = df.map((d) => Math.log((n + 1) / (d + 1)) + 1);

  const rows = counts.map((c) => {
    const ids = [...c.keys()].sort((a, b) => a - b);
    const idx = new Int32Array(ids.length);
    const val = new Float64Array(ids.length);
    ids.forEach((id, p) => {
      const f = feature[id]!;
      idx[p] = f;
      val[p] = (Math.log(c.get(id)!) + 1) * idf[f]!;
    });
    return { idx, val: l2normalize(val) };
  });
  return { vocab, idf, rows };
}

function l2normalize(val: Float64Array): Float64Array {
  let s = 0;
  for (const v of val) s += v * v;
  s = Math.sqrt(s);
  return s === 0 ? val : val.map((v) => v / s);
}

/** cosine_similarity(X): re-normalises a copy of X, then X @ X.T (dense n x n, row-major). */
export function cosineSimilarity(m: TfidfMatrix): Float64Array {
  const rows = m.rows.map((r) => ({ idx: r.idx, val: l2normalize(Float64Array.from(r.val)) }));
  const n = rows.length;
  const S = new Float64Array(n * n);
  const dense = new Float64Array(m.vocab.length);
  const present = new Uint8Array(m.vocab.length);
  for (let i = 0; i < n; i++) {
    const ri = rows[i]!;
    for (let p = 0; p < ri.idx.length; p++) {
      dense[ri.idx[p]!] = ri.val[p]!;
      present[ri.idx[p]!] = 1;
    }
    for (let k = 0; k < n; k++) {
      // shared terms in storage order (the same relative order in every row)
      const rk = rows[k]!;
      let s = 0;
      for (let p = 0; p < rk.idx.length; p++) {
        const f = rk.idx[p]!;
        if (present[f]) s += dense[f]! * rk.val[p]!;
      }
      S[i * n + k] = s;
    }
    for (let p = 0; p < ri.idx.length; p++) present[ri.idx[p]!] = 0;
  }
  return S;
}

/** cosine_similarity of a fresh TF-IDF fit, with the diagonal set to 0 (the pattern used throughout app.py). */
export function sentenceSimilarity(sents: readonly string[]): Float64Array {
  const S = cosineSimilarity(tfidf(sents));
  const n = sents.length;
  for (let i = 0; i < n; i++) S[i * n + i] = 0;
  return S;
}
