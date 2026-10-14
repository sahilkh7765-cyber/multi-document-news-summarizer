// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Validation of a stored workspace record: good records round-trip, damaged ones are rejected or trimmed.

import { describe, expect, it } from 'vitest';
import { DEMO_CORPUS } from '@/nlp/demo';
import { runPipeline } from '@/nlp/pipeline';
import { parsePersisted, PERSIST_VERSION, type PersistedWorkspace } from '../persist';

const params = { delta: 0.85, tau_dup: 0.2, tau_uniq: 0.2, k: 5 };
const articles = DEMO_CORPUS.slice(0, 2).map((a, i) => ({ ...a, sents: [...a.sents], id: `a${i}`, origin: 'demo' as const }));
const good: PersistedWorkspace = {
  version: PERSIST_VERSION,
  savedAt: 123,
  articles,
  params,
  refs: { E1: 'ref' },
  last: { result: runPipeline(articles, params), params, ms: 3, finishedAt: 456, stale: true },
};
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe('parsePersisted', () => {
  it('round-trips a valid record (as IndexedDB would store it)', () => {
    expect(parsePersisted(clone(good))).toEqual(clone(good));
  });

  it('rejects other versions, bad settings and malformed articles', () => {
    expect(parsePersisted({ ...clone(good), version: 2 })).toBeNull();
    expect(parsePersisted({ ...clone(good), params: { ...params, k: 11 } })).toBeNull();
    expect(parsePersisted({ ...clone(good), params: { ...params, delta: '0.8' } })).toBeNull();
    const bad = clone(good);
    (bad.articles[0] as unknown as { sents: unknown }).sents = [['text', 5]];
    expect(parsePersisted(bad)).toBeNull();
    expect(parsePersisted({ ...clone(good), articles: [{ ...articles[0], origin: 'ftp' }] })).toBeNull();
    expect(parsePersisted(null)).toBeNull();
    expect(parsePersisted('x')).toBeNull();
  });

  it('drops a damaged last run but keeps the desk', () => {
    const v = clone(good) as unknown as { last: { result: { clusters: unknown } } };
    v.last.result.clusters = 'nope';
    const p = parsePersisted(v);
    expect(p?.last).toBeNull();
    expect(p?.articles).toHaveLength(2);
  });

  it('keeps only string reference summaries', () => {
    expect(parsePersisted({ ...clone(good), refs: { E1: 'ok', E2: 5 } })?.refs).toEqual({ E1: 'ok' });
  });
});
