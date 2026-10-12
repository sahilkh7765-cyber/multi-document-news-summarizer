// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// The consensus summary set as the story's lede, with each sentence's outlet noted in the margin.
// S1, S2, ... number the sentences because the coverage matrix refers to them by that number.

import { cn } from '@/lib/utils';
import { markStyle } from '@/components/SourceMark';
import type { ClusterResult } from '@/nlp/types';

interface Props {
  cluster: ClusterResult;
  colorOf: (name: string) => number;
  /** play the arrival sequence (only right after a run) */
  animate: boolean;
}

export function ConsensusLede({ cluster, colorOf, animate }: Props) {
  return (
    <ol className="space-y-4" aria-label={cluster.sources.length > 1 ? 'Consensus summary' : 'Summary'}>
      {cluster.summary.map((s, i) => {
        const from = cluster.summary_from[i]!;
        const slot = colorOf(from);
        return (
          <li
            key={i}
            className={cn(
              'grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-2 lg:grid-cols-[2.25rem_minmax(0,34em)_11rem] lg:gap-x-6',
              animate && 'lede-line',
            )}
            style={animate ? { animationDelay: `${i * 40}ms` } : undefined}
          >
            <span className="tabular pt-1.5 text-sm text-ink-muted" aria-hidden>
              S{i + 1}
            </span>
            <p className="font-serif text-[1.25rem] leading-[1.9rem] text-ink sm:text-lede">
              <span className="sr-only">{`S${i + 1}: `}</span>
              {s}
            </p>
            <p
              className={cn(
                'col-start-2 mt-1 border-l-2 border-[var(--mark)] pl-2 text-sm leading-5 text-ink-muted lg:col-start-3 lg:row-start-1 lg:mt-1.5',
                slot >= 8 && 'border-dashed',
              )}
              style={markStyle(slot)}
            >
              <span className="sr-only">Source: </span>
              <span className="font-medium text-ink">{from}</span>
            </p>
          </li>
        );
      })}
    </ol>
  );
}
