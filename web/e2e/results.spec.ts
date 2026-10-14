// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Results controls: story tabs (pointer and keyboard), coverage (table, or per-sentence blocks on phones),
// per-article disclosures, the reference box and ROUGE, the sweep chart (hover and keyboard), and a
// single-outlet story.

import { expect, freshDesk, noHorizontalOverflow, runDemo, test } from './fixtures';

test('story tabs work with the keyboard', async ({ page }) => {
  await freshDesk(page);
  await runDemo(page);
  const tabs = page.getByRole('tab', { name: /outlets$/ });
  await tabs.first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home');
  await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
});

test('coverage: table on wide screens, sentence blocks on phones', async ({ page }, info) => {
  await freshDesk(page);
  await runDemo(page);
  const panel = page.getByRole('tabpanel');
  const table = panel.getByRole('table', { name: 'Which outlet reports each summary sentence' });
  if (info.project.name === 'phone-390') {
    await expect(table).toBeHidden();
    const blocks = panel.locator('section', { hasText: 'Coverage across outlets' }).locator('ol > li');
    await expect(blocks).toHaveCount(5);
    await expect(blocks.first()).toContainText('S1 reported by 4 of 4');
  } else {
    await expect(table).toBeVisible();
    await expect(table.locator('tbody tr')).toHaveCount(4);
    await expect(table.locator('tbody tr').first()).toContainText('3 of 5');
  }
  await noHorizontalOverflow(page);
});

test('per-article summaries open and close', async ({ page }) => {
  await freshDesk(page);
  await runDemo(page);
  const details = page.getByRole('tabpanel').locator('details');
  await expect(details).toHaveCount(4);
  const first = details.first();
  await first.locator('summary').click();
  await expect(first).toHaveAttribute('open', '');
  await expect(first.locator('li')).toHaveCount(3);
  await first.locator('summary').press('Enter');
  await expect(first).not.toHaveAttribute('open', '');
});

test('reference box drives ROUGE; Distinct always shown', async ({ page }) => {
  await freshDesk(page);
  await runDemo(page);
  const panel = page.getByRole('tabpanel');
  const ref = panel.getByLabel(/Reference summary/);
  await expect(ref).not.toHaveValue(''); // demo mode prefills the reference, as app.py does
  await expect(panel.getByRole('rowheader', { name: 'ROUGE-1' })).toBeVisible();
  await ref.fill('');
  await expect(panel.getByRole('rowheader', { name: 'ROUGE-1' })).toHaveCount(0);
  await expect(panel.getByRole('rowheader', { name: 'Distinct-1' })).toBeVisible();
  await ref.fill('State XI won the final.');
  await expect(panel.getByRole('rowheader', { name: 'ROUGE-L' })).toBeVisible();
  await expect(panel.getByText(/Ties in the keyword and per-article rankings are broken deterministically/)).toBeVisible();
});

test('sweep chart: keyboard and pointer show values', async ({ page }, info) => {
  await freshDesk(page);
  await runDemo(page);
  const panel = page.getByRole('tabpanel');
  const chart = panel.getByRole('group', { name: /How the exclusivity threshold/ });
  await chart.focus();
  await page.keyboard.press('ArrowRight');
  const tip = panel.getByRole('status').filter({ hasText: /τ_uniq 0\.10/ });
  await expect(tip).toContainText('Precision');
  await page.keyboard.press('ArrowRight');
  await expect(panel.getByRole('status').filter({ hasText: /τ_uniq 0\.15/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel.getByRole('status').filter({ hasText: /τ_uniq/ })).toHaveCount(0);
  // the last precision marker sits at tau_uniq 0.40
  const marker = (await chart.locator('circle').last().boundingBox())!;
  const [mx, my] = [marker.x + marker.width / 2, marker.y + marker.height / 2];
  if (info.project.use.hasTouch) await page.touchscreen.tap(mx, my);
  else await page.mouse.move(mx, my);
  await expect(panel.getByRole('status').filter({ hasText: /τ_uniq 0\.40/ })).toBeVisible();
});

test('a story with one outlet says there is nothing to compare', async ({ page }) => {
  await freshDesk(page);
  await page.getByRole('button', { name: 'Load demo corpus' }).click();
  await page.getByRole('tab', { name: 'Paste' }).click();
  await page.getByLabel('Outlet name').fill('Arts Review');
  await page.getByLabel('Article text').fill('The youth orchestra performed Mahler to a sold out auditorium on Saturday. Conductor Lina Duarte drew sustained applause after the final movement.');
  await page.getByRole('button', { name: 'Add article' }).click();
  await page.getByRole('button', { name: 'Run summarizer' }).click();
  const single = page.getByRole('tab', { name: /1 outlet$/ });
  await single.click();
  const panel = page.getByRole('tabpanel');
  await expect(panel.getByRole('heading', { name: /Summary \(single source\)/ })).toBeVisible();
  await expect(panel.getByText('Only one outlet covers this story')).toBeVisible();
  await expect(panel.getByText('Coverage across outlets')).toHaveCount(0);
  // event labels are incomplete now: stories are numbered and accuracy/PRF are not shown
  await expect(page.getByRole('tab', { name: /^Story 1/ })).toBeVisible();
  await expect(page.locator('#proof').getByText('Story grouping agrees')).toHaveCount(0);
  await expect(page.locator('#overall-divergence')).toHaveCount(0);
});

test('phones: "Go to results" jumps past the desk', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone-390', 'the link is only shown below 900px');
  await freshDesk(page);
  await runDemo(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('link', { name: 'Go to results' }).click();
  await expect(page.locator('#proof')).toBeInViewport();
});
