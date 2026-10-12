// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// The demo corpus at the default settings must reproduce metrics.json (written by NLPCapstone.py).

import { describe, expect, it } from 'vitest';
import { DEMO_CORPUS, DEMO_REFERENCES } from '../demo';
import { runPipeline, SWEEP_THRESHOLDS } from '../pipeline';
import { distinct, rougeL, rougeN } from '../rouge';
import type { ClusterResult } from '../types';
import { readJson } from './fixtures';

interface Metrics {
  cluster_acc: number;
  P: number;
  R: number;
  F: number;
  TP: number;
  FP: number;
  FN: number;
  tot_s: number;
  tot_p: number;
  sweep: [number, number, number, number, number][];
  lead: number[];
  sys: number[];
  outputs: {
    event: string;
    n_src: number;
    n_sent: number;
    pool: number;
    summary_sents: string[];
    keywords: string[];
    exclusive: Record<string, string[]>;
  }[];
}

const metrics = readJson<Metrics>('../metrics.json');
const res = runPipeline(DEMO_CORPUS, { delta: 0.85, tau_dup: 0.2, tau_uniq: 0.2, k: 5 });

function prfScores(tp: number, fp: number, fn: number): [number, number, number] {
  const p = tp + fp ? tp / (tp + fp) : 0;
  const r = tp + fn ? tp / (tp + fn) : 0;
  return [p, r, p + r ? (2 * p * r) / (p + r) : 0];
}

function sum3(rows: readonly (readonly number[])[]): [number, number, number] {
  return rows.reduce<[number, number, number]>((a, r) => [a[0] + r[0]!, a[1] + r[1]!, a[2] + r[2]!], [0, 0, 0]);
}

describe('demo corpus reproduces metrics.json', () => {
  it('clustering accuracy', () => expect(res.cluster_acc).toBe(metrics.cluster_acc));

  it('divergence detection P / R / F and TP / FP / FN', () => {
    const [tp, fp, fn] = sum3(res.clusters.map((c) => c.prf!));
    expect([tp, fp, fn]).toEqual([metrics.TP, metrics.FP, metrics.FN]);
    const [P, R, F] = prfScores(tp, fp, fn);
    expect(Math.abs(P - metrics.P)).toBeLessThan(1e-9);
    expect(Math.abs(R - metrics.R)).toBeLessThan(1e-9);
    expect(Math.abs(F - metrics.F)).toBeLessThan(1e-9);
    expect([P.toFixed(4), R.toFixed(4), F.toFixed(4)]).toEqual(['0.9231', '1.0000', '0.9600']);
  });

  it('redundancy totals', () => {
    expect(res.clusters.reduce((a, c) => a + c.n_sent, 0)).toBe(metrics.tot_s);
    expect(res.clusters.reduce((a, c) => a + c.pool, 0)).toBe(metrics.tot_p);
  });

  it('threshold sweep', () => {
    SWEEP_THRESHOLDS.forEach((t, i) => {
      const det = res.clusters.reduce((a, c) => a + c.sweep[i]![1], 0);
      const [p, r, f] = prfScores(...sum3(res.clusters.map((c) => c.sweep[i]![2]!)));
      const row = metrics.sweep[i]!;
      expect(t).toBe(row[0]);
      expect(det).toBe(row[1]);
      expect(Math.abs(p - row[2])).toBeLessThan(1e-9);
      expect(Math.abs(r - row[3])).toBeLessThan(1e-9);
      expect(Math.abs(f - row[4])).toBeLessThan(1e-9);
    });
  });

  it('per-story outputs (order, sizes, summaries, exclusives, first 5 keywords)', () => {
    expect(res.clusters.map((c) => c.name)).toEqual(metrics.outputs.map((o) => o.event));
    res.clusters.forEach((c, i) => {
      const o = metrics.outputs[i]!;
      expect([c.sources.length, c.n_sent, c.pool]).toEqual([o.n_src, o.n_sent, o.pool]);
      expect(c.summary).toEqual(o.summary_sents);
      expect(Object.entries(c.exclusive)).toEqual(Object.entries(o.exclusive));
      expect(c.keywords.slice(0, 5)).toEqual(o.keywords);
    });
  });

  it('mean ROUGE-1/2/L and Distinct-1/2 for LEAD-2 and the pipeline', () => {
    const systems: [keyof Pick<Metrics, 'lead' | 'sys'>, (c: ClusterResult) => string][] = [
      ['lead', (c) => c.lead],
      ['sys', (c) => c.summary.join(' ')],
    ];
    for (const [key, pick] of systems) {
      const rows = res.clusters.map((c) => {
        const cand = pick(c);
        const ref = DEMO_REFERENCES[c.name]!;
        return [rougeN(cand, ref, 1), rougeN(cand, ref, 2), rougeL(cand, ref), distinct(cand, 1), distinct(cand, 2)];
      });
      const mean = rows[0]!.map((_, j) => rows.reduce((a, r) => a + r[j]!, 0) / rows.length);
      mean.forEach((v, j) => expect(Math.abs(v - metrics[key][j]!)).toBeLessThan(1e-9));
    }
  });
});
