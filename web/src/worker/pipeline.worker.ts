// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Runs the NLP pipeline off the main thread so the UI never freezes.

/// <reference lib="webworker" />
import { runPipeline } from '@/nlp/pipeline';
import type { RunRequest, RunResponse } from './protocol';

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = (e: MessageEvent<RunRequest>) => {
  const { id, articles, params } = e.data;
  const t0 = performance.now();
  let msg: RunResponse;
  try {
    msg = { id, ok: true, result: runPipeline(articles, params), ms: performance.now() - t0 };
  } catch (err) {
    msg = { id, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  self.postMessage(msg);
};
