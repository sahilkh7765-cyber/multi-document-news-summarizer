// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Per-story evaluation from app.py: ROUGE-1/2/L F1 against an optional reference and Distinct-1/2, for
// the LEAD-2 baseline and for the pipeline's consensus summary.

import { distinct, rougeL, rougeN } from './rouge';
import type { ClusterResult } from './types';

export interface SystemScores {
  rouge1: number | null;
  rouge2: number | null;
  rougeL: number | null;
  distinct1: number;
  distinct2: number;
}

export interface StoryEvaluation {
  hasReference: boolean;
  lead: SystemScores;
  pipeline: SystemScores;
}

function score(cand: string, ref: string, withRef: boolean): SystemScores {
  return {
    rouge1: withRef ? rougeN(cand, ref, 1) : null,
    rouge2: withRef ? rougeN(cand, ref, 2) : null,
    rougeL: withRef ? rougeL(cand, ref) : null,
    distinct1: distinct(cand, 1),
    distinct2: distinct(cand, 2),
  };
}

export function evaluateStory(cluster: ClusterResult, reference: string): StoryEvaluation {
  const withRef = reference.trim() !== '';
  return {
    hasReference: withRef,
    lead: score(cluster.lead, reference, withRef),
    pipeline: score(cluster.summary.join(' '), reference, withRef),
  };
}
