// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Paste one article. Same rules as app.py's paste form: optional Source/Event/Title header lines are read,
// a typed outlet name wins over a "Source:" line, and the default name is "Pasted article N".

import { useId, useState, type FormEvent } from 'react';
import { Notice } from '@/components/Notice';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/field';
import { MIN_WORDS, makeArticle } from '@/nlp/sentences';
import { plural } from '@/lib/utils';
import { newId, useWorkspace } from '@/state/workspace';

export function PasteForm() {
  const { state, dispatch } = useWorkspace();
  const [source, setSource] = useState('');
  const [body, setBody] = useState('');
  const [message, setMessage] = useState<{ tone: 'ok' | 'alert'; text: string } | null>(null);
  const id = useId();

  function add(e: FormEvent) {
    e.preventDefault();
    const typed = source.trim();
    const a = makeArticle(body, typed || `Pasted article ${state.articles.length + 1}`);
    if (!a) {
      setMessage({
        tone: 'alert',
        text: `No usable sentences found in that text. Each sentence needs at least ${MIN_WORDS} words.`,
      });
      return;
    }
    if (typed) a.source = typed;
    dispatch({ type: 'add', articles: [{ ...a, id: newId(), origin: 'paste' }] });
    setMessage({ tone: 'ok', text: `Article added from ${a.source} (${plural(a.sents.length, 'sentence')}).` });
    setSource('');
    setBody('');
  }

  return (
    <form onSubmit={add} className="space-y-3" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-source`}>Outlet name</Label>
        <Input
          id={`${id}-source`}
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="e.g. The Hindu"
          autoComplete="off"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-body`}>Article text</Label>
        <Textarea
          id={`${id}-body`}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            if (message?.tone === 'alert') setMessage(null);
          }}
          placeholder="Paste the full article here."
          rows={7}
          aria-describedby={`${id}-help`}
        />
        <p id={`${id}-help`} className="text-xs leading-5 text-ink-muted">
          Optional first lines such as &ldquo;Source: Daily Chronicle&rdquo;, &ldquo;Event: E1&rdquo; or &ldquo;Title: Metro
          line opens&rdquo; are read and removed from the text.
        </p>
      </div>
      <Button type="submit" disabled={!body.trim()}>
        Add article
      </Button>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
    </form>
  );
}
