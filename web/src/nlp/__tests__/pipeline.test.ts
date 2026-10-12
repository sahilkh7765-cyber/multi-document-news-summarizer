// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Parity of the full pipeline with app.py's run_pipeline on every fixture run (corpora x parameter sets).
// Discrete outputs must be identical; scores must agree within 1e-9. Outputs that depend on numpy's
// unstable argsort tie-breaking are checked against the set of equally valid candidates instead.

import { describe, expect, it } from 'vitest';
import { runPipeline } from '../pipeline';
import { distinct, rougeL, rougeN } from '../rouge';
import { cosineSimilarity, tfidf } from '../tfidf';
import { readJson, runs, type EvalRow } from './fixtures';

const TOL = 1e-9;
const fixture = runs();

function partition(labels: readonly number[]): string[] {
  const groups = new Map<number, number[]>();
  labels.forEach((l, i) => groups.set(l, [...(groups.get(l) ?? []), i]));
  return [...groups.values()].map((g) => g.join(',')).sort();
}

describe.each(fixture.runs.map((r) => [`${r.corpus} ${JSON.stringify(r.params)}`, r] as const))('%s', (_, run) => {
  const res = runPipeline(run.articles, run.params);
  const py = run.result;

  it('clusters: same partition, same label order and names', () => {
    const tsLabels = new Array<number>(run.articles.length).fill(-1);
    res.clusters.forEach((c, ci) => {
      for (const s of c.sources) tsLabels[run.articles.findIndex((a) => a.source === s)] = ci;
    });
    expect(partition(tsLabels)).toEqual(partition(run.instrument.labels));
    expect(res.clusters.map((c) => [c.name, c.sources])).toEqual(py.clusters.map((c) => [c.name, c.sources]));
  });

  it('top-level fields', () => {
    expect(res.n_docs).toBe(py.n_docs);
    expect(res.has_facts).toBe(py.has_facts);
    if (py.cluster_acc === null) expect(res.cluster_acc).toBeNull();
    else expect(Math.abs(res.cluster_acc! - py.cluster_acc)).toBeLessThan(TOL);
  });

  py.clusters.forEach((pc, ci) => {
    const inst = run.instrument.clusters[ci]!;

    it(`cluster ${pc.name}: pool, summary, exclusives, coverage, sweep, PRF, lead`, () => {
      const tc = res.clusters[ci]!;
      expect(tc.n_sent).toBe(pc.n_sent);
      expect(tc.pool).toBe(pc.pool);
      expect(tc.summary).toEqual(pc.summary);
      expect(tc.summary_from).toEqual(pc.summary_from);
      expect(tc.coverage).toEqual(pc.coverage);
      expect(Object.entries(tc.exclusive)).toEqual(Object.entries(pc.exclusive));
      expect(tc.detected).toBe(pc.detected);
      expect(tc.prf).toEqual(pc.prf);
      expect(tc.sweep).toEqual(pc.sweep);
      expect(tc.lead).toBe(pc.lead);
    });

    it(`cluster ${pc.name}: keywords${inst.keywords.tie_dependent ? ' (tie-dependent)' : ''}`, () => {
      const kw = res.clusters[ci]!.keywords;
      if (!inst.keywords.tie_dependent) {
        expect(kw).toEqual(pc.keywords);
        return;
      }
      expect(kw.length).toBe(pc.keywords.length);
      expect(new Set(kw).size).toBe(kw.length);
      kw.forEach((w, i) => expect(inst.keywords.candidates[i]).toContain(w));
    });

    it(`cluster ${pc.name}: per-article summaries`, () => {
      const tc = res.clusters[ci]!;
      expect(tc.articles.map((a) => [a.source, a.title, a.n_sent])).toEqual(
        pc.articles.map((a) => [a.source, a.title, a.n_sent]),
      );
      pc.articles.forEach((pa, ai) => {
        const ta = tc.articles[ai]!;
        const tie = inst.articles[ai]!;
        if (!tie.tie_dependent) {
          expect(ta.summary).toEqual(pa.summary);
          return;
        }
        const sents = run.articles[inst.members[ai]!]!.sents.map(([s]) => s);
        const picked = ta.summary.map((s) => sents.indexOf(s));
        for (const r of tie.required) expect(picked).toContain(r);
        const extra = picked.filter((i) => !tie.required.includes(i));
        expect(extra.length).toBe(tie.need_from_tied);
        for (const i of extra) expect(tie.tied).toContain(i);
      });
    });
  });

  it('evaluation scores (ROUGE vs reference, Distinct) within 1e-9', () => {
    run.eval.forEach((ev, ci) => {
      const c = res.clusters[ci]!;
      const cands: [string, EvalRow][] = [
        [c.lead, ev.lead],
        [c.summary.join(' '), ev.pipeline],
      ];
      for (const [cand, row] of cands) {
        if (ev.reference.trim()) {
          expect(Math.abs(rougeN(cand, ev.reference, 1) - row.rouge1!)).toBeLessThan(TOL);
          expect(Math.abs(rougeN(cand, ev.reference, 2) - row.rouge2!)).toBeLessThan(TOL);
          expect(Math.abs(rougeL(cand, ev.reference) - row.rougeL!)).toBeLessThan(TOL);
        }
        expect(Math.abs(distinct(cand, 1) - row.distinct1)).toBeLessThan(TOL);
        expect(Math.abs(distinct(cand, 2) - row.distinct2)).toBeLessThan(TOL);
      }
    });
  });
});

interface TfidfFixture {
  docs: string[];
  vocab: string[];
  idf: number[];
  rows: [number, number][][];
  distance: number[][];
}

describe('TF-IDF internals on the demo corpus', () => {
  const fx = readJson<TfidfFixture>('fixtures/tfidf_demo.json');
  const m = tfidf(fx.docs);

  it('vocabulary (code-point order) and idf', () => {
    expect(m.vocab).toEqual(fx.vocab);
    const maxDiff = Math.max(...fx.idf.map((v, i) => Math.abs(v - m.idf[i]!)));
    console.log('idf max |diff|:', maxDiff);
    expect(maxDiff).toBeLessThan(1e-12);
  });

  it("rows: sklearn's storage order and values", () => {
    let maxDiff = 0;
    fx.rows.forEach((row, i) => {
      expect([...m.rows[i]!.idx]).toEqual(row.map(([j]) => j));
      row.forEach(([, v], p) => (maxDiff = Math.max(maxDiff, Math.abs(v - m.rows[i]!.val[p]!))));
    });
    console.log('tf-idf value max |diff|:', maxDiff);
    expect(maxDiff).toBeLessThan(1e-12);
  });

  it('document distance matrix', () => {
    const n = fx.docs.length;
    const S = cosineSimilarity(m);
    let maxDiff = 0;
    fx.distance.forEach((row, i) =>
      row.forEach((d, j) => {
        const t = i === j ? 0 : Math.max(0, 1 - S[i * n + j]!);
        maxDiff = Math.max(maxDiff, Math.abs(d - t));
      }),
    );
    console.log('distance max |diff|:', maxDiff);
    expect(maxDiff).toBeLessThan(1e-12);
  });
});
