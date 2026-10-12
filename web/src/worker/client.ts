// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Promise wrapper around the pipeline worker. One worker is created lazily and reused.

import type { Article, Params, PipelineResult } from '@/nlp/types';
import type { RunRequest, RunResponse } from './protocol';

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (r: { result: PipelineResult; ms: number }) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./pipeline.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<RunResponse>) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if (e.data.ok) p.resolve({ result: e.data.result, ms: e.data.ms });
    else p.reject(new Error(e.data.error));
  };
  worker.onerror = (e) => {
    const err = new Error(e.message || 'The summarizer stopped unexpectedly.');
    for (const p of pending.values()) p.reject(err);
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

export function runInWorker(articles: Article[], params: Params): Promise<{ result: PipelineResult; ms: number }> {
  const id = nextId++;
  const req: RunRequest = { id, articles, params };
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage(req);
  });
}
