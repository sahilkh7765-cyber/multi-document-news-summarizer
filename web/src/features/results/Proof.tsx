// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// The proof sheet: what the right-hand side shows before, during and after a run.

import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { plural } from '@/lib/utils';
import { useWorkspace } from '@/state/workspace';
import { Results } from './Results';

export function Proof() {
  const { state, storage } = useWorkspace();
  const n = state.articles.length;
  const finishedAt = state.last?.finishedAt;

  // on phones the results sit below the desk: bring them into view when a run finishes
  useEffect(() => {
    if (!finishedAt || !window.matchMedia('(max-width: 899px)').matches) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('proof')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }, [finishedAt]);

  if (storage.kind === 'loading') {
    return (
      <div className="flex items-center gap-3 py-16 text-ink-muted" role="status">
        <Loader2 aria-hidden className="size-5 animate-spin text-pencil" />
        Opening your saved desk…
      </div>
    );
  }

  if (state.last) return <Results />;

  if (state.running) {
    return (
      <div className="flex items-center gap-3 py-16 text-ink-muted" role="status">
        <Loader2 aria-hidden className="size-5 animate-spin text-pencil" />
        Comparing {plural(n, 'article')}…
      </div>
    );
  }

  return (
    <div className="max-w-[34em] py-10">
      <h2 className="font-serif text-3xl font-semibold leading-tight">
        {n === 0 ? 'Bring in the copy' : 'Ready when you are'}
      </h2>
      <p className="mt-4 font-serif text-reading text-ink">
        {n === 0
          ? 'Add reports of the same news story from different outlets. The summarizer groups them by story, writes one consensus account with every line traced to its outlet, and lists what only one outlet reported.'
          : `${plural(n, 'article')} on the desk. Run the summarizer to group them into stories and compare the outlets.`}
      </p>
      {n === 0 && (
        <p className="mt-4 text-sm text-ink-muted">
          No articles to hand? Load the demo corpus: three stories, each covered by four outlets.
        </p>
      )}
    </div>
  );
}
