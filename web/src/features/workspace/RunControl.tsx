// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// The run button and its state: disabled with no articles, busy while the worker runs, and the
// "settings changed" / "articles changed" hints app.py shows after a run.

import { Loader2, Play } from 'lucide-react';
import { Notice } from '@/components/Notice';
import { Button } from '@/components/ui/button';
import { plural } from '@/lib/utils';
import { sameParams, useWorkspace } from '@/state/workspace';

export function RunControl() {
  const { state, run } = useWorkspace();
  const n = state.articles.length;
  const { last } = state;
  const settingsChanged = last !== null && !sameParams(last.params, state.params);
  const articlesChanged = last !== null && last.revision !== state.revision;

  return (
    <div className="space-y-2">
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={() => void run()}
        disabled={n === 0 || state.running}
        aria-describedby="run-status"
      >
        {state.running ? <Loader2 aria-hidden className="animate-spin" /> : <Play aria-hidden />}
        {state.running ? 'Running…' : last ? 'Run again' : 'Run summarizer'}
      </Button>
      <div id="run-status" className="space-y-2">
        {n === 0 && <p className="text-xs text-ink-muted">Add at least one article to run the summarizer.</p>}
        {n === 1 && (
          <p className="text-xs leading-5 text-ink-muted">
            One article can be summarized, but there is nothing to compare it with. Add another report of the same
            story to see what each outlet covers.
          </p>
        )}
        {!state.running && (settingsChanged || articlesChanged) && (
          <Notice tone="info">
            {settingsChanged && articlesChanged
              ? 'Settings and articles changed. Run again to update the results.'
              : settingsChanged
                ? 'Settings changed. Run again to update the results.'
                : 'Articles changed. Run again to update the results.'}
          </Notice>
        )}
        {state.runError && <Notice tone="alert">The run failed: {state.runError}</Notice>}
        {last && !state.running && !settingsChanged && !articlesChanged && (
          <p className="text-xs text-ink-muted" role="status">
            Summarized {plural(last.result.n_docs, 'article')} in {Math.max(1, Math.round(last.ms))} ms.
          </p>
        )}
      </div>
    </div>
  );
}
