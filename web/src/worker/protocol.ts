// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Messages between the UI thread and the pipeline worker.

import type { Article, Params, PipelineResult } from '@/nlp/types';

export interface RunRequest {
  id: number;
  articles: Article[];
  params: Params;
}

export type RunResponse =
  | { id: number; ok: true; result: PipelineResult; ms: number }
  | { id: number; ok: false; error: string };
