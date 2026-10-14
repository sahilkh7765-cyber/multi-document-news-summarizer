// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Workspace state: the articles on the desk, the settings, the last run and the reference summaries.
// A plain reducer behind a context; the pipeline itself runs in the worker (src/worker).

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { DEMO_CORPUS, DEMO_REFERENCES } from '@/nlp/demo';
import { uniqueSources } from '@/nlp/sentences';
import type { Article, Params, PipelineResult } from '@/nlp/types';
import { loadWorkspace, PERSIST_VERSION, saveWorkspace, type PersistedRun } from '@/store/persist';
import { runInWorker } from '@/worker/client';

export type Origin = 'demo' | 'paste' | 'file' | 'url';

export interface WorkspaceArticle extends Article {
  id: string;
  origin: Origin;
  /** file name or URL the article came from */
  from?: string;
}

export const DEFAULT_PARAMS: Params = { delta: 0.85, tau_dup: 0.2, tau_uniq: 0.2, k: 5 };

export interface LastRun {
  result: PipelineResult;
  params: Params;
  /** workspace revision the run was made from */
  revision: number;
  ms: number;
  finishedAt: number;
}

export interface WorkspaceState {
  articles: WorkspaceArticle[];
  params: Params;
  /** bumped on every change to the article list */
  revision: number;
  running: boolean;
  runError: string | null;
  last: LastRun | null;
  /** reference summaries keyed by story name */
  refs: Record<string, string>;
}

type Action =
  | { type: 'add'; articles: WorkspaceArticle[] }
  | { type: 'update'; id: string; patch: Partial<Article> }
  | { type: 'remove'; id: string }
  | { type: 'clear' }
  | { type: 'loadDemo' }
  | { type: 'setParams'; params: Partial<Params> }
  | { type: 'runStart' }
  | { type: 'runDone'; result: PipelineResult; params: Params; revision: number; ms: number }
  | { type: 'runFail'; error: string }
  | { type: 'setRef'; name: string; text: string }
  | { type: 'hydrate'; state: Pick<WorkspaceState, 'articles' | 'params' | 'refs'> & { last: PersistedRun | null } };

let idCounter = 0;
export function newId(): string {
  idCounter += 1;
  return `${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function demoArticles(): WorkspaceArticle[] {
  return DEMO_CORPUS.map((d) => ({ ...d, sents: [...d.sents], title: '', id: newId(), origin: 'demo' as const }));
}

export const initialState: WorkspaceState = {
  articles: [],
  params: DEFAULT_PARAMS,
  revision: 0,
  running: false,
  runError: null,
  last: null,
  refs: {},
};

function reducer(state: WorkspaceState, action: Action): WorkspaceState {
  switch (action.type) {
    case 'add':
      return { ...state, articles: [...state.articles, ...action.articles], revision: state.revision + 1 };
    case 'update':
      return {
        ...state,
        articles: state.articles.map((a) => (a.id === action.id ? { ...a, ...action.patch } : a)),
        revision: state.revision + 1,
      };
    case 'remove':
      return { ...state, articles: state.articles.filter((a) => a.id !== action.id), revision: state.revision + 1 };
    case 'clear':
      return { ...state, articles: [], revision: state.revision + 1, last: null, refs: {}, runError: null };
    case 'loadDemo':
      return { ...state, articles: demoArticles(), revision: state.revision + 1, last: null, refs: {}, runError: null };
    case 'setParams':
      return { ...state, params: { ...state.params, ...action.params } };
    case 'runStart':
      return { ...state, running: true, runError: null };
    case 'runDone': {
      // demo mode: prefill the reference summaries, as app.py does
      let refs = state.refs;
      if (state.articles.length > 0 && state.articles.every((a) => a.event !== null && a.event in DEMO_REFERENCES)) {
        refs = Object.fromEntries(action.result.clusters.map((c) => [c.name, DEMO_REFERENCES[c.name] ?? '']));
      }
      return {
        ...state,
        running: false,
        refs,
        last: { result: action.result, params: action.params, revision: action.revision, ms: action.ms, finishedAt: Date.now() },
      };
    }
    case 'runFail':
      return { ...state, running: false, runError: action.error };
    case 'setRef':
      return { ...state, refs: { ...state.refs, [action.name]: action.text } };
    case 'hydrate': {
      const revision = state.revision + 1;
      const p = action.state.last;
      return {
        ...state,
        articles: action.state.articles,
        params: action.state.params,
        refs: action.state.refs,
        revision,
        // a run saved as stale keeps its "articles changed" hint
        last: p ? { result: p.result, params: p.params, ms: p.ms, finishedAt: p.finishedAt, revision: p.stale ? -1 : revision } : null,
      };
    }
  }
}

export const sameParams = (a: Params, b: Params): boolean =>
  a.k === b.k && a.delta === b.delta && a.tau_dup === b.tau_dup && a.tau_uniq === b.tau_uniq;

export type StorageStatus =
  | { kind: 'loading' }
  | { kind: 'saved'; at: number; discarded: boolean }
  | { kind: 'unavailable' }
  | { kind: 'error'; message: string };

interface WorkspaceApi {
  state: WorkspaceState;
  storage: StorageStatus;
  dispatch: (a: Action) => void;
  /** source names as the pipeline will see them (unique_sources applied to a copy), by article id */
  displayName: Map<string, string>;
  /** colour slot (0..) per display name; the same outlet keeps one colour across stories */
  colorOf: (displayName: string) => number;
  run: () => Promise<void>;
}

const Ctx = createContext<WorkspaceApi | null>(null);

export function WorkspaceProvider({
  children,
  initial,
  persist = true,
}: {
  children: ReactNode;
  initial?: WorkspaceState;
  persist?: boolean;
}) {
  const [state, dispatch] = useReducer(reducer, initial ?? initialState);
  const [storage, setStorage] = useState<StorageStatus>(persist ? { kind: 'loading' } : { kind: 'unavailable' });
  const hydrated = useRef(!persist);
  const discarded = useRef(false);
  // after loading a good record there is nothing new to write; an unreadable record is replaced at once
  const skipNextSave = useRef(false);

  // load once; nothing is saved until this finishes, so an empty first render cannot overwrite saved work
  useEffect(() => {
    if (!persist) return;
    let cancelled = false;
    loadWorkspace()
      .then(({ data, discarded: dropped }) => {
        if (cancelled) return;
        discarded.current = dropped;
        if (data) dispatch({ type: 'hydrate', state: data });
        skipNextSave.current = !dropped;
        hydrated.current = true;
        setStorage({ kind: 'saved', at: data?.savedAt ?? Date.now(), discarded: dropped });
      })
      .catch(() => {
        if (cancelled) return;
        hydrated.current = true;
        setStorage({ kind: 'unavailable' });
      });
    return () => {
      cancelled = true;
    };
  }, [persist]);

  // save shortly after every change
  useEffect(() => {
    if (!persist || !hydrated.current || storage.kind === 'unavailable' || storage.kind === 'loading') return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      const { last } = state;
      saveWorkspace({
        version: PERSIST_VERSION,
        savedAt: Date.now(),
        articles: state.articles,
        params: state.params,
        refs: state.refs,
        last: last
          ? { result: last.result, params: last.params, ms: last.ms, finishedAt: last.finishedAt, stale: last.revision !== state.revision }
          : null,
      })
        .then(() => setStorage({ kind: 'saved', at: Date.now(), discarded: discarded.current }))
        .catch((e: unknown) => setStorage({ kind: 'error', message: e instanceof Error ? e.message : String(e) }));
    }, 300);
    return () => window.clearTimeout(t);
    // storage is read only to gate the first save: depending on it would re-save after every status update
  }, [persist, state.articles, state.params, state.refs, state.last, state.revision, storage.kind === 'loading']);

  const displayName = useMemo(() => {
    const unique = uniqueSources(state.articles);
    return new Map(unique.map((a) => [a.id, a.source]));
  }, [state.articles]);

  const colorOf = useMemo(() => {
    const slot = new Map<string, number>();
    const byDisplay = new Map<string, number>();
    for (const a of state.articles) {
      if (!slot.has(a.source)) slot.set(a.source, slot.size);
      byDisplay.set(displayName.get(a.id) ?? a.source, slot.get(a.source)!);
    }
    return (name: string) => byDisplay.get(name) ?? 0;
  }, [state.articles, displayName]);

  const run = useCallback(async () => {
    if (state.articles.length === 0 || state.running) return;
    const params = state.params;
    const revision = state.revision;
    const articles: Article[] = uniqueSources(state.articles).map(({ event, source, title, sents }) => ({
      event,
      source,
      title,
      sents,
    }));
    dispatch({ type: 'runStart' });
    try {
      const { result, ms } = await runInWorker(articles, params);
      dispatch({ type: 'runDone', result, params, revision, ms });
    } catch (e) {
      dispatch({ type: 'runFail', error: e instanceof Error ? e.message : String(e) });
    }
  }, [state.articles, state.params, state.revision, state.running]);

  const api = useMemo(() => ({ state, storage, dispatch, displayName, colorOf, run }), [state, storage, displayName, colorOf, run]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useWorkspace(): WorkspaceApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return v;
}
