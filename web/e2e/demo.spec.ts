// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// The demo corpus at the default settings: every number on screen must match metrics.json (written by
// NLPCapstone.py), at every width. Also saves full-page screenshots in both themes for review.

import { expect, freshDesk, metrics, noHorizontalOverflow, runDemo, SHOTS, test } from './fixtures';

const pct = (100 * (1 - metrics.tot_p / metrics.tot_s)).toFixed(1);

test('demo run shows the metrics.json numbers', async ({ page }) => {
  await freshDesk(page);
  await runDemo(page);
  const proof = page.locator('#proof');

  const summary = proof.getByText(/articles grouped into/);
  await expect(summary).toContainText(`12 articles grouped into 3 stories`);
  await expect(summary).toContainText(`${pct} % of sentences (${metrics.tot_s} → ${metrics.tot_p})`);
  await expect(summary).toContainText(metrics.cluster_acc.toFixed(4));

  const overall = proof.locator('section[aria-labelledby="overall-divergence"] dd');
  await expect(overall).toHaveText([
    metrics.P.toFixed(4),
    metrics.R.toFixed(4),
    metrics.F.toFixed(4),
    `${metrics.TP} / ${metrics.FP} / ${metrics.FN}`,
  ]);

  const tabs = page.getByRole('tab', { name: /outlets$/ });
  await expect(tabs).toHaveCount(3);
  for (const [i, o] of metrics.outputs.entries()) {
    await tabs.nth(i).click();
    await expect(tabs.nth(i)).toHaveAttribute('aria-selected', 'true');
    const panel = page.getByRole('tabpanel');
    await expect(tabs.nth(i)).toContainText(o.event);
    await expect(panel.locator('header p')).toContainText(`${o.n_sent} sentences, ${o.pool} left`);
    await expect(panel.locator('header p')).toContainText(o.keywords.join(', '));
    const lede = panel.getByRole('list', { name: 'Consensus summary' }).locator(':scope > li');
    await expect(lede).toHaveCount(o.summary_sents.length);
    for (const [j, s] of o.summary_sents.entries()) await expect(lede.nth(j)).toContainText(s);
    for (const [src, lines] of Object.entries(o.exclusive)) {
      // metrics.json uses raw outlet names; on screen E2/E3 outlets carry the (2)/(3) suffix
      const block = panel.locator('h4').filter({ hasText: new RegExp(`^Only in ${src}( \\(\\d\\))?$`) }).locator('..');
      for (const l of lines) await expect(block).toContainText(l);
    }
  }
});

test('threshold sweep table totals match metrics.json', async ({ page }) => {
  await freshDesk(page);
  await runDemo(page);
  // per-story tables: sum the "Flagged" column across the three stories for each threshold
  const flagged = new Map<string, number>();
  const tabs = page.getByRole('tab', { name: /outlets$/ });
  for (let i = 0; i < 3; i++) {
    await tabs.nth(i).click();
    const rows = page.getByRole('tabpanel').locator('table').filter({ hasText: 'Threshold sensitivity' }).locator('tbody tr');
    await expect(rows).toHaveCount(6);
    for (let r = 0; r < 6; r++) {
      const t = (await rows.nth(r).locator('th').innerText()).slice(0, 4);
      const det = Number(await rows.nth(r).locator('td').first().innerText());
      flagged.set(t, (flagged.get(t) ?? 0) + det);
    }
  }
  for (const [t, det] of metrics.sweep) expect(flagged.get(t.toFixed(2)), `flagged at ${t}`).toBe(det);
});

for (const scheme of ['light', 'dark'] as const) {
  test(`screenshots (${scheme})`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await freshDesk(page);
    await noHorizontalOverflow(page);
    await page.screenshot({ path: `${SHOTS}${info.project.name}-${scheme}-empty.png`, fullPage: true });
    await runDemo(page);
    await noHorizontalOverflow(page);
    await page.screenshot({ path: `${SHOTS}${info.project.name}-${scheme}-demo.png`, fullPage: true });
    await page.locator('#proof').screenshot({ path: `${SHOTS}${info.project.name}-${scheme}-proof.png` });
  });
}
