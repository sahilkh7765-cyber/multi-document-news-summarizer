// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Threshold sweep: precision, recall and F1 of source-exclusive detection against tau_uniq.
// One y-axis (0..1). Series colours are the first three categorical slots, plus distinct marker shapes and
// dash patterns (so lines that coincide stay visible);
// a legend sits above and each line is labelled at its end. Hover or arrow keys show a crosshair and the
// values at that threshold. The same numbers are always in the table under the chart.

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { fmt4, type Scores } from '@/nlp/metrics';

export interface SweepPoint {
  t: number;
  detected: number;
  scores: Scores;
}

const SERIES = [
  { key: 'precision', label: 'Precision', color: 'var(--series-1)', shape: 'circle', dash: undefined },
  { key: 'recall', label: 'Recall', color: 'var(--series-2)', shape: 'square', dash: '7 4' },
  { key: 'f1', label: 'F1', color: 'var(--series-3)', shape: 'diamond', dash: '2 4' },
] as const;
type Shape = (typeof SERIES)[number]['shape'];

const H = 232;
const M = { top: 14, right: 84, bottom: 36, left: 40 };

function Marker({ shape, x, y, color }: { shape: Shape; x: number; y: number; color: string }) {
  const common = { fill: color, stroke: 'var(--paper)', strokeWidth: 2 };
  if (shape === 'circle') return <circle cx={x} cy={y} r={4.5} {...common} />;
  if (shape === 'square') return <rect x={x - 4.5} y={y - 4.5} width={9} height={9} rx={1.5} {...common} />;
  return <path d={`M${x} ${y - 6}L${x + 6} ${y}L${x} ${y + 6}L${x - 6} ${y}Z`} {...common} />;
}

function LegendSwatch({ shape, color, dash }: { shape: Shape; color: string; dash?: string | undefined }) {
  return (
    <svg width="30" height="12" aria-hidden className="shrink-0">
      <line x1="1" x2="29" y1="6" y2="6" stroke={color} strokeWidth="2" strokeDasharray={dash} strokeLinecap="round" />
      <Marker shape={shape} x={13} y={6} color={color} />
    </svg>
  );
}

/** Spread label y positions so they are at least `gap` px apart, keeping their order. */
function spread(ys: number[], gap: number, min: number, max: number): number[] {
  const order = ys.map((y, i) => [y, i] as const).sort((a, b) => a[0] - b[0]);
  const out = new Array<number>(ys.length);
  let prev = -Infinity;
  for (const [y, i] of order) {
    const v = Math.max(y, prev + gap);
    out[i] = v;
    prev = v;
  }
  // push back up if the last label fell off the bottom
  const overflow = Math.max(0, prev - max);
  return out.map((v) => Math.max(min, v - overflow));
}

export function SweepChart({ points, current, title }: { points: SweepPoint[]; current: number; title: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  const [active, setActive] = useState<number | null>(null);
  const id = useId();

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setWidth(Math.max(280, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const tMin = points[0]!.t;
  const tMax = points[points.length - 1]!.t;
  const iw = width - M.left - M.right;
  const ih = H - M.top - M.bottom;
  const x = (t: number) => M.left + ((t - tMin) / (tMax - tMin)) * iw;
  const y = (v: number) => M.top + (1 - v) * ih;

  const last = points[points.length - 1]!;
  const labelY = spread(
    SERIES.map((s) => y(last.scores[s.key])),
    15,
    M.top,
    M.top + ih,
  );

  function onPointer(e: PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(p.t) - px) < Math.abs(x(points[best]!.t) - px)) best = i;
    });
    setActive(best);
  }

  function onKey(e: KeyboardEvent<SVGSVGElement>) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const d = e.key === 'ArrowRight' ? 1 : -1;
      setActive((a) => Math.min(points.length - 1, Math.max(0, (a ?? (d > 0 ? -1 : points.length)) + d)));
    } else if (e.key === 'Escape') {
      setActive(null);
    }
  }

  const ap = active === null ? null : points[active]!;
  const tipLeft = ap ? Math.min(Math.max(x(ap.t) + 12, 0), width - 170) : 0;
  const tipFlip = ap ? x(ap.t) + 12 + 160 > width : false;

  return (
    <figure className="space-y-2">
      <figcaption className="text-sm font-medium text-ink">{title}</figcaption>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink" aria-label="Legend">
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <LegendSwatch shape={s.shape} color={s.color} dash={s.dash} />
            {s.label}
          </li>
        ))}
      </ul>
      <div ref={wrap} className="relative">
        <svg
          width={width}
          height={H}
          className="block touch-none select-none rounded-control focus-visible:outline-2"
          role="group"
          aria-label={`${title}. Use the left and right arrow keys to read values at each threshold; the table below lists them all.`}
          aria-describedby={`${id}-table`}
          tabIndex={0}
          onPointerMove={onPointer}
          onPointerDown={onPointer}
          onPointerLeave={() => setActive(null)}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
        >
          {/* grid and axes */}
          {[0, 0.5, 1].map((v) => (
            <g key={v}>
              <line x1={M.left} x2={M.left + iw} y1={y(v)} y2={y(v)} stroke="var(--rule)" strokeWidth={v === 0 ? 1.5 : 1} />
              <text x={M.left - 8} y={y(v)} dy="0.32em" textAnchor="end" className="fill-ink-muted text-[12px] tabular">
                {v.toFixed(1)}
              </text>
            </g>
          ))}
          {points.map((p) => (
            <text key={p.t} x={x(p.t)} y={M.top + ih + 18} textAnchor="middle" className="fill-ink-muted text-[12px] tabular">
              {p.t.toFixed(2)}
            </text>
          ))}
          <text x={M.left + iw / 2} y={H - 2} textAnchor="middle" className="fill-ink-muted text-[12px]">
            Exclusivity threshold (τ_uniq)
          </text>

          {/* current setting */}
          {current >= tMin && current <= tMax && (
            <g>
              <line x1={x(current)} x2={x(current)} y1={M.top} y2={M.top + ih} stroke="var(--ink-muted)" strokeDasharray="4 3" />
              <text x={x(current) + 4} y={M.top + ih - 6} className="fill-ink-muted text-[11px] tabular">
                now {current.toFixed(2)}
              </text>
            </g>
          )}

          {/* crosshair */}
          {ap && <line x1={x(ap.t)} x2={x(ap.t)} y1={M.top} y2={M.top + ih} stroke="var(--ink)" strokeWidth={1} />}

          {/* series */}
          {SERIES.map((s, si) => (
            <g key={s.key}>
              <polyline
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={s.dash}
                points={points.map((p) => `${x(p.t)},${y(p.scores[s.key])}`).join(' ')}
              />
              {points.map((p) => (
                <Marker key={p.t} shape={s.shape} x={x(p.t)} y={y(p.scores[s.key])} color={s.color} />
              ))}
              <text x={M.left + iw + 10} y={labelY[si]} dy="0.32em" className="fill-ink text-[12px]">
                {s.label}
              </text>
            </g>
          ))}
        </svg>

        {ap && (
          <div
            className="pointer-events-none absolute top-2 z-10 w-40 rounded-control border border-rule bg-paper px-3 py-2 text-xs shadow-md"
            style={{ left: tipFlip ? Math.max(0, x(ap.t) - 12 - 160) : tipLeft }}
            role="status"
          >
            <p className="font-semibold text-ink">τ_uniq {ap.t.toFixed(2)}</p>
            <p className="tabular text-ink-muted">{ap.detected} flagged</p>
            <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-3">
              {SERIES.map((s) => (
                <div key={s.key} className="contents">
                  <dt className="flex items-center gap-1.5 text-ink">
                    <LegendSwatch shape={s.shape} color={s.color} dash={s.dash} />
                    {s.label}
                  </dt>
                  <dd className="tabular text-right text-ink">{fmt4(ap.scores[s.key])}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
      <span id={`${id}-table`} className="sr-only">
        Values are listed in the threshold table that follows.
      </span>
    </figure>
  );
}
