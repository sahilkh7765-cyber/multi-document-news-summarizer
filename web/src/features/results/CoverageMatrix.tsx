// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Which outlet reports each summary sentence. A ruled table (outlets x S1..Sk) from 640px up; on phones,
// one block per summary sentence listing the outlets that report it and those that do not.

import { Check, Minus } from 'lucide-react';
import { SourceTag } from '@/components/SourceMark';
import { cn } from '@/lib/utils';
import type { ClusterResult } from '@/nlp/types';

interface Props {
  cluster: ClusterResult;
  colorOf: (name: string) => number;
}

function Cell({ reports, origin }: { reports: boolean; origin: boolean }) {
  // marks, not controls: a tinted circle with a tick (reports it), a solid circle (the summary sentence
  // was taken from this outlet), a plain dash (does not report it)
  return (
    <span className="flex justify-center">
      {reports ? (
        <span
          className={cn(
            'flex size-6 items-center justify-center rounded-full',
            origin ? 'bg-pencil text-pencil-ink' : 'bg-pencil-wash text-pencil',
          )}
        >
          <Check aria-hidden className="size-3.5" strokeWidth={3} />
        </span>
      ) : (
        <Minus aria-hidden className="size-4 text-ink-muted" />
      )}
      <span className="sr-only">
        {origin ? 'Reports it (summary sentence taken from here)' : reports ? 'Reports it' : 'Does not report it'}
      </span>
    </span>
  );
}

export function CoverageMatrix({ cluster, colorOf }: Props) {
  const n = cluster.summary.length;
  return (
    <div>
      {/* table from 640px */}
      <div className="relative hidden overflow-x-auto sm:block">
        <table className="border-collapse text-sm">
          <caption className="sr-only">Which outlet reports each summary sentence</caption>
          <thead>
            <tr className="border-b border-rule">
              <th scope="col" className="py-2 pr-6 text-left font-medium text-ink-muted">
                Outlet
              </th>
              {cluster.summary.map((s, i) => (
                <th key={i} scope="col" className="tabular w-11 px-1 py-2 text-center font-medium text-ink" title={s}>
                  S{i + 1}
                </th>
              ))}
              <th scope="col" className="tabular py-2 pl-5 text-right font-medium text-ink-muted">
                Reports
              </th>
            </tr>
          </thead>
          <tbody>
            {cluster.sources.map((src) => {
              const count = cluster.coverage.filter((row) => row[src]).length;
              return (
                <tr key={src} className="border-b border-rule last:border-b-0">
                  <th scope="row" className="py-2 pr-6 text-left font-normal">
                    <SourceTag name={src} slot={colorOf(src)} />
                  </th>
                  {cluster.coverage.map((row, i) => (
                    <td key={i} className="px-1 py-1.5">
                      <Cell reports={Boolean(row[src])} origin={cluster.summary_from[i] === src} />
                    </td>
                  ))}
                  <td className="tabular py-2 pl-5 text-right text-ink-muted">
                    {count} of {n}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* phones: one block per summary sentence */}
      <ol className="space-y-3 sm:hidden">
        {cluster.summary.map((s, i) => {
          const yes = cluster.sources.filter((src) => cluster.coverage[i]![src]);
          const no = cluster.sources.filter((src) => !cluster.coverage[i]![src]);
          return (
            <li key={i} className="border-b border-rule pb-3 last:border-b-0">
              <p className="text-sm">
                <span className="tabular font-semibold">S{i + 1}</span>{' '}
                <span className="text-ink-muted">
                  reported by {yes.length} of {cluster.sources.length}
                </span>
              </p>
              <p className="mt-1 line-clamp-2 font-serif text-[0.95rem] leading-6 text-ink-muted">{s}</p>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1" aria-label="Reported by">
                {yes.map((src) => (
                  <li key={src} className="flex items-center gap-1">
                    <Check aria-hidden className="size-4 text-pencil" strokeWidth={3} />
                    <SourceTag name={src} slot={colorOf(src)} />
                  </li>
                ))}
              </ul>
              {no.length > 0 && (
                <p className="mt-1 text-sm text-ink-muted">
                  <span className="sr-only">Not reported by: </span>
                  <Minus aria-hidden className="mr-1 inline size-4" />
                  {no.join(', ')}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <p className="mt-3 hidden max-w-[46rem] text-xs leading-5 text-ink-muted sm:block">
        S1, S2… are the summary sentences above, in order. A tick means the outlet has a sentence at least as
        similar as the exclusivity threshold; the solid circle marks the outlet the sentence was taken from.
      </p>
    </div>
  );
}
