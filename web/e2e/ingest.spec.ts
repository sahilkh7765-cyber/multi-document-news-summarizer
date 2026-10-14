// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Real files (.txt, .md, .pdf with a text layer, .docx) through the picker and by drag and drop, the
// rejection messages for bad files, and URLs through the local helper. The only console lines allowed
// are the helper's deliberate 400/502 answers for the bad addresses, counted exactly.

import { readFileSync } from 'node:fs';
import { ASSETS, expect, freshDesk, test } from './fixtures';

const BAD_GATEWAY = 'error: Failed to load resource: the server responded with a status of 502 (Bad Gateway)';
const BAD_REQUEST = 'error: Failed to load resource: the server responded with a status of 400 (Bad Request)';

test('upload .txt, .md and .pdf with the picker, .docx by drag and drop, then run', async ({ page }) => {
  await freshDesk(page);
  const list = page.getByRole('list', { name: 'Articles' });
  await page.locator('input[type=file]').setInputFiles(['city-wire.txt', 'morning-ledger.md', 'harbour-post.pdf'].map((f) => ASSETS + f));
  await expect(page.getByRole('status').filter({ hasText: 'Added 3 articles: City Wire, Morning Ledger, Harbour Post.' })).toBeVisible();
  await expect(list.getByRole('listitem').filter({ hasText: 'Harbour Post' })).toContainText('L1, 5 sentences');

  const b64 = readFileSync(ASSETS + 'evening-herald.docx').toString('base64');
  const dt = await page.evaluateHandle((data) => {
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const d = new DataTransfer();
    d.items.add(new File([bytes], 'evening-herald.docx'));
    return d;
  }, b64);
  const zone = page.getByText('Drop article files here').locator('..');
  await zone.dispatchEvent('dragover', { dataTransfer: dt });
  await zone.dispatchEvent('drop', { dataTransfer: dt });
  await expect(page.getByRole('status').filter({ hasText: 'Added 1 article: Evening Herald.' })).toBeVisible();
  await expect(list.getByRole('listitem').filter({ hasText: 'Evening Herald' })).toContainText('L1, 4 sentences');

  await page.getByRole('button', { name: 'Run summarizer' }).click();
  await expect(page.getByRole('tab', { name: /L1/ })).toBeVisible();
  // an exclusive detail may also be picked for the consensus summary (as in app.py), so look in its section
  const panel = page.getByRole('tabpanel').locator('section', { hasText: 'Reported by one outlet only' });
  await expect(panel.getByText('Membership fees for students have been waived for the first year.')).toBeVisible();
  await expect(panel.getByText('Several staff members said the old card catalogue has been fully digitised.')).toBeVisible();
  await expect(panel.getByText('Some residents complained that parking near the library is still very limited.')).toBeVisible();
  await expect(panel.getByText('Nothing exclusive from City Wire.')).toBeVisible();
});

test('bad files are rejected with a reason and add nothing', async ({ page }) => {
  await freshDesk(page);
  await page.locator('input[type=file]').setInputFiles(['scanned-page.pdf', 'damaged.pdf', 'not-word.docx', 'empty.txt', 'notes.rtf'].map((f) => ASSETS + f));
  const alert = page.getByRole('alert').filter({ hasText: 'Could not read 5 files' });
  await expect(alert).toContainText('scanned-page.pdf: This PDF has no text layer; it is probably a scanned image.');
  await expect(alert).toContainText('damaged.pdf: This file could not be opened as a PDF.');
  await expect(alert).toContainText('not-word.docx: This file could not be opened as a Word document.');
  await expect(alert).toContainText('empty.txt: The file is empty.');
  await expect(alert).toContainText('notes.rtf: Unsupported file type .rtf.');
  await expect(page.getByText('No articles yet')).toBeVisible();
});

test('URLs: one fetched, each failure explained, failures kept for retry', async ({ page, allowConsole }) => {
  allowConsole(BAD_GATEWAY, 2); // 404 page, unknown domain
  allowConsole(BAD_REQUEST, 1); // localhost is refused
  await freshDesk(page);
  await page.getByRole('tab', { name: 'From URL' }).click();
  const box = page.getByLabel('Web addresses, one per line');
  await box.fill(
    ['https://example.com/', 'https://httpbin.org/status/404', 'https://no-such-host-xyz123.invalid/', 'http://localhost:5173/', 'ftp://example.com/x'].join('\n'),
  );
  await page.getByRole('button', { name: 'Fetch 5 articles' }).click();
  const alert = page.getByRole('alert').filter({ hasText: 'Could not fetch 4 addresses' });
  await expect(alert).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('status').filter({ hasText: 'Fetched 1 article: example.com.' })).toBeVisible();
  await expect(alert).toContainText('https://httpbin.org/status/404: The site answered 404');
  await expect(alert).toContainText('no-such-host-xyz123.invalid/: Could not find the site');
  await expect(alert).toContainText('http://localhost:5173/: That address points to this computer or a private network');
  await expect(alert).toContainText('ftp://example.com/x: Only http:// and https:// addresses can be fetched.');
  await expect(box).toHaveValue(/^https:\/\/httpbin\.org\/status\/404\n/);
  expect((await box.inputValue()).split('\n')).toHaveLength(4);
  await expect(page.getByRole('list', { name: 'Articles' })).toContainText('example.com');
});

test('URL helper not running: says how to start it', async ({ page, allowConsole }) => {
  allowConsole(BAD_GATEWAY, 1); // what the dev proxy answers when the helper is down
  await page.route('**/api/fetch**', (r) => r.fulfill({ status: 502, contentType: 'text/plain', body: 'proxy error' }));
  await freshDesk(page);
  await page.getByRole('tab', { name: 'From URL' }).click();
  await page.getByLabel('Web addresses, one per line').fill('https://example.com/');
  await page.getByRole('button', { name: 'Fetch article' }).click();
  await expect(page.getByRole('alert')).toContainText('The URL helper is not running. Start it with "npm run server"');
});
