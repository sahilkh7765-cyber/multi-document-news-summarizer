// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Every desk control: paste, edit, remove, clear, demo corpus, settings (keyboard and pointer), restore
// defaults, run states and the theme switch.

import { expect, freshDesk, noHorizontalOverflow, test } from './fixtures';

test('empty and disabled states', async ({ page }) => {
  await freshDesk(page);
  await expect(page.getByRole('button', { name: 'Run summarizer' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Clear all' })).toBeDisabled();
  await expect(page.getByText('Add at least one article to run the summarizer.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bring in the copy' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restore defaults' })).toBeDisabled();
});

test('paste: validation, header lines, typed outlet name, default name', async ({ page }) => {
  await freshDesk(page);
  await page.getByRole('tab', { name: 'Paste' }).click();
  const add = page.getByRole('button', { name: 'Add article' });
  await expect(add).toBeDisabled();

  await page.getByLabel('Article text').fill('Too short. Nope.');
  await add.click();
  await expect(page.getByRole('alert')).toContainText('No usable sentences');

  await page.getByLabel('Outlet name').fill('Test Wire');
  await page.getByLabel('Article text').fill('Source: Ignored\nEvent: X1\nThe council approved the new budget on Monday evening. Members argued about road repairs for hours.');
  await add.click();
  await expect(page.getByRole('status').filter({ hasText: 'Article added from Test Wire (2 sentences)' })).toBeVisible();
  await expect(page.getByLabel('Article text')).toHaveValue('');
  const list = page.getByRole('list', { name: 'Articles' });
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await expect(list).toContainText('X1, 2 sentences');
  await expect(page.getByText('One article can be summarized')).toBeVisible();

  await page.getByLabel('Article text').fill('A second report says the council approved the budget late on Monday.');
  await add.click();
  await expect(list).toContainText('Pasted article 2');
});

test('edit, remove, clear all, demo corpus with confirmation', async ({ page }) => {
  await freshDesk(page);
  await page.getByRole('button', { name: 'Load demo corpus' }).click();
  const list = page.getByRole('list', { name: 'Articles' });
  await expect(list.getByRole('listitem')).toHaveCount(12);
  await expect(list).toContainText('Nagar Times (3)');

  // edit: rename, then reject text without sentences
  await page.getByRole('button', { name: 'Edit Metro Mirror (2)' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Edit Metro Mirror (2)' })).toBeVisible();
  await dialog.getByLabel('Outlet', { exact: true }).fill('Sports Mirror');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).toBeHidden();
  await expect(list).toContainText('Sports Mirror');
  await page.getByRole('button', { name: 'Edit Sports Mirror' }).click();
  await dialog.getByLabel('Text', { exact: true }).fill('tiny');
  await expect(dialog.getByText('Saving new text removes them')).toBeVisible();
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog.getByRole('alert')).toContainText('No usable sentences');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  // remove
  await page.getByRole('button', { name: 'Remove Civic Herald (3)' }).click();
  await expect(list.getByRole('listitem')).toHaveCount(11);

  // demo again asks first; cancel keeps the desk
  await page.getByRole('button', { name: 'Load demo corpus' }).click();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(list.getByRole('listitem')).toHaveCount(11);
  await page.getByRole('button', { name: 'Load demo corpus' }).click();
  await dialog.getByRole('button', { name: 'Load demo corpus' }).click();
  await expect(list.getByRole('listitem')).toHaveCount(12);

  // clear all asks first
  await page.getByRole('button', { name: 'Clear all' }).click();
  await expect(dialog).toContainText('Remove all 12 articles?');
  await dialog.getByRole('button', { name: 'Remove all' }).click();
  await expect(page.getByText('No articles yet')).toBeVisible();
});

test('settings: ranges, keyboard, pointer, change hints, restore defaults', async ({ page }) => {
  await freshDesk(page);
  const sliders = [
    [/Sentences in the consensus summary/, '5', '2', '10'],
    [/Story grouping/, '0.85', '0.50', '0.99'],
    [/Duplicate threshold/, '0.20', '0.05', '0.60'],
    [/Exclusivity threshold/, '0.20', '0.05', '0.60'],
  ] as const;
  for (const [name, def, min, max] of sliders) {
    const s = page.getByRole('slider', { name });
    await expect(s).toHaveAttribute('aria-valuetext', def);
    await s.focus();
    await page.keyboard.press('Home');
    await expect(s).toHaveAttribute('aria-valuetext', min);
    await page.keyboard.press('End');
    await expect(s).toHaveAttribute('aria-valuetext', max);
  }
  await page.getByRole('button', { name: 'Restore defaults' }).click();
  for (const [name, def] of sliders) await expect(page.getByRole('slider', { name })).toHaveAttribute('aria-valuetext', def);

  // run, then change a setting with the pointer -> hint; restoring removes it
  await page.getByRole('button', { name: 'Load demo corpus' }).click();
  await page.getByRole('button', { name: 'Run summarizer' }).click();
  await expect(page.getByText(/Summarized 12 articles/)).toBeVisible();
  const track = page.getByRole('slider', { name: /Exclusivity threshold/ }).locator('xpath=ancestor::span[@data-orientation][1]');
  // keep it clear of the sticky run bar at the bottom of the desk
  await track.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const box = (await track.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.9, box.y + box.height / 2);
  await expect(page.getByText('Settings changed. Run again to update the results.')).toBeVisible();
  await page.getByRole('button', { name: 'Restore defaults' }).click();
  await expect(page.getByText('Settings changed')).toBeHidden();
  await noHorizontalOverflow(page);
});

test('theme switch, remembered on reload', async ({ page }) => {
  await freshDesk(page);
  const before = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.getByRole('button', { name: /Switch to (dark|light) theme/ }).click();
  const after = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(after).not.toBe(before);
  const theme = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
});
