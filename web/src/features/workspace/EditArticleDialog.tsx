// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Edit an article's outlet, title, event and text. Changing the text re-splits it into sentences with
// app.py's splitter; demo articles then lose their fact labels (precision/recall need them).

import { Pencil } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { Notice } from '@/components/Notice';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Input, Label, Textarea } from '@/components/ui/field';
import { MIN_WORDS, splitSentences } from '@/nlp/sentences';
import { useWorkspace, type WorkspaceArticle } from '@/state/workspace';

export function EditArticleDialog({ article, displayName }: { article: WorkspaceArticle; displayName: string }) {
  const { dispatch } = useWorkspace();
  const [open, setOpen] = useState(false);
  const originalText = article.sents.map(([s]) => s).join(' ');
  const [source, setSource] = useState(article.source);
  const [title, setTitle] = useState(article.title);
  const [event, setEvent] = useState(article.event ?? '');
  const [text, setText] = useState(originalText);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const hasFacts = article.sents.some(([, f]) => f !== null);

  function reset() {
    setSource(article.source);
    setTitle(article.title);
    setEvent(article.event ?? '');
    setText(originalText);
    setError(null);
  }

  function save(e: FormEvent) {
    e.preventDefault();
    if (!source.trim()) {
      setError('Give the outlet a name.');
      return;
    }
    let sents = article.sents;
    if (text !== originalText) {
      const split = splitSentences(text);
      if (split.length === 0) {
        setError(`No usable sentences. Each sentence needs at least ${MIN_WORDS} words.`);
        return;
      }
      sents = split.map((s) => [s, null] as const);
    }
    dispatch({
      type: 'update',
      id: article.id,
      patch: { source: source.trim(), title: title.trim(), event: event.trim() || null, sents },
    });
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) reset();
        setOpen(o);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="quiet" size="icon" aria-label={`Edit ${displayName}`} title={`Edit ${displayName}`}>
          <Pencil aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent title={`Edit ${displayName}`} description="Changes apply the next time you run the summarizer.">
        <form onSubmit={save} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-source`}>Outlet</Label>
            <Input id={`${id}-source`} value={source} onChange={(e) => setSource(e.target.value)} aria-invalid={!source.trim()} />
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-title`}>Title (optional)</Label>
              <Input id={`${id}-title`} value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-event`}>Event (optional)</Label>
              <Input id={`${id}-event`} value={event} onChange={(e) => setEvent(e.target.value)} aria-describedby={`${id}-event-help`} />
            </div>
          </div>
          <p id={`${id}-event-help`} className="-mt-2 text-xs text-ink-muted">
            When every article has an event label, the app scores how well articles were grouped into stories.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-text`}>Text</Label>
            <Textarea id={`${id}-text`} value={text} onChange={(e) => setText(e.target.value)} rows={10} className="font-serif text-base leading-7" />
          </div>
          {hasFacts && text !== originalText && (
            <Notice tone="info">
              This is a demo article with fact labels. Saving new text removes them, so precision and recall can no
              longer be scored.
            </Notice>
          )}
          {error && <Notice tone="alert">{error}</Notice>}
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="quiet">Cancel</Button>
            </DialogClose>
            <Button type="submit" variant="primary">
              Save changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
