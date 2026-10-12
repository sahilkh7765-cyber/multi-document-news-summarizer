// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// An outlet's name with its pencil-colour margin bar. Colour never appears without the name.

import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function markStyle(slot: number): CSSProperties {
  return { ['--mark' as string]: `var(--src-${slot % 8})` } as CSSProperties;
}

/** Left margin bar in the outlet's colour; dashed when the palette has wrapped around (9th outlet on). */
export function markBar(slot: number): string {
  return cn('border-l-4 border-[var(--mark)]', slot >= 8 && 'border-dashed');
}

interface Props {
  name: string;
  slot: number;
  className?: string;
  children?: ReactNode;
}

/** Inline tag: a short coloured bar followed by the outlet name. */
export function SourceTag({ name, slot, className }: Props) {
  return (
    <span className={cn('inline-flex items-baseline gap-1.5 text-sm text-ink', className)} style={markStyle(slot)}>
      <span
        aria-hidden
        className={cn('inline-block h-3 w-1 shrink-0 translate-y-px rounded-[1px] bg-[var(--mark)]', slot >= 8 && 'bg-transparent border border-dashed border-[var(--mark)]')}
      />
      <span className="font-medium">{name}</span>
    </span>
  );
}
