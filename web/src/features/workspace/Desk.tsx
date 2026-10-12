// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// The desk column: incoming articles, adding more, settings and the run button.

import { BookOpen, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { plural } from '@/lib/utils';
import { useWorkspace } from '@/state/workspace';
import { AddArticle } from './AddArticle';
import { ArticleList } from './ArticleList';
import { RunControl } from './RunControl';
import { SettingsPanel } from './SettingsPanel';

function DeskSection({ title, id, actions, children }: { title: string; id: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 id={id} className="font-serif text-xl font-semibold">
          {title}
        </h2>
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function Desk() {
  const { state, dispatch } = useWorkspace();
  const n = state.articles.length;
  const loadDemo = () => dispatch({ type: 'loadDemo' });

  return (
    <div className="flex flex-col gap-8">
      <DeskSection
        id="desk-articles"
        title={n ? `Articles (${n})` : 'Articles'}
        actions={
          <>
            {n > 0 ? (
              <ConfirmDialog
                trigger={
                  <Button variant="quiet" size="sm">
                    <BookOpen aria-hidden />
                    Load demo corpus
                  </Button>
                }
                title="Replace the articles with the demo corpus?"
                description={`The ${plural(n, 'article')} on the desk will be removed and the 12 demo articles loaded.`}
                confirmLabel="Load demo corpus"
                onConfirm={loadDemo}
              />
            ) : (
              <Button variant="quiet" size="sm" onClick={loadDemo}>
                <BookOpen aria-hidden />
                Load demo corpus
              </Button>
            )}
            <ConfirmDialog
              trigger={
                <Button variant="quiet" size="sm" disabled={n === 0}>
                  <X aria-hidden />
                  Clear all
                </Button>
              }
              title={`Remove all ${plural(n, 'article')}?`}
              description="The desk will be emptied and the current results discarded."
              confirmLabel="Remove all"
              onConfirm={() => dispatch({ type: 'clear' })}
            />
          </>
        }
      >
        <ArticleList />
      </DeskSection>

      <DeskSection id="desk-add" title="Add an article">
        <AddArticle />
      </DeskSection>

      <DeskSection id="desk-settings" title="Settings">
        <SettingsPanel />
      </DeskSection>

      <div className="sticky bottom-0 -mx-4 border-t border-rule bg-desk px-4 pb-4 pt-3 sm:-mx-6 sm:px-6">
        <RunControl />
      </div>
    </div>
  );
}
