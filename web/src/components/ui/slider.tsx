// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// shadcn/ui Slider (single thumb). Accessible-name props go on the thumb, which carries role="slider".

import { Slider as SliderPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

interface SliderProps extends ComponentProps<typeof SliderPrimitive.Root> {
  'aria-valuetext'?: string;
}

export function Slider({
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  'aria-describedby': ariaDescribedby,
  'aria-valuetext': ariaValuetext,
  ...props
}: SliderProps) {
  return (
    <SliderPrimitive.Root
      className={cn('relative flex h-6 w-full touch-none select-none items-center data-[disabled]:opacity-50', className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1 grow rounded-full bg-rule">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-pencil" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        aria-describedby={ariaDescribedby}
        aria-valuetext={ariaValuetext}
        className="block size-5 rounded-full border-2 border-pencil bg-paper shadow-sm transition-transform hover:scale-110"
      />
    </SliderPrimitive.Root>
  );
}
