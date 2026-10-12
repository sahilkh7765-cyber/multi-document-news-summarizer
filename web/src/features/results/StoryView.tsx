// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// One story: the consensus lede first, then coverage, source-exclusive details, per-article summaries
// and evaluation.

import { ChevronRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Notice } from '@/components/Notice';
import { SourceTag, markBar, markStyle } from '@/components/SourceMark';
import { cn, plural } from '@/lib/utils';
import type { ClusterResult } from '@/nlp/types';
import { useWorkspace } from '@/state/workspace';
import { ConsensusLede } from './ConsensusLede';
import { CoverageMatrix } from './CoverageMatrix';
import { Evaluation } from './Evaluation';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 border-t border-rule pt-6">
      <h3 className="font-serif text-2xl font-semibold">{title}</h3>
      {children}
    </section>
  );
}

export function StoryView({ cluster }: { cluster: ClusterResult }) {
  const { state, dispatch, colorOf } = useWorkspace();
  const last = state.last!;
  // the arrival sequence plays once, right after a run
  const [animate] = useState(() => Date.now() - last.finishedAt < 1500);
  const multi = cluster.sources.length > 1;
  const withExclusive = cluster.sources.filter((s) => cluster.exclusive[s]?.length);
  const without = cluster.sources.filter((s) => !cluster.exclusive[s]?.length);

  return (
    <article className="space-y-10" aria-labelledby={`story-${cluster.name}`}>
      <header className="space-y-2">
        <h2 id={`story-${cluster.name}`} className="font-serif text-3xl font-semibold leading-tight">
          {multi ? 'Consensus summary' : 'Summary (single source)'}
          <span className="sr-only">{` for ${cluster.name}`}</span>
        </h2>
        <p className="max-w-[46rem] text-sm text-ink-muted">
          {plural(cluster.sources.length, 'outlet')}, {plural(cluster.n_sent, 'sentence')}, {cluster.pool} left after
          removing duplicates. Keywords: <span className="text-ink">{cluster.keywords.join(', ')}</span>.
        </p>
      </header>

      <ConsensusLede cluster={cluster} colorOf={colorOf} animate={animate} />

      {!multi && (
        <Notice tone="info">
          Only one outlet covers this story, so there is nothing to compare it with. Add another article on the same
          story to see where outlets differ.
        </Notice>
      )}

      {multi && (
        <Section title="Coverage across outlets">
          <CoverageMatrix cluster={cluster} colorOf={colorOf} />
        </Section>
      )}

      {multi && (
        <Section title="Reported by one outlet only">
          {withExclusive.length === 0 ? (
            <p className="text-ink-muted">No source-exclusive details detected at this threshold.</p>
          ) : (
            <div className="space-y-6">
              {withExclusive.map((src) => {
                const slot = colorOf(src);
                return (
                  <div key={src} className={cn('pl-4', markBar(slot))} style={markStyle(slot)}>
                    <h4 className="text-sm font-semibold text-ink">Only in {src}</h4>
                    <ul className="mt-1 max-w-[40em] space-y-2">
                      {cluster.exclusive[src]!.map((s, i) => (
                        <li key={i} className="font-serif text-reading text-ink">
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              {without.length > 0 && (
                <p className="text-sm text-ink-muted">Nothing exclusive from {without.join(', ')}.</p>
              )}
            </div>
          )}
        </Section>
      )}

      <Section title="Summary of each article">
        <div className="divide-y divide-rule border-y border-rule">
          {cluster.articles.map((a) => (
            <details key={a.source} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2 py-3 [&::-webkit-details-marker]:hidden">
                <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-muted transition-transform group-open:rotate-90" />
                <SourceTag name={a.source} slot={colorOf(a.source)} />
                <span className="tabular text-sm text-ink-muted">{plural(a.n_sent, 'sentence')}</span>
                {a.title && <span className="truncate font-serif text-sm text-ink-muted">{a.title}</span>}
              </summary>
              <ul className="mb-4 ml-6 max-w-[40em] list-disc space-y-1.5 pl-4 marker:text-ink-muted">
                {a.summary.map((s, i) => (
                  <li key={i} className="font-serif text-reading">
                    {s}
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </Section>

      <Section title="Evaluation">
        <Evaluation
          cluster={cluster}
          tauUniq={last.params.tau_uniq}
          reference={state.refs[cluster.name] ?? ''}
          onReferenceChange={(text) => dispatch({ type: 'setRef', name: cluster.name, text })}
        />
      </Section>
    </article>
  );
}
