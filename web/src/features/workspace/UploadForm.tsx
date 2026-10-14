// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Add articles from files: pick or drop several .txt / .md / .pdf / .docx files (one per outlet).
// Files are read one after another; each one that fails is listed with its reason.

import { FileUp, Loader2 } from 'lucide-react';
import { useId, useRef, useState, type DragEvent } from 'react';
import { Notice } from '@/components/Notice';
import { Button } from '@/components/ui/button';
import { reason } from '@/ingest/errors';
import { ACCEPT_ATTR, articleFromFile } from '@/ingest/files';
import { cn, plural } from '@/lib/utils';
import { newId, useWorkspace, type WorkspaceArticle } from '@/state/workspace';

interface Outcome {
  added: string[];
  failed: { name: string; why: string }[];
}

export function UploadForm() {
  const { dispatch } = useWorkspace();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; name: string } | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const id = useId();

  async function addFiles(files: File[]) {
    if (files.length === 0 || progress) return;
    setOutcome(null);
    const added: WorkspaceArticle[] = [];
    const failed: Outcome['failed'] = [];
    for (const [i, f] of files.entries()) {
      setProgress({ done: i, total: files.length, name: f.name });
      try {
        const a = await articleFromFile(f);
        added.push({ ...a, id: newId(), origin: 'file', from: f.name });
      } catch (e) {
        failed.push({ name: f.name, why: reason(e) });
      }
    }
    if (added.length) dispatch({ type: 'add', articles: added });
    setProgress(null);
    setOutcome({ added: added.map((a) => a.source), failed });
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    void addFiles([...e.dataTransfer.files]);
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center gap-2 rounded-control border-2 border-dashed px-4 py-6 text-center transition-colors',
          dragging ? 'border-pencil bg-pencil-wash' : 'border-rule bg-paper',
        )}
      >
        <FileUp aria-hidden className="size-6 text-ink-muted" />
        <p className="text-sm text-ink">Drop article files here, one file per outlet</p>
        <input
          ref={input}
          id={`${id}-files`}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          aria-label="Article files (.txt, .md, .pdf or .docx)"
          tabIndex={-1}
          className="sr-only"
          onChange={(e) => {
            void addFiles([...(e.target.files ?? [])]);
            e.target.value = '';
          }}
        />
        <Button onClick={() => input.current?.click()} disabled={progress !== null} aria-describedby={`${id}-help`}>
          {progress ? <Loader2 aria-hidden className="animate-spin" /> : null}
          {progress ? `Reading ${progress.done + 1} of ${progress.total}…` : 'Choose files'}
        </Button>
        <p id={`${id}-help`} className="text-xs leading-5 text-ink-muted">
          .txt, .md, .pdf or .docx. A first line such as &ldquo;Source: Times of India&rdquo; sets the outlet name;
          otherwise the file name is used.
        </p>
      </div>
      {progress && (
        <p className="sr-only" role="status">
          Reading {progress.name}
        </p>
      )}
      {outcome && outcome.added.length > 0 && (
        <Notice tone="ok">
          Added {plural(outcome.added.length, 'article')}: {outcome.added.join(', ')}.
        </Notice>
      )}
      {outcome && outcome.failed.length > 0 && (
        <Notice tone="alert">
          <p>Could not read {plural(outcome.failed.length, 'file')}:</p>
          <ul className="mt-1 space-y-1">
            {outcome.failed.map((f) => (
              <li key={f.name}>
                <span className="font-semibold">{f.name}</span>: {f.why}
              </li>
            ))}
          </ul>
        </Notice>
      )}
    </div>
  );
}
