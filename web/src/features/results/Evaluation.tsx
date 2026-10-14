// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Per-story evaluation, as in app.py: an optional reference summary enables ROUGE-1/2/L; Distinct-1/2 are
// always shown; the pipeline is compared with the LEAD-2 baseline. With fact-labelled (demo) data the
// tau_uniq sweep is scored for precision/recall/F1 and drawn as a chart.

import { useId } from 'react';
import { Label, Textarea } from '@/components/ui/field';
import { cn } from '@/lib/utils';
import { fmt4, prfScores } from '@/nlp/metrics';
import { evaluateStory, type SystemScores } from '@/nlp/evaluate';
import type { ClusterResult } from '@/nlp/types';
import { SweepChart, type SweepPoint } from './SweepChart';

interface Props {
  cluster: ClusterResult;
  tauUniq: number;
  reference: string;
  onReferenceChange: (text: string) => void;
}

export const METRIC_COLUMNS = [
  ['ROUGE-1', 'rouge1'],
  ['ROUGE-2', 'rouge2'],
  ['ROUGE-L', 'rougeL'],
  ['Distinct-1', 'distinct1'],
  ['Distinct-2', 'distinct2'],
] as const satisfies readonly (readonly [string, keyof SystemScores])[];

type Metric = (typeof METRIC_COLUMNS)[number][0];

function scoreRows(cluster: ClusterResult, ref: string) {
  const ev = evaluateStory(cluster, ref);
  const cols = METRIC_COLUMNS.filter(([, key]) => ev.hasReference || key.startsWith('distinct'));
  const metrics: Metric[] = cols.map(([label]) => label);
  const rows = (
    [
      ['LEAD-2 baseline', ev.lead],
      ['This pipeline', ev.pipeline],
    ] as const
  ).map(([name, s]) => ({
    name,
    v: Object.fromEntries(cols.map(([label, key]) => [label, s[key] ?? 0])) as Record<Metric, number>,
  }));
  return { metrics, rows };
}

export function Evaluation({ cluster, tauUniq, reference, onReferenceChange }: Props) {
  const id = useId();
  const multi = cluster.sources.length > 1;
  const { metrics, rows } = scoreRows(cluster, reference);
  const scored = cluster.sweep.every(([, , p]) => p !== null);
  const points: SweepPoint[] = scored
    ? cluster.sweep.map(([t, detected, p]) => ({ t, detected, scores: prfScores(p!) }))
    : [];

  return (
    <div className="space-y-8">
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-ref`}>Reference summary (optional, enables ROUGE)</Label>
        <Textarea
          id={`${id}-ref`}
          value={reference}
          onChange={(e) => onReferenceChange(e.target.value)}
          rows={4}
          className="max-w-[46rem] font-serif text-base leading-7"
          placeholder="Paste a human-written summary of this story to score both systems against it."
        />
      </div>

      <div className="relative overflow-x-auto">
        <table className="min-w-[28rem] border-collapse text-sm">
          <caption className="mb-2 text-left text-sm font-medium text-ink">
            {reference.trim() ? 'ROUGE F1 against the reference, and Distinct-n' : 'Distinct-n (add a reference to also score ROUGE)'}
          </caption>
          <thead>
            <tr className="border-b border-rule">
              <th scope="col" className="py-2 pr-6 text-left font-medium text-ink-muted">
                System
              </th>
              {metrics.map((m) => (
                <th key={m} scope="col" className="px-3 py-2 text-right font-medium text-ink-muted">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-b border-rule last:border-b-0">
                <th scope="row" className="py-2 pr-6 text-left font-medium">
                  {r.name}
                </th>
                {metrics.map((m) => {
                  const best = Math.max(...rows.map((x) => x.v[m]));
                  const isBest = r.v[m] === best && rows.some((x) => x.v[m] !== best);
                  return (
                    <td key={m} className={cn('tabular px-3 py-2 text-right', isBest && 'font-semibold')}>
                      {fmt4(r.v[m])}
                      {isBest && <span className="sr-only"> (higher)</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-ink-muted">
          LEAD-2 takes the first two sentences of each article, up to {cluster.summary.length} sentences. Bold marks
          the higher score.
        </p>
      </div>

      {multi && (
        <div className="space-y-4">
          {scored && (
            <SweepChart
              points={points}
              current={tauUniq}
              title="How the exclusivity threshold changes detection (scored against the fact labels)"
            />
          )}
          <div className="relative overflow-x-auto">
            <table className="min-w-[24rem] border-collapse text-sm">
              <caption className="mb-2 text-left text-sm font-medium text-ink">
                Threshold sensitivity{scored ? '' : ': sentences flagged as exclusive at each threshold'}
              </caption>
              <thead>
                <tr className="border-b border-rule">
                  {['τ_uniq', 'Flagged', ...(scored ? ['Precision', 'Recall', 'F1'] : [])].map((h) => (
                    <th key={h} scope="col" className="px-3 py-2 text-right font-medium text-ink-muted first:pl-0 first:text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cluster.sweep.map(([t, det, p]) => {
                  const s = p ? prfScores(p) : null;
                  const isCurrent = Math.abs(t - tauUniq) < 1e-9;
                  return (
                    <tr key={t} className={cn('border-b border-rule last:border-b-0', isCurrent && 'bg-pencil-wash')}>
                      <th scope="row" className="tabular py-1.5 pr-3 text-left font-medium">
                        {t.toFixed(2)}
                        {isCurrent && <span className="ml-2 text-xs font-normal text-ink-muted">current</span>}
                      </th>
                      <td className="tabular px-3 py-1.5 text-right">{det}</td>
                      {s && (
                        <>
                          <td className="tabular px-3 py-1.5 text-right">{fmt4(s.precision)}</td>
                          <td className="tabular px-3 py-1.5 text-right">{fmt4(s.recall)}</td>
                          <td className="tabular px-3 py-1.5 text-right">{fmt4(s.f1)}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="max-w-[46rem] text-xs leading-5 text-ink-muted">
        Ties in the keyword and per-article rankings are broken deterministically, so this app gives the same
        result on every machine; the Python version&rsquo;s tie order depends on numpy and the CPU.
      </p>
    </div>
  );
}
