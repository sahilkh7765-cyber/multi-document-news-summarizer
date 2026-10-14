// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// JSON and Markdown exports of the demo run, checked against metrics.json and the app.py fixtures.

import { describe, expect, it } from 'vitest';
import { DEMO_CORPUS, DEMO_REFERENCES } from '@/nlp/demo';
import { runPipeline } from '@/nlp/pipeline';
import { uniqueSources } from '@/nlp/sentences';
import { readJson, runs } from '@/nlp/__tests__/fixtures';
import { buildJson, buildMarkdown, exportFileName, mdText } from '../report';

const params = { delta: 0.85, tau_dup: 0.2, tau_uniq: 0.2, k: 5 };
const result = runPipeline(uniqueSources(DEMO_CORPUS), params);
const refs = Object.fromEntries(result.clusters.map((c) => [c.name, DEMO_REFERENCES[c.name] ?? '']));
const at = new Date('2026-10-14T09:30:00Z');
const metrics = readJson<{ P: number; R: number; F: number; TP: number; FP: number; FN: number }>('../metrics.json');

describe('JSON export', () => {
  const json = JSON.parse(JSON.stringify(buildJson({ result, params, refs, generatedAt: at }))) as ReturnType<typeof buildJson>;

  it("keeps app.py's result keys and values", () => {
    expect(json.clusters).toEqual(JSON.parse(JSON.stringify(result.clusters)));
    expect([json.cluster_acc, json.has_facts, json.n_docs]).toEqual([result.cluster_acc, result.has_facts, result.n_docs]);
    expect(json.params).toEqual(params);
    expect(json.generated_at).toBe('2026-10-14T09:30:00.000Z');
  });

  it('totals reproduce metrics.json', () => {
    expect(json.totals.prf).toEqual([metrics.TP, metrics.FP, metrics.FN]);
    expect(Math.abs(json.totals.precision! - metrics.P)).toBeLessThan(1e-9);
    expect(Math.abs(json.totals.recall! - metrics.R)).toBeLessThan(1e-9);
    expect(Math.abs(json.totals.f1! - metrics.F)).toBeLessThan(1e-9);
  });

  it('evaluation scores equal app.py (fixture run, demo defaults)', () => {
    const fx = runs().runs.find((r) => r.corpus === 'demo' && r.params.delta === 0.85 && r.params.k === 5 && r.params.tau_dup === 0.2 && r.params.tau_uniq === 0.2)!;
    json.evaluation.forEach((e, i) => {
      const py = fx.eval[i]!;
      expect(e.name).toBe(py.name);
      for (const sys of ['lead', 'pipeline'] as const) {
        expect(Math.abs(e[sys].rouge1! - py[sys].rouge1!)).toBeLessThan(1e-9);
        expect(Math.abs(e[sys].rouge2! - py[sys].rouge2!)).toBeLessThan(1e-9);
        expect(Math.abs(e[sys].rougeL! - py[sys].rougeL!)).toBeLessThan(1e-9);
        expect(Math.abs(e[sys].distinct1 - py[sys].distinct1)).toBeLessThan(1e-9);
        expect(Math.abs(e[sys].distinct2 - py[sys].distinct2)).toBeLessThan(1e-9);
      }
    });
  });
});

describe('Markdown report', () => {
  const md = buildMarkdown({ result, params, refs, generatedAt: at });

  it('has the run summary, settings and overall detection scores', () => {
    expect(md).toContain('# Cross-Source Desk report');
    expect(md).toContain('k = 5, δ = 0.85, τ_dup = 0.20, τ_uniq = 0.20');
    expect(md).toContain('(73 → 29)');
    expect(md).toContain('| 0.9231 | 1.0000 | 0.9600 | 12 | 1 | 0 |');
  });

  it('has every story with its summary, coverage table, exclusives and article summaries', () => {
    for (const c of result.clusters) {
      expect(md).toContain(`## ${c.name}`);
      c.summary.forEach((s, i) => expect(md).toContain(`${i + 1}. ${mdText(s)} *(${mdText(c.summary_from[i]!)})*`));
      const lines = md.split('\n');
      for (const src of c.sources) {
        const row = lines.find((l) => l.startsWith(`| ${mdText(src)} | `));
        expect(row, `coverage row for ${src}`).toBeDefined();
        expect(row!.split(' | ')).toHaveLength(c.summary.length + 1);
      }
      for (const [src, lines] of Object.entries(c.exclusive)) {
        expect(md).toContain(`**Only in ${src}**`);
        for (const l of lines) expect(md).toContain(`- ${mdText(l)}`);
      }
    }
    expect(md.match(/^### Summary of each article$/gm)).toHaveLength(3);
    expect(md.match(/^\| LEAD-2 baseline \|/gm)).toHaveLength(3);
  });

  it('escapes Markdown syntax in article text', () => {
    const B = String.fromCharCode(92); // a backslash, spelled out so no tool can swallow it
    expect(mdText('a|b *c* _d_ [e](f) <g> `h`')).toBe(`a${B}|b ${B}*c${B}* ${B}_d${B}_ ${B}[e${B}](f) ${B}<g${B}> ${B}\`h${B}\``);
    expect(mdText('# Heading-like')).toBe(`${B}# Heading-like`);
    expect(mdText('1. Ordered-like')).toBe(`1${B}. Ordered-like`);
    expect(mdText('- dash')).toBe(`${B}- dash`);
    expect(mdText('two\nlines')).toBe('two lines');
  });

  it('file names', () => {
    expect(exportFileName('json', at)).toBe('cross-source-results-20261014-0930.json');
    expect(exportFileName('md', at)).toBe('cross-source-report-20261014-0930.md');
  });
});
