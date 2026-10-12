// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// The articles on the desk: outlet (as the pipeline will name it), title or opening line, sentence count
// and event. Each row can be edited or removed.

import { Trash2 } from 'lucide-react';
import { markBar, markStyle } from '@/components/SourceMark';
import { Button } from '@/components/ui/button';
import { cn, plural } from '@/lib/utils';
import { useWorkspace, type WorkspaceArticle } from '@/state/workspace';
import { EditArticleDialog } from './EditArticleDialog';

const ORIGIN_LABEL: Record<WorkspaceArticle['origin'], string> = {
  demo: 'demo corpus',
  paste: 'pasted',
  file: 'file',
  url: 'web page',
};

export function ArticleList() {
  const { state, dispatch, displayName, colorOf } = useWorkspace();

  if (state.articles.length === 0) {
    return (
      <p className="rounded-control border border-dashed border-rule px-4 py-6 text-sm text-ink-muted">
        No articles yet. Add two or more reports of the same story below, or load the demo corpus to see how it
        works.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-rule overflow-hidden rounded-control border border-rule bg-paper" aria-label="Articles">
      {state.articles.map((a) => {
        const name = displayName.get(a.id) ?? a.source;
        const slot = colorOf(name);
        const opening = a.title || a.sents[0]?.[0] || '';
        const renamed = name !== a.source;
        return (
          <li key={a.id} className={cn('flex items-center gap-1 py-2 pl-3 pr-1', markBar(slot))} style={markStyle(slot)}>
            <div className="min-w-0 flex-1" title={renamed ? `Renamed from "${a.source}" because that name is used more than once` : undefined}>
              <p className="flex items-baseline gap-2">
                <span className="max-w-[75%] shrink-0 truncate text-sm font-semibold text-ink">{name}</span>
                <span className="tabular min-w-0 truncate text-xs text-ink-muted">
                  {a.event ? `${a.event}, ` : ''}
                  {plural(a.sents.length, 'sentence')}
                  <span className="sr-only">{`, ${ORIGIN_LABEL[a.origin]}`}</span>
                </span>
              </p>
              <p className="truncate font-serif text-[0.95rem] leading-6 text-ink">{opening}</p>
              {renamed && <span className="sr-only">{`Renamed from ${a.source} because that name is used more than once.`}</span>}
            </div>
            <EditArticleDialog article={a} displayName={name} />
            <Button
              variant="quiet"
              size="icon"
              onClick={() => dispatch({ type: 'remove', id: a.id })}
              aria-label={`Remove ${name}`}
              title={`Remove ${name}`}
            >
              <Trash2 aria-hidden />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
