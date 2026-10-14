// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Shared test setup. Every test collects console errors/warnings and page errors and fails on any of
// them, except lines a test declares in advance with allowConsole() (used only for the URL helper's
// deliberate 400/502 answers to bad addresses, each with an exact expected count).

import { test as base, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ASSETS = fileURLToPath(new URL('./assets/', import.meta.url));
export const SHOTS = fileURLToPath(new URL('./screenshots/', import.meta.url));

export interface Metrics {
  P: number;
  R: number;
  F: number;
  TP: number;
  FP: number;
  FN: number;
  cluster_acc: number;
  tot_s: number;
  tot_p: number;
  sweep: [number, number, number, number, number][];
  outputs: { event: string; n_sent: number; pool: number; summary_sents: string[]; keywords: string[]; exclusive: Record<string, string[]> }[];
}
export const metrics = JSON.parse(readFileSync(fileURLToPath(new URL('../../metrics.json', import.meta.url)), 'utf-8')) as Metrics;

interface Allowance {
  text: string;
  count: number;
}

export const test = base.extend<{ allowConsole: (text: string, count: number) => void; consoleLog: string[] }>({
  consoleLog: async ({ page }, use) => {
    const log: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') log.push(`${m.type()}: ${m.text()}`);
    });
    page.on('pageerror', (e) => log.push(`pageerror: ${e.message}`));
    await use(log);
  },
  allowConsole: [
    async ({ consoleLog }, use) => {
      const allowed: Allowance[] = [];
      await use((text, count) => allowed.push({ text, count }));
      // exact accounting: each allowed line must appear exactly as often as declared, nothing else may appear
      const remaining = [...consoleLog];
      for (const a of allowed) {
        const hits = remaining.filter((l) => l === a.text);
        expect(hits.length, `expected ${a.count} x "${a.text}"`).toBe(a.count);
        for (let i = 0; i < hits.length; i++) remaining.splice(remaining.indexOf(a.text), 1);
      }
      expect(remaining, 'unexpected console errors/warnings').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Start each test from an empty desk (IndexedDB is per test context, but be explicit). */
export async function freshDesk(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByText(/Saved in this browser|Not saved/).first()).toBeAttached();
  await expect(page.getByText('No articles yet')).toBeVisible();
}

export async function runDemo(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Load demo corpus' }).click();
  await page.getByRole('button', { name: 'Run summarizer' }).click();
  await expect(page.getByRole('tab', { name: /E2/ })).toBeVisible();
}

export async function noHorizontalOverflow(page: Page): Promise<void> {
  const r = await page.evaluate(() => {
    const cw = document.documentElement.clientWidth;
    const sw = document.documentElement.scrollWidth;
    // name the outermost element that sticks out, to make a failure actionable
    let culprit = '';
    if (sw > cw) {
      for (const el of document.querySelectorAll('body *')) {
        const b = el.getBoundingClientRect();
        const pb = el.parentElement!.getBoundingClientRect();
        if (b.right > cw + 1 && pb.right <= cw + 1) {
          culprit = `${el.tagName.toLowerCase()}.${String(el.getAttribute('class')).slice(0, 60)} right=${Math.round(b.right)}`;
          break;
        }
      }
    }
    return { sw, cw, culprit };
  });
  expect(r.sw, `page must not scroll sideways (${r.culprit})`).toBeLessThanOrEqual(r.cw);
}

export async function waitForSave(page: Page): Promise<void> {
  // saves are debounced by 300 ms
  await page.waitForTimeout(700);
}
