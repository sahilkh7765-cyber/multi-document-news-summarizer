// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Saving in IndexedDB across reloads, and the JSON / Markdown downloads.

import { readFileSync } from 'node:fs';
import { expect, freshDesk, metrics, runDemo, test, waitForSave } from './fixtures';

test('desk, settings, results and references survive a reload', async ({ page }) => {
  await freshDesk(page);
  await page.getByRole('button', { name: 'Load demo corpus' }).click();
  const k = page.getByRole('slider', { name: /Sentences in the consensus summary/ });
  await k.focus();
  await page.keyboard.press('ArrowLeft');
  await page.getByRole('button', { name: 'Run summarizer' }).click();
  await page.getByRole('tab', { name: /E1/ }).click();
  await page.getByRole('tabpanel').getByLabel(/Reference summary/).fill('My own reference for the metro story.');
  await page.getByRole('button', { name: 'Remove Civic Herald (3)' }).click();
  await waitForSave(page);

  await page.reload();
  await expect(page.getByRole('list', { name: 'Articles' }).getByRole('listitem')).toHaveCount(11);
  await expect(k).toHaveAttribute('aria-valuetext', '4');
  await expect(page.getByText('Articles changed. Run again to update the results.')).toBeVisible();
  await page.getByRole('tab', { name: /E1/ }).click();
  await expect(page.getByRole('tabpanel').getByLabel(/Reference summary/)).toHaveValue('My own reference for the metro story.');

  await page.getByRole('button', { name: 'Run again' }).click();
  await expect(page.getByText(/Summarized 11 articles/)).toBeVisible();
  await waitForSave(page);
  await page.reload();
  await expect(page.getByRole('tab').first()).toBeVisible();
  await expect(page.getByText('Articles changed')).toHaveCount(0);
});

test('downloads: Markdown report and JSON results', async ({ page }) => {
  await freshDesk(page);
  await runDemo(page);
  const [md] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download report (.md)' }).click()]);
  expect(md.suggestedFilename()).toMatch(/^cross-source-report-\d{8}-\d{4}\.md$/);
  const text = readFileSync((await md.path())!, 'utf-8');
  expect(text).toContain('# Cross-Source Desk report');
  expect(text).toContain(`| ${metrics.P.toFixed(4)} | ${metrics.R.toFixed(4)} | ${metrics.F.toFixed(4)} | ${metrics.TP} | ${metrics.FP} | ${metrics.FN} |`);
  for (const o of metrics.outputs) expect(text).toContain(`## ${o.event}`);

  const [js] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download results (.json)' }).click()]);
  const data = JSON.parse(readFileSync((await js.path())!, 'utf-8')) as {
    clusters: { name: string; summary: string[] }[];
    cluster_acc: number;
    totals: { prf: number[] };
  };
  expect(data.clusters.map((c) => c.name)).toEqual(metrics.outputs.map((o) => o.event));
  data.clusters.forEach((c, i) => expect(c.summary).toEqual(metrics.outputs[i]!.summary_sents));
  expect(data.cluster_acc).toBe(metrics.cluster_acc);
  expect(data.totals.prf).toEqual([metrics.TP, metrics.FP, metrics.FN]);
  await expect(page.getByText(/^Downloaded cross-source-results-/)).toBeVisible();
});
