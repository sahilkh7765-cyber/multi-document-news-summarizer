// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Results of the last run: one sentence of run totals, a tab per story, and (with fact-labelled data) the
// divergence-detection scores across all stories.

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { plural } from '@/lib/utils';
import { fmt4, prfScores, runTotals } from '@/nlp/metrics';
import { useWorkspace } from '@/state/workspace';
import { ExportBar } from './ExportBar';
import { StoryView } from './StoryView';

export function Results() {
  const { state } = useWorkspace();
  const last = state.last!;
  const res = last.result;
  const totals = runTotals(res);
  const [tab, setTab] = useState('0');
  const current = Number(tab) < res.clusters.length ? tab : '0';
  const overall = totals.prf ? prfScores(totals.prf) : null;

  return (
    <div className="pt-6">
      <ExportBar />

      {/* the verdict first: what the run found, then (with fact labels) how well it found it */}
      <div className="mt-5 max-w-[46rem] border-l-2 border-pencil pl-4">
        <p className="font-serif text-reading text-ink" aria-live="polite">
          {plural(res.n_docs, 'article')} grouped into {plural(res.clusters.length, 'story', 'stories')}.{' '}
          {totals.sentences > 0 &&
            `Duplicates removed: ${(100 * totals.redundancy).toFixed(1)} % of sentences (${totals.sentences} → ${totals.pooled}). `}
          {plural(totals.exclusive, 'detail')} reported by one outlet only.
          {res.cluster_acc !== null && (
            <>
              {' '}
              Story grouping agrees with the event labels on <span className="tabular font-semibold">{fmt4(res.cluster_acc)}</span>{' '}
              of article pairs.
            </>
          )}
        </p>
        {overall && totals.prf && (
          <section className="mt-3" aria-labelledby="overall-divergence">
            <h2 id="overall-divergence" className="text-sm text-ink-muted">
              Exclusive-detail detection across all stories, scored against the fact labels at τ_uniq ={' '}
              {last.params.tau_uniq.toFixed(2)}
            </h2>
            <dl className="mt-1 flex flex-wrap gap-x-6 gap-y-1">
              {[
                ['Precision', fmt4(overall.precision)],
                ['Recall', fmt4(overall.recall)],
                ['F1', fmt4(overall.f1)],
                ['TP / FP / FN', `${totals.prf[0]} / ${totals.prf[1]} / ${totals.prf[2]}`],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline gap-2">
                  <dt className="text-sm text-ink-muted">{k}</dt>
                  <dd className="tabular font-serif text-xl text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>

      <Tabs value={current} onValueChange={setTab} className="mt-8">
        <TabsList className="relative overflow-x-auto" aria-label="Stories">
          {res.clusters.map((c, i) => (
            <TabsTrigger key={c.name} value={String(i)} className="flex-col items-start gap-0 h-auto py-2">
              <span className="font-serif text-base">{c.name}</span>
              <span className="text-xs font-normal text-ink-muted">{plural(c.sources.length, 'outlet')}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        {res.clusters.map((c, i) => (
          <TabsContent key={`${last.finishedAt}-${c.name}`} value={String(i)} className="pt-8">
            <StoryView cluster={c} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
