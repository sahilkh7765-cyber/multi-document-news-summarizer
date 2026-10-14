// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Accessibility: axe-core (WCAG 2.1 A/AA, including colour contrast) on the main states in both themes,
// a visible focus ring on every keyboard stop, and reduced motion honoured.

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, freshDesk, runDemo, test } from './fixtures';

async function axe(page: Page, label: string): Promise<void> {
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const problems = res.violations.map(
    (v) => `${v.id} (${v.impact}): ${v.help} -> ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`,
  );
  expect(problems, `axe violations: ${label}`).toEqual([]);
}

for (const scheme of ['light', 'dark'] as const) {
  test(`axe: empty desk, results, open dialog (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await freshDesk(page);
    await axe(page, 'empty desk');
    await runDemo(page);
    await axe(page, 'demo results');
    await page.getByRole('tab', { name: /E3/ }).click();
    await page.getByRole('tabpanel').locator('details summary').first().click();
    await axe(page, 'results, E3, disclosure open');
    await page.getByRole('button', { name: 'Edit Nagar Times', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await axe(page, 'edit dialog');
  });
}

test('every keyboard stop shows a focus ring', async ({ page }) => {
  await freshDesk(page);
  await runDemo(page);
  const seen = new Set<string>();
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const s = getComputedStyle(el);
      const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2) || s.boxShadow !== 'none';
      const name = (el.getAttribute('aria-label') ?? el.textContent ?? el.tagName).trim().slice(0, 40);
      return { name: `${el.tagName}:${name}`, ring };
    });
    if (!info) continue;
    seen.add(info.name);
    expect(info.ring, `focus ring on ${info.name}`).toBe(true);
  }
  expect(seen.size).toBeGreaterThan(20);
});

test('reduced motion turns animations off', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await freshDesk(page);
  await runDemo(page);
  const durations = await page.locator('.lede-line').evaluateAll((els) => els.map((e) => getComputedStyle(e).animationDuration));
  expect(durations.length).toBeGreaterThan(0);
  for (const d of durations) expect(parseFloat(d)).toBeLessThan(0.001);
});
