// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Precision / recall / F1 and the run-level totals app.py shows under the results.

import type { PipelineResult, Prf } from './types';

export interface Scores {
  precision: number;
  recall: number;
  f1: number;
}

/** The P/R/F formulas from app.py (0 when undefined). */
export function prfScores([tp, fp, fn]: Prf): Scores {
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  return { precision, recall, f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0 };
}

export function sumPrf(rows: readonly (Prf | null)[]): Prf | null {
  if (rows.some((r) => r === null)) return null;
  return rows.reduce<Prf>((a, r) => [a[0] + r![0], a[1] + r![1], a[2] + r![2]], [0, 0, 0]);
}

export interface RunTotals {
  sentences: number;
  pooled: number;
  /** share of sentences removed as duplicates, 0..1 */
  redundancy: number;
  exclusive: number;
  /** summed over stories; null without fact ids */
  prf: Prf | null;
}

export function runTotals(res: PipelineResult): RunTotals {
  const sentences = res.clusters.reduce((a, c) => a + c.n_sent, 0);
  const pooled = res.clusters.reduce((a, c) => a + c.pool, 0);
  return {
    sentences,
    pooled,
    redundancy: sentences ? 1 - pooled / sentences : 0,
    exclusive: res.clusters.reduce((a, c) => a + c.detected, 0),
    prf: res.has_facts ? sumPrf(res.clusters.map((c) => c.prf)) : null,
  };
}

export const fmt4 = (x: number): string => x.toFixed(4);
