// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Layout: masthead, the desk (incoming articles and settings) and the proof (results).

import { Desk } from '@/features/workspace/Desk';
import { Proof } from '@/features/results/Proof';
import { ThemeToggle } from '@/components/ThemeToggle';

export function App() {
  return (
    <div className="min-h-dvh">
      <a
        href="#proof"
        className="sr-only z-50 rounded-control bg-pencil px-3 py-2 text-pencil-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to results
      </a>
      <header className="flex items-start justify-between gap-4 px-4 pb-4 pt-5 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <h1 className="font-serif text-3xl font-semibold leading-tight sm:text-4xl">Cross-Source Desk</h1>
          <p className="mt-1 max-w-[60ch] text-sm text-ink-muted">
            Compare how outlets report the same story: what they agree on, and what only one of them says.
          </p>
        </div>
        <ThemeToggle />
      </header>
      <div className="grid grid-cols-[minmax(0,1fr)] min-[900px]:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside
          aria-label="Desk"
          className="min-w-0 px-4 pb-0 sm:px-6 min-[900px]:sticky min-[900px]:top-0 min-[900px]:h-dvh min-[900px]:overflow-y-auto min-[900px]:pl-6 min-[900px]:pr-5 min-[900px]:pt-2 lg:pl-8"
        >
          <Desk />
        </aside>
        <main
          id="proof"
          tabIndex={-1}
          className="min-h-[60dvh] bg-paper px-4 pb-16 shadow-[0_0_0_1px_var(--rule)] sm:px-8 min-[900px]:mr-4 min-[900px]:mb-4 min-[900px]:rounded-sm xl:px-12"
        >
          <Proof />
        </main>
      </div>
    </div>
  );
}
