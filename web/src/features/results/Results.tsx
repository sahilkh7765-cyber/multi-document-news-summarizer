// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Placeholder list of stories; the full results views are built in phase 3.

import { useWorkspace } from '@/state/workspace';

export function Results() {
  const { state } = useWorkspace();
  const res = state.last!.result;
  return (
    <div className="py-6">
      <h2 className="font-serif text-3xl font-semibold">Stories</h2>
      <ul className="mt-4 space-y-2">
        {res.clusters.map((c) => (
          <li key={c.name}>
            <span className="font-semibold">{c.name}</span>: {c.sources.join(', ')}
          </li>
        ))}
      </ul>
    </div>
  );
}
