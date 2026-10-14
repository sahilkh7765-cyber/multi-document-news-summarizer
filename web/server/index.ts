// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Optional URL helper. Browsers cannot read other sites' pages directly, so this tiny server fetches
// a page and returns its HTML; the app extracts the article paragraphs itself.
//
//   GET /api/fetch?url=https://...   ->  { html, finalUrl }  or  { error }
//
// Like app.py's read_url: User-Agent "Mozilla/5.0", 20 s timeout, body decoded as UTF-8 ignoring bad
// bytes. Safety for a local tool: listens on 127.0.0.1 only, sends no CORS headers (other websites cannot
// read its answers), refuses loopback/private/link-local targets (re-checked on every redirect) and
// stops reading after 5 MB. If dist/ exists (npm run build), the built app is served too.
//
// Run with Node 22.18+ (TypeScript types are stripped natively):  node server/index.ts

import { lookup } from 'node:dns/promises';
import { existsSync } from 'node:fs';
import { isIP } from 'node:net';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';

const PORT = Number(process.env.PORT ?? 8787);
const HOST = '127.0.0.1';
const TIMEOUT_MS = 20_000;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 5;

class FetchFailure extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number) as [number, number];
    return (
      a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith('::ffff:')) return isPrivateAddress(v6.slice(7));
  return v6 === '::' || v6 === '::1' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80');
}

async function assertPublic(url: URL): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new FetchFailure('Only http:// and https:// addresses can be fetched.', 400);
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  let addresses: string[];
  try {
    addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((r) => r.address);
  } catch {
    throw new FetchFailure(`Could not find the site "${url.hostname}" (DNS lookup failed). Check the address.`);
  }
  if (addresses.some(isPrivateAddress)) {
    throw new FetchFailure('That address points to this computer or a private network, which the helper does not fetch.', 400);
  }
}

async function readCapped(res: Response): Promise<Uint8Array> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw new FetchFailure('The page is larger than 5 MB.');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

async function fetchPage(raw: string): Promise<{ html: string; finalUrl: string }> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new FetchFailure('That is not a valid web address.', 400);
  }
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublic(url);
    let res: Response;
    try {
      res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'manual', signal });
    } catch (e) {
      if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
        throw new FetchFailure('The site took longer than 20 seconds to answer.', 504);
      }
      const cause = e instanceof Error && e.cause instanceof Error ? ` (${e.cause.message})` : '';
      throw new FetchFailure(`Could not connect to the site${cause}.`);
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = new URL(res.headers.get('location')!, url);
      continue;
    }
    if (!res.ok) {
      const hint = res.status === 401 || res.status === 403 ? ' The site blocks automated readers or needs a login.' : '';
      throw new FetchFailure(`The site answered ${res.status} ${res.statusText}.${hint}`);
    }
    const type = (res.headers.get('content-type') ?? '').toLowerCase();
    if (type && !type.includes('html') && !type.includes('xml') && !type.startsWith('text/')) {
      throw new FetchFailure(`That address is not a web page (it returned ${type.split(';')[0]}).`);
    }
    const bytes = await readCapped(res);
    // bytes.decode('utf-8', errors='ignore')
    const html = new TextDecoder('utf-8').decode(bytes).replaceAll('\uFFFD', '');
    return { html, finalUrl: url.toString() };
  }
  throw new FetchFailure('The site redirected too many times.');
}

const app = new Hono();

app.get('/api/fetch', async (c) => {
  const raw = c.req.query('url');
  if (!raw) return c.json({ error: 'Give a url parameter.' }, 400);
  try {
    return c.json(await fetchPage(raw));
  } catch (e) {
    if (e instanceof FetchFailure) return c.json({ error: e.message }, e.status as 400 | 502 | 504);
    return c.json({ error: 'The helper failed unexpectedly.' }, 500);
  }
});

app.get('/api/health', (c) => c.json({ ok: true }));

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
if (existsSync(dist)) {
  app.use('/*', serveStatic({ root: dist }));
  app.get('*', serveStatic({ path: dist + 'index.html' }));
}

serve({ fetch: app.fetch, port: PORT, hostname: HOST }, (info) => {
  console.log(`URL helper listening on http://${HOST}:${info.port}${existsSync(dist) ? ' (also serving dist/)' : ''}`);
});
