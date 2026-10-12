// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Inline status message. Errors use role="alert"; everything else is a polite live region.

import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'info' | 'ok' | 'alert';

const tones: Record<Tone, string> = {
  info: 'bg-pencil-wash text-ink',
  ok: 'bg-ok-wash text-ink',
  alert: 'bg-alert-wash text-ink',
};
const icons = { info: Info, ok: CheckCircle2, alert: AlertTriangle } as const;
const iconTone: Record<Tone, string> = { info: 'text-pencil', ok: 'text-ok', alert: 'text-alert' };

export function Notice({ tone = 'info', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  const Icon = icons[tone];
  return (
    <div role={tone === 'alert' ? 'alert' : 'status'} className={cn('flex gap-2 rounded-control px-3 py-2 text-sm', tones[tone], className)}>
      <Icon aria-hidden className={cn('mt-0.5 size-4 shrink-0', iconTone[tone])} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
