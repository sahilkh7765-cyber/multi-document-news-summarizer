// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Workspace state: the articles on the desk, the settings, the last run and the reference summaries.
// A plain reducer behind a context; the pipeline itself runs in the worker (src/worker).

import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react';
import { DEMO_CORPUS, DEMO_REFERENCES } from '@/nlp/demo';
import { uniqueSources } from '@/nlp/sentences';
import type { Article, Params, PipelineResult } from '@/nlp/types';
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
  | { type: 'hydrate'; state: Pick<WorkspaceState, 'articles' | 'params' | 'refs'> };

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
    case 'hydrate':
      return { ...state, ...action.state, revision: state.revision + 1 };
  }
}

export const sameParams = (a: Params, b: Params): boolean =>
  a.k === b.k && a.delta === b.delta && a.tau_dup === b.tau_dup && a.tau_uniq === b.tau_uniq;

interface WorkspaceApi {
  state: WorkspaceState;
  dispatch: (a: Action) => void;
  /** source names as the pipeline will see them (unique_sources applied to a copy), by article id */
  displayName: Map<string, string>;
  /** colour slot (0..) per display name; the same outlet keeps one colour across stories */
  colorOf: (displayName: string) => number;
  run: () => Promise<void>;
}

const Ctx = createContext<WorkspaceApi | null>(null);

export function WorkspaceProvider({ children, initial }: { children: ReactNode; initial?: WorkspaceState }) {
  const [state, dispatch] = useReducer(reducer, initial ?? initialState);

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

  const api = useMemo(() => ({ state, dispatch, displayName, colorOf, run }), [state, displayName, colorOf, run]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useWorkspace(): WorkspaceApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return v;
}
