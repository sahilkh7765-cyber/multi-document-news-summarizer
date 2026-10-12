// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// The four pipeline settings, with app.py's ranges and defaults and a plain-English line for each.

import { RotateCcw } from 'lucide-react';
import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/field';
import { Slider } from '@/components/ui/slider';
import type { Params } from '@/nlp/types';
import { DEFAULT_PARAMS, sameParams, useWorkspace } from '@/state/workspace';

interface Setting {
  key: keyof Params;
  label: string;
  symbol?: string;
  min: number;
  max: number;
  step: number;
  help: string;
}

export const SETTINGS: readonly Setting[] = [
  {
    key: 'k',
    label: 'Sentences in the consensus summary',
    min: 2,
    max: 10,
    step: 1,
    help: 'How many sentences each story summary keeps.',
  },
  {
    key: 'delta',
    label: 'Story grouping',
    symbol: 'δ',
    min: 0.5,
    max: 0.99,
    step: 0.01,
    help: 'Higher values put articles into the same story more easily.',
  },
  {
    key: 'tau_dup',
    label: 'Duplicate threshold',
    symbol: 'τ_dup',
    min: 0.05,
    max: 0.6,
    step: 0.01,
    help: 'A sentence is dropped as a repeat if it is at least this similar to one already kept.',
  },
  {
    key: 'tau_uniq',
    label: 'Exclusivity threshold',
    symbol: 'τ_uniq',
    min: 0.05,
    max: 0.6,
    step: 0.01,
    help: 'A sentence counts as reported by one outlet only if no other outlet has a sentence this similar.',
  },
];

export const formatParam = (key: keyof Params, v: number): string => (key === 'k' ? String(v) : v.toFixed(2));

export function SettingsPanel() {
  const { state, dispatch } = useWorkspace();
  const id = useId();
  const isDefault = sameParams(state.params, DEFAULT_PARAMS);

  return (
    <div className="space-y-5">
      {SETTINGS.map((s) => {
        const value = state.params[s.key];
        return (
          <div key={s.key} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <Label id={`${id}-${s.key}`}>
                {s.label}
                {s.symbol && <span className="ml-1 font-normal text-ink-muted">({s.symbol})</span>}
              </Label>
              <output className="tabular text-sm font-semibold" aria-live="off">
                {formatParam(s.key, value)}
              </output>
            </div>
            <Slider
              aria-labelledby={`${id}-${s.key}`}
              aria-describedby={`${id}-${s.key}-help`}
              aria-valuetext={formatParam(s.key, value)}
              min={s.min}
              max={s.max}
              step={s.step}
              value={[value]}
              onValueChange={([v]) => {
                if (v === undefined) return;
                // round to the slider step so values equal Python's literals (0.2, not 0.20000000000000004)
                const rounded = s.key === 'k' ? Math.round(v) : Number(v.toFixed(2));
                dispatch({ type: 'setParams', params: { [s.key]: rounded } });
              }}
            />
            <p id={`${id}-${s.key}-help`} className="text-xs leading-5 text-ink-muted">
              {s.help}
            </p>
          </div>
        );
      })}
      <Button
        variant="quiet"
        size="sm"
        disabled={isDefault}
        onClick={() => dispatch({ type: 'setParams', params: DEFAULT_PARAMS })}
        className="-ml-3"
      >
        <RotateCcw aria-hidden />
        Restore defaults
      </Button>
    </div>
  );
}
