// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Whether the desk is being kept in this browser (IndexedDB).

import { useWorkspace } from '@/state/workspace';

export function StorageStatus() {
  const { storage } = useWorkspace();
  const text =
    storage.kind === 'loading'
      ? 'Opening your saved desk…'
      : storage.kind === 'saved'
        ? storage.discarded
          ? 'Saved in this browser. An unreadable earlier save was discarded.'
          : 'Saved in this browser'
        : storage.kind === 'unavailable'
          ? 'Not saved: this browser does not allow storage here'
          : `Not saved: ${storage.message}`;
  const warn = storage.kind === 'unavailable' || storage.kind === 'error';
  return (
    <p role="status" className={warn ? 'text-xs text-alert' : 'text-xs text-ink-muted'}>
      {text}
    </p>
  );
}
