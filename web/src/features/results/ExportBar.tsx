// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Download the last run as JSON (app.py-compatible result object plus scores) or as a Markdown report.

import { FileDown, FileText } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { buildJson, buildMarkdown, downloadText, exportFileName } from '@/export/report';
import { sameParams, useWorkspace } from '@/state/workspace';

export function ExportBar() {
  const { state } = useWorkspace();
  const last = state.last!;
  const [done, setDone] = useState<string | null>(null);
  const stale = last.revision !== state.revision || !sameParams(last.params, state.params);

  function save(kind: 'json' | 'md') {
    const at = new Date();
    const input = { result: last.result, params: last.params, refs: state.refs, generatedAt: at };
    const name = exportFileName(kind, at);
    if (kind === 'json') downloadText(JSON.stringify(buildJson(input), null, 1), name, 'application/json');
    else downloadText(buildMarkdown(input), name, 'text/markdown');
    setDone(`Downloaded ${name}.`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={() => save('md')}>
        <FileText aria-hidden />
        Download report (.md)
      </Button>
      <Button size="sm" onClick={() => save('json')}>
        <FileDown aria-hidden />
        Download results (.json)
      </Button>
      <p className="w-full text-xs text-ink-muted" role="status">
        {done ?? (stale ? 'Downloads contain the last run, made before your latest changes.' : '')}
      </p>
    </div>
  );
}
