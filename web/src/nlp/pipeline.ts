// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// run_pipeline from app.py:
//   1. cluster whole articles (TF-IDF, cosine distance, average linkage cut at delta)
//   2. redundancy reduction: keep a sentence if its max similarity to the pool is < tau_dup
//   3. consensus summary: the k most central pool sentences, in original order
//   4. divergence detection: a sentence is source-exclusive if its max similarity to every other source is < tau_uniq
// plus keywords, coverage, per-article summaries, LEAD-2 and the tau_uniq sweep.
//
// Where app.py relies on np.argsort (keywords, centrality_pick), ties are broken deterministically with the
// order np.argsort(kind='stable') would give. numpy's default argsort is not stable, so Python may pick a
// different member of a tied group; see PARITY.md.

import { agglomerative } from './cluster';
import { cosineSimilarity, sentenceSimilarity, tfidf } from './tfidf';
import type { Article, ClusterResult, Params, PipelineResult, Prf, SweepRow } from './types';

export const SWEEP_THRESHOLDS = [0.1, 0.15, 0.2, 0.25, 0.3, 0.4] as const;
export const N_KEYWORDS = 6;

/** Indices of the k most central sentences, in original order (app.py's centrality_pick). */
export function centralityPick(sents: readonly string[], k: number, S?: Float64Array): number[] {
  const n = sents.length;
  if (n <= k) return sents.map((_, i) => i);
  const sim = S ?? sentenceSimilarity(sents);
  const cen = new Float64Array(n);
  const denom = Math.max(n - 1, 1);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) s += sim[i * n + j]!;
    cen[i] = s / denom;
  }
  // np.argsort(-cen) with stable ties: higher centrality first, then lower index
  const order = sents.map((_, i) => i).sort((a, b) => cen[b]! - cen[a]! || a - b);
  return order.slice(0, k).sort((a, b) => a - b);
}

function prfOf(pred: readonly number[], gold: readonly number[] | null): Prf | null {
  if (gold === null) return null;
  let tp = 0;
  let fp = 0;
  let fn = 0;
  pred.forEach((p, i) => {
    const g = gold[i]!;
    if (p && g) tp++;
    else if (p && !g) fp++;
    else if (!p && g) fn++;
  });
  return [tp, fp, fn];
}

export function runPipeline(corpus: readonly Article[], params: Params): PipelineResult {
  const { delta, tau_dup: tauDup, tau_uniq: tauUniq, k } = params;
  const docs = corpus.map((d) => d.sents.map(([s]) => s).join(' '));
  const dv = tfidf(docs);
  const nDocs = docs.length;

  // stage 1 : clustering
  let labels: number[];
  if (nDocs === 1) {
    labels = [0];
  } else {
    const D = cosineSimilarity(dv);
    for (let i = 0; i < D.length; i++) D[i] = 1 - D[i]!;
    for (let i = 0; i < nDocs; i++) D[i * nDocs + i] = 0;
    for (let i = 0; i < D.length; i++) if (D[i]! < 0) D[i] = 0;
    labels = agglomerative(D, nDocs, delta);
  }
  const clusters = [...new Set(labels)].sort((a, b) => a - b);

  const hasEvent = corpus.every((d) => Boolean(d.event));
  const hasFacts = corpus.every((d) => d.sents.every(([, f]) => f !== null));
  let clusterAcc: number | null = null;
  if (hasEvent && nDocs > 1) {
    let ok = 0;
    let tot = 0;
    for (let i = 0; i < nDocs; i++) {
      for (let j = i + 1; j < nDocs; j++) {
        tot++;
        if ((labels[i] === labels[j]) === (corpus[i]!.event === corpus[j]!.event)) ok++;
      }
    }
    clusterAcc = ok / tot;
  }

  const out: ClusterResult[] = clusters.map((cl, n) => {
    const members = labels.flatMap((l, i) => (l === cl ? [i] : []));
    const evs = new Set(members.map((i) => corpus[i]!.event));
    const name = hasEvent && evs.size === 1 ? [...evs][0]! : `Story ${n + 1}`;

    // keywords: top centroid terms; centroid = sum over members of row * (1/m), as scipy's mean does
    const centroid = new Float64Array(dv.vocab.length);
    const scale = 1 / members.length;
    for (const m of members) {
      const r = dv.rows[m]!;
      for (let p = 0; p < r.idx.length; p++) centroid[r.idx[p]!]! += r.val[p]! * scale;
    }
    // argsort()[::-1] with stable ties: higher weight first, then higher feature index
    const keywords = dv.vocab
      .map((_, f) => f)
      .sort((a, b) => centroid[b]! - centroid[a]! || b - a)
      .slice(0, N_KEYWORDS)
      .map((f) => dv.vocab[f]!);

    const sents: string[] = [];
    const srcs: string[] = [];
    const facts: (string | null)[] = [];
    for (const m of members) {
      for (const [s, f] of corpus[m]!.sents) {
        sents.push(s);
        srcs.push(corpus[m]!.source);
        facts.push(f);
      }
    }
    const ns = sents.length;
    const S = sentenceSimilarity(sents);
    const sim = (i: number, j: number): number => S[i * ns + j]!;

    // stage 2 : redundancy reduction
    const pool: number[] = [];
    for (let i = 0; i < ns; i++) {
      if (pool.length === 0 || Math.max(...pool.map((p) => sim(i, p))) < tauDup) pool.push(i);
    }

    // stage 3 : consensus summary (Python's sorted() is stable)
    let top: number[];
    if (pool.length === 1) {
      top = pool;
    } else {
      const cen = new Map<number, number>();
      for (const i of pool) {
        let s = 0;
        let c = 0;
        for (const j of pool) {
          if (j !== i) {
            s += sim(i, j);
            c++;
          }
        }
        cen.set(i, s / c);
      }
      top = [...pool]
        .sort((a, b) => cen.get(b)! - cen.get(a)! || a - b)
        .slice(0, k)
        .sort((a, b) => a - b);
    }

    // stage 4 : divergence detection
    const maxOther: (number | null)[] = sents.map((_, i) => {
      let m: number | null = null;
      for (let j = 0; j < ns; j++) {
        if (srcs[j] !== srcs[i]) m = m === null ? sim(i, j) : Math.max(m, sim(i, j));
      }
      return m;
    });
    const detect = (t: number): number[] => maxOther.map((m) => (m !== null && m < t ? 1 : 0));
    const pred = detect(tauUniq);
    const exclusive: Record<string, string[]> = {};
    pred.forEach((p, i) => {
      if (p) (exclusive[srcs[i]!] ??= []).push(sents[i]!);
    });

    let gold: number[] | null = null;
    if (hasFacts) {
      const factSrc = new Map<string | null, Set<string>>();
      facts.forEach((f, i) => {
        if (!factSrc.has(f)) factSrc.set(f, new Set());
        factSrc.get(f)!.add(srcs[i]!);
      });
      gold = facts.map((f) => (factSrc.get(f)!.size === 1 ? 1 : 0));
    }

    const sweep: SweepRow[] = SWEEP_THRESHOLDS.map((t) => {
      const p = detect(t);
      return [t, p.reduce((a, b) => a + b, 0), prfOf(p, gold)] as const;
    });

    // coverage : which source reports each summary sentence
    const sourceList = members.map((m) => corpus[m]!.source);
    const coverage = top.map((i) => {
      const row: Record<string, boolean> = {};
      for (const s of sourceList) {
        if (s === srcs[i]) {
          row[s] = true;
        } else {
          let best: number | null = null;
          for (let j = 0; j < ns; j++) {
            if (srcs[j] === s) best = best === null ? sim(i, j) : Math.max(best, sim(i, j));
          }
          row[s] = best !== null && best >= tauUniq;
        }
      }
      return row;
    });

    const articles = members.map((m) => {
      const a = corpus[m]!;
      const aSents = a.sents.map(([s]) => s);
      return {
        source: a.source,
        title: a.title ?? '',
        n_sent: aSents.length,
        summary: centralityPick(aSents, Math.min(3, k)).map((i) => aSents[i]!),
      };
    });

    const lead = members.flatMap((m) => corpus[m]!.sents.slice(0, 2).map(([s]) => s));

    return {
      name,
      keywords,
      sources: sourceList,
      n_sent: ns,
      pool: pool.length,
      summary: top.map((i) => sents[i]!),
      summary_from: top.map((i) => srcs[i]!),
      coverage,
      exclusive,
      detected: pred.reduce((a, b) => a + b, 0),
      prf: prfOf(pred, gold),
      sweep,
      articles,
      lead: lead.slice(0, k).join(' '),
    };
  });

  return { clusters: out, cluster_acc: clusterAcc, has_facts: hasFacts, n_docs: nDocs };
}
