// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Exports of the last run.
//   JSON: app.py's result object (same keys as its "Download results (.json)": clusters, cluster_acc,
//         has_facts, n_docs) plus the settings, run totals and the per-story evaluation scores.
//   Markdown: a readable report with the same content as the screen.

import { evaluateStory, type StoryEvaluation, type SystemScores } from '@/nlp/evaluate';
import { prfScores, runTotals, type RunTotals } from '@/nlp/metrics';
import type { ClusterResult, Params, PipelineResult } from '@/nlp/types';

export interface ExportInput {
  result: PipelineResult;
  params: Params;
  refs: Record<string, string>;
  generatedAt: Date;
}

export interface JsonExport extends PipelineResult {
  generated_by: string;
  generated_at: string;
  params: Params;
  totals: RunTotals & { precision: number | null; recall: number | null; f1: number | null };
  evaluation: ({ name: string; reference: string } & Omit<StoryEvaluation, 'hasReference'>)[];
}

export const APP_NAME = 'Cross-Source Desk';

export function buildJson({ result, params, refs, generatedAt }: ExportInput): JsonExport {
  const totals = runTotals(result);
  const s = totals.prf ? prfScores(totals.prf) : null;
  return {
    generated_by: APP_NAME,
    generated_at: generatedAt.toISOString(),
    params,
    ...result,
    totals: { ...totals, precision: s?.precision ?? null, recall: s?.recall ?? null, f1: s?.f1 ?? null },
    evaluation: result.clusters.map((c) => {
      const reference = refs[c.name] ?? '';
      const { lead, pipeline } = evaluateStory(c, reference);
      return { name: c.name, reference, lead, pipeline };
    }),
  };
}

// ---- Markdown

/** Escape text so it renders literally inside a Markdown paragraph, list item or table cell. */
export function mdText(s: string): string {
  return s
    .replace(/[\\`*_[\]<>|]/g, (c) => '\\' + c)
    .replace(/^(#|[-+]\s)/, (m) => '\\' + m)
    .replace(/^(\d+)([.)]\s)/, (_, n: string, rest: string) => `${n}\\${rest}`)
    .replace(/\r?\n/g, ' ');
}

const f4 = (x: number | null): string => (x === null ? '' : x.toFixed(4));
const fixed2 = (x: number): string => x.toFixed(2);

function table(head: string[], rows: string[][], align?: ('l' | 'r' | 'c')[]): string[] {
  const sep = head.map((_, i) => ({ l: '---', r: '---:', c: ':-:' })[align?.[i] ?? 'l']);
  return ['| ' + head.join(' | ') + ' |', '| ' + sep.join(' | ') + ' |', ...rows.map((r) => '| ' + r.join(' | ') + ' |')];
}

function scoreTable(ev: StoryEvaluation): string[] {
  const cols: [string, keyof SystemScores][] = [
    ...(ev.hasReference
      ? ([
          ['ROUGE-1', 'rouge1'],
          ['ROUGE-2', 'rouge2'],
          ['ROUGE-L', 'rougeL'],
        ] as [string, keyof SystemScores][])
      : []),
    ['Distinct-1', 'distinct1'],
    ['Distinct-2', 'distinct2'],
  ];
  const row = (name: string, s: SystemScores) => [name, ...cols.map(([, k]) => f4(s[k]))];
  return table(
    ['System', ...cols.map(([h]) => h)],
    [row('LEAD-2 baseline', ev.lead), row('This pipeline', ev.pipeline)],
    ['l', ...cols.map(() => 'r' as const)],
  );
}

function storyMarkdown(c: ClusterResult, reference: string, params: Params): string[] {
  const multi = c.sources.length > 1;
  const out: string[] = [];
  out.push(`## ${mdText(c.name)}`, '');
  out.push(`Outlets: ${c.sources.map(mdText).join(', ')}.`, '');
  out.push(`${c.n_sent} sentences, ${c.pool} after removing duplicates. Keywords: ${c.keywords.map(mdText).join(', ')}.`, '');

  out.push(multi ? '### Consensus summary' : '### Summary (single source)', '');
  c.summary.forEach((s, i) => out.push(`${i + 1}. ${mdText(s)} *(${mdText(c.summary_from[i]!)})*`));
  out.push('');

  if (!multi) {
    out.push('Only one outlet covers this story, so there is nothing to compare it with.', '');
  } else {
    out.push('### Coverage across outlets', '');
    out.push(
      ...table(
        ['Outlet', ...c.summary.map((_, i) => `S${i + 1}`)],
        c.sources.map((src) => [mdText(src), ...c.coverage.map((row) => (row[src] ? '✓' : '—'))]),
        ['l', ...c.summary.map(() => 'c' as const)],
      ),
    );
    out.push('', `S1, S2… are the summary sentences above. ✓ means the outlet has a sentence at least ${fixed2(params.tau_uniq)} similar.`, '');

    out.push('### Reported by one outlet only', '');
    const withExclusive = c.sources.filter((s) => c.exclusive[s]?.length);
    if (withExclusive.length === 0) out.push('No source-exclusive details detected.', '');
    for (const src of withExclusive) {
      out.push(`**Only in ${mdText(src)}**`, '');
      for (const s of c.exclusive[src]!) out.push(`- ${mdText(s)}`);
      out.push('');
    }
  }

  out.push('### Summary of each article', '');
  for (const a of c.articles) {
    out.push(`**${mdText(a.source)}** (${a.n_sent} sentences)${a.title ? `: ${mdText(a.title)}` : ''}`, '');
    for (const s of a.summary) out.push(`- ${mdText(s)}`);
    out.push('');
  }

  const ev = evaluateStory(c, reference);
  out.push('### Evaluation', '');
  if (ev.hasReference) out.push(`Reference summary: ${mdText(reference.trim())}`, '');
  else out.push('No reference summary was given, so ROUGE is not scored.', '');
  out.push(...scoreTable(ev), '');

  if (multi) {
    const scored = c.sweep.every(([, , p]) => p !== null);
    out.push(`Threshold sensitivity (current τ_uniq = ${fixed2(params.tau_uniq)}):`, '');
    out.push(
      ...table(
        ['τ_uniq', 'Flagged', ...(scored ? ['Precision', 'Recall', 'F1'] : [])],
        c.sweep.map(([t, det, p]) => {
          const s = p ? prfScores(p) : null;
          return [fixed2(t), String(det), ...(s ? [f4(s.precision), f4(s.recall), f4(s.f1)] : [])];
        }),
        ['l', 'r', 'r', 'r', 'r'],
      ),
      '',
    );
  }
  return out;
}

export function buildMarkdown({ result, params, refs, generatedAt }: ExportInput): string {
  const totals = runTotals(result);
  const out: string[] = [];
  out.push(`# ${APP_NAME} report`, '');
  out.push(
    `Generated ${generatedAt.toISOString().replace('T', ' ').slice(0, 16)} UTC. Settings: k = ${params.k}, δ = ${fixed2(params.delta)}, τ_dup = ${fixed2(params.tau_dup)}, τ_uniq = ${fixed2(params.tau_uniq)}.`,
    '',
  );
  const parts = [
    `${result.n_docs} article${result.n_docs === 1 ? '' : 's'} grouped into ${result.clusters.length} stor${result.clusters.length === 1 ? 'y' : 'ies'}.`,
  ];
  if (totals.sentences > 0) {
    parts.push(`Duplicates removed: ${(100 * totals.redundancy).toFixed(1)} % of sentences (${totals.sentences} → ${totals.pooled}).`);
  }
  parts.push(`${totals.exclusive} detail${totals.exclusive === 1 ? '' : 's'} reported by one outlet only.`);
  if (result.cluster_acc !== null) parts.push(`Pairwise clustering accuracy against the event labels: ${f4(result.cluster_acc)}.`);
  out.push(parts.join(' '), '');

  if (totals.prf) {
    const s = prfScores(totals.prf);
    out.push(`Exclusive-detail detection across all stories (τ_uniq = ${fixed2(params.tau_uniq)}):`, '');
    out.push(
      ...table(
        ['Precision', 'Recall', 'F1', 'TP', 'FP', 'FN'],
        [[f4(s.precision), f4(s.recall), f4(s.f1), ...totals.prf.map(String)]],
        ['r', 'r', 'r', 'r', 'r', 'r'],
      ),
      '',
    );
  }

  for (const c of result.clusters) out.push(...storyMarkdown(c, refs[c.name] ?? '', params));
  out.push(
    '---',
    '',
    'Ties in keyword and per-article rankings are broken deterministically; the Python version\'s tie order depends on numpy and the CPU.',
    '',
  );
  return out.join('\n');
}

export function exportFileName(kind: 'json' | 'md', at: Date): string {
  const stamp = at.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
  return `cross-source-${kind === 'json' ? 'results' : 'report'}-${stamp}.${kind}`;
}

/** Hand the viewer a file to save. */
export function downloadText(text: string, fileName: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
