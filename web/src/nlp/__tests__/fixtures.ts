// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Loads the golden JSON written by tools/export_fixtures.py.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Article, Params, PipelineResult } from '../types';

const root = fileURLToPath(new URL('../../../', import.meta.url));

export function readJson<T>(rel: string): T {
  return JSON.parse(readFileSync(root + rel, 'utf-8')) as T;
}

export interface ArticleTie {
  required: number[];
  tied: number[];
  need_from_tied: number;
  tie_dependent: boolean;
}

export interface ClusterInstrument {
  members: number[];
  keywords: { candidates: string[][]; tie_dependent: boolean };
  consensus_boundary_tie: boolean;
  articles: ArticleTie[];
}

export interface EvalRow {
  rouge1?: number;
  rouge2?: number;
  rougeL?: number;
  distinct1: number;
  distinct2: number;
}

export interface Run {
  corpus: string;
  params: Params;
  articles: Article[];
  result: PipelineResult;
  eval: { name: string; reference: string; lead: EvalRow; pipeline: EvalRow }[];
  instrument: { labels: number[]; clusters: ClusterInstrument[]; gaps: Record<string, number> };
}

export interface RunsFixture {
  env: Record<string, string>;
  runs: Run[];
  raw_texts: Record<string, [string, string][]>;
}

export const runs = (): RunsFixture => readJson<RunsFixture>('fixtures/pipeline_runs.json');
