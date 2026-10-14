// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Add articles from web addresses (one per line) through the local URL helper. Each address that fails
// is listed with the reason the helper or the page gave.

import { Globe, Loader2 } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { Notice } from '@/components/Notice';
import { Button } from '@/components/ui/button';
import { Label, Textarea } from '@/components/ui/field';
import { reason } from '@/ingest/errors';
import { articleFromUrl, parseUrlList } from '@/ingest/url';
import { plural } from '@/lib/utils';
import { newId, useWorkspace, type WorkspaceArticle } from '@/state/workspace';

interface Outcome {
  added: string[];
  failed: { url: string; why: string }[];
}

export function UrlForm() {
  const { dispatch } = useWorkspace();
  const [text, setText] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const id = useId();
  const urls = parseUrlList(text);

  async function fetchAll(e: FormEvent) {
    e.preventDefault();
    if (urls.length === 0 || progress) return;
    setOutcome(null);
    const added: WorkspaceArticle[] = [];
    const failed: Outcome['failed'] = [];
    for (const [i, u] of urls.entries()) {
      setProgress({ done: i, total: urls.length });
      try {
        const a = await articleFromUrl(u);
        added.push({ ...a, id: newId(), origin: 'url', from: u });
      } catch (err) {
        failed.push({ url: u, why: reason(err) });
      }
    }
    if (added.length) dispatch({ type: 'add', articles: added });
    setProgress(null);
    setOutcome({ added: added.map((a) => a.source), failed });
    // keep only the addresses that failed, so they can be corrected and retried
    setText(failed.map((f) => f.url).join('\n'));
  }

  return (
    <form onSubmit={fetchAll} className="space-y-3" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-urls`}>Web addresses, one per line</Label>
        <Textarea
          id={`${id}-urls`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="https://"
          rows={4}
          spellCheck={false}
          aria-describedby={`${id}-help`}
        />
        <p id={`${id}-help`} className="text-xs leading-5 text-ink-muted">
          Pages are fetched by the URL helper running on this computer (npm run server). Paragraph text is kept;
          pages that need JavaScript or a login may come back empty.
        </p>
      </div>
      <Button type="submit" disabled={urls.length === 0 || progress !== null}>
        {progress ? <Loader2 aria-hidden className="animate-spin" /> : <Globe aria-hidden />}
        {progress ? `Fetching ${progress.done + 1} of ${progress.total}…` : urls.length > 1 ? `Fetch ${urls.length} articles` : 'Fetch article'}
      </Button>
      {outcome && outcome.added.length > 0 && (
        <Notice tone="ok">
          Fetched {plural(outcome.added.length, 'article')}: {outcome.added.join(', ')}.
        </Notice>
      )}
      {outcome && outcome.failed.length > 0 && (
        <Notice tone="alert">
          <p>Could not fetch {plural(outcome.failed.length, 'address', 'addresses')} (left in the box to retry):</p>
          <ul className="mt-1 space-y-1">
            {outcome.failed.map((f) => (
              <li key={f.url} className="break-words">
                <span className="font-semibold">{f.url}</span>: {f.why}
              </li>
            ))}
          </ul>
        </Notice>
      )}
    </form>
  );
}
