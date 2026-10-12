// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Shared types for the NLP pipeline. Result objects deliberately keep app.py's snake_case keys so that
// the JSON export has the same shape as the Streamlit app's "Download results (.json)".

/** One sentence and its fact id (fact ids exist only in the demo corpus). */
export type Sentence = readonly [text: string, fact: string | null];

export interface Article {
  event: string | null;
  source: string;
  title: string;
  sents: readonly Sentence[];
}

export interface Params {
  delta: number;
  tau_dup: number;
  tau_uniq: number;
  k: number;
}

/** (tp, fp, fn) */
export type Prf = readonly [tp: number, fp: number, fn: number];

/** (tau_uniq, detected, prf or null when there are no fact ids) */
export type SweepRow = readonly [t: number, detected: number, prf: Prf | null];

export interface ArticleSummary {
  source: string;
  title: string;
  n_sent: number;
  summary: string[];
}

export interface ClusterResult {
  name: string;
  keywords: string[];
  sources: string[];
  n_sent: number;
  pool: number;
  summary: string[];
  summary_from: string[];
  coverage: Record<string, boolean>[];
  exclusive: Record<string, string[]>;
  detected: number;
  prf: Prf | null;
  sweep: SweepRow[];
  articles: ArticleSummary[];
  lead: string;
}

export interface PipelineResult {
  clusters: ClusterResult[];
  cluster_acc: number | null;
  has_facts: boolean;
  n_docs: number;
}
