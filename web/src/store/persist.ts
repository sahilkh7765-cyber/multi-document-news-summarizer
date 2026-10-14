// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// What is saved between visits: the articles, settings, reference summaries and the last results.
// parsePersisted validates whatever comes back from storage, so a damaged or older record is dropped
// instead of crashing the app.

import type { Article, Params, PipelineResult, Sentence } from '@/nlp/types';

export const PERSIST_VERSION = 1;

export interface PersistedArticle extends Article {
  id: string;
  origin: 'demo' | 'paste' | 'file' | 'url';
  from?: string;
}

export interface PersistedRun {
  result: PipelineResult;
  params: Params;
  ms: number;
  finishedAt: number;
  /** the articles changed after this run */
  stale: boolean;
}

export interface PersistedWorkspace {
  version: typeof PERSIST_VERSION;
  savedAt: number;
  articles: PersistedArticle[];
  params: Params;
  refs: Record<string, string>;
  last: PersistedRun | null;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const ORIGINS = new Set(['demo', 'paste', 'file', 'url']);

function parseParams(v: unknown): Params | null {
  if (!isObj(v)) return null;
  const { k, delta, tau_dup, tau_uniq } = v;
  if (!isNum(k) || !isNum(delta) || !isNum(tau_dup) || !isNum(tau_uniq)) return null;
  if (k < 2 || k > 10 || delta < 0.5 || delta > 0.99 || tau_dup < 0.05 || tau_dup > 0.6 || tau_uniq < 0.05 || tau_uniq > 0.6) {
    return null;
  }
  return { k, delta, tau_dup, tau_uniq };
}

function parseSentence(v: unknown): Sentence | null {
  if (!Array.isArray(v) || v.length !== 2 || !isStr(v[0]) || !(v[1] === null || isStr(v[1]))) return null;
  return [v[0], v[1]];
}

function parseArticle(v: unknown): PersistedArticle | null {
  if (!isObj(v)) return null;
  const { id, origin, from, event, source, title, sents } = v;
  if (!isStr(id) || !isStr(origin) || !ORIGINS.has(origin) || !isStr(source) || !isStr(title)) return null;
  if (!(event === null || isStr(event)) || !Array.isArray(sents) || sents.length === 0) return null;
  const parsed = sents.map(parseSentence);
  if (parsed.some((s) => s === null)) return null;
  const a: PersistedArticle = {
    id,
    origin: origin as PersistedArticle['origin'],
    event,
    source,
    title,
    sents: parsed as Sentence[],
  };
  if (isStr(from)) a.from = from;
  return a;
}

/** Shallow structural check of a stored result: enough for the views to render without throwing. */
function looksLikeResult(v: unknown): v is PipelineResult {
  if (!isObj(v) || !Array.isArray(v.clusters) || !isNum(v.n_docs) || typeof v.has_facts !== 'boolean') return false;
  if (!(v.cluster_acc === null || isNum(v.cluster_acc))) return false;
  return v.clusters.every(
    (c) =>
      isObj(c) &&
      isStr(c.name) &&
      Array.isArray(c.sources) &&
      Array.isArray(c.summary) &&
      Array.isArray(c.summary_from) &&
      Array.isArray(c.coverage) &&
      isObj(c.exclusive) &&
      Array.isArray(c.sweep) &&
      Array.isArray(c.articles) &&
      Array.isArray(c.keywords) &&
      isStr(c.lead),
  );
}

export function parsePersisted(v: unknown): PersistedWorkspace | null {
  if (!isObj(v) || v.version !== PERSIST_VERSION || !Array.isArray(v.articles)) return null;
  const params = parseParams(v.params);
  if (!params) return null;
  const articles = v.articles.map(parseArticle);
  if (articles.some((a) => a === null)) return null;
  const refs: Record<string, string> = {};
  if (isObj(v.refs)) for (const [k, t] of Object.entries(v.refs)) if (isStr(t)) refs[k] = t;
  let last: PersistedRun | null = null;
  if (isObj(v.last)) {
    const p = parseParams(v.last.params);
    if (p && looksLikeResult(v.last.result) && isNum(v.last.ms) && isNum(v.last.finishedAt)) {
      last = { result: v.last.result, params: p, ms: v.last.ms, finishedAt: v.last.finishedAt, stale: v.last.stale === true };
    }
  }
  return {
    version: PERSIST_VERSION,
    savedAt: isNum(v.savedAt) ? v.savedAt : 0,
    articles: articles as PersistedArticle[],
    params,
    refs,
    last,
  };
}

// ---- IndexedDB (one object store, one record)
const DB_NAME = 'cross-source-desk';
const STORE = 'workspace';
const KEY = 'current';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not open IndexedDB'));
    req.onblocked = () => reject(new Error('IndexedDB is blocked by another tab'));
  });
}

function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => {
          db.close();
          resolve(req.result);
        };
        tx.onerror = tx.onabort = () => {
          db.close();
          reject(tx.error ?? new Error('IndexedDB transaction failed'));
        };
      }),
  );
}

export async function loadWorkspace(): Promise<{ data: PersistedWorkspace | null; discarded: boolean }> {
  const raw = await withStore<unknown>('readonly', (s) => s.get(KEY));
  if (raw === undefined) return { data: null, discarded: false };
  const data = parsePersisted(raw);
  return { data, discarded: data === null };
}

export async function saveWorkspace(data: PersistedWorkspace): Promise<void> {
  await withStore('readwrite', (s) => s.put(data, KEY));
}
