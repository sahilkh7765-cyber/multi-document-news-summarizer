// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Fetch an article through the local URL helper (server/index.ts). Browsers block reading other sites
// directly, so the helper fetches the page and the text is extracted here with paragraphsFromHtml.

import type { Article } from '@/nlp/types';
import { IngestError } from './errors';
import { articleFromText } from './files';
import { paragraphsFromHtml, sourceFromUrl } from './html';

export interface FetchReply {
  html?: string;
  finalUrl?: string;
  error?: string;
}

export function parseUrlList(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((u) => u.trim())
    .filter(Boolean);
}

export async function articleFromUrl(url: string, signal?: AbortSignal): Promise<Article> {
  if (!/^https?:\/\//i.test(url)) throw new IngestError('Only http:// and https:// addresses can be fetched.');
  let res: Response;
  try {
    res = await fetch(`/api/fetch?url=${encodeURIComponent(url)}`, signal ? { signal } : {});
  } catch {
    throw new IngestError('The URL helper is not reachable. Start it with "npm run server" (see the README).');
  }
  let body: FetchReply;
  try {
    body = (await res.json()) as FetchReply;
  } catch {
    // e.g. the dev server's proxy answering 502/504 because the helper is not running
    throw new IngestError('The URL helper is not running. Start it with "npm run server" (see the README).');
  }
  if (!res.ok || body.error || body.html === undefined) {
    throw new IngestError(body.error ?? `The helper answered with status ${res.status}.`);
  }
  const text = paragraphsFromHtml(body.html);
  if (!text.trim()) {
    throw new IngestError('No article paragraphs were found on that page. It may need JavaScript to show its text, or be behind a login.');
  }
  return articleFromText(text, sourceFromUrl(url));
}
