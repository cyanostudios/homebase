import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import { DONUT_CIRCUMFERENCE } from '@/core/ui/charts/chartConstants';
import { cn } from '@/lib/utils';

export type StatChartSegment = {
  key: string;
  label: string;
  value: number;
  /** Hex stroke/fill color (SVG + legend). */
  color: string;
};

const CHART_SHELL = 'rounded-xl bg-white p-4 shadow-sm dark:bg-slate-950';

export function StatChartShell({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(CHART_SHELL, className)}>
      {title ? (
        <p className="mb-3 text-[10px] font-normal uppercase tracking-[0.08em] text-slate-400">
          {title}
        </p>
      ) : null}
      {children}
    </div>
  );
}

/** Compact KPI tile for absolute counts (not composition). */
export function StatKpiTile({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className={cn(CHART_SHELL, className)}>
      <p className="text-[10px] font-normal uppercase tracking-[0.08em] text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums tracking-tight text-foreground sm:text-3xl">
        {value}
      </p>
    </div>
  );
}

/** Inline KPI numbers — dashboard invoices density (label + count in a tight grid). */
export function StatKpiStrip({
  items,
  className,
}: {
  items: Array<{ key: string; label: string; value: number }>;
  className?: string;
}) {
  return (
    <div className={cn('grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs', className)}>
      {items.map((item) => (
        <div key={item.key} className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-muted-foreground">{item.label}</span>
          <span className="tabular-nums font-extrabold text-foreground">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function StatBarLegend({ segments }: { segments: StatChartSegment[] }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
      {segments.map((segment) => (
        <div key={segment.key} className="flex min-w-0 items-center gap-1.5">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: segment.color }}
            aria-hidden
          />
          <span className="truncate">
            {segment.label} <span className="tabular-nums font-extrabold">({segment.value})</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function StatBarTrack({ segments }: { segments: StatChartSegment[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const denom = total > 0 ? total : 1;
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
      {segments.map(
        (segment) =>
          segment.value > 0 && (
            <div
              key={segment.key}
              style={{
                width: `${(segment.value / denom) * 100}%`,
                backgroundColor: segment.color,
              }}
            />
          ),
      )}
    </div>
  );
}

/** Pure-SVG donut — same technique as dashboard team/task charts. */
export function StatDonutChart({
  segments,
  ariaLabel,
  title,
  className,
}: {
  segments: StatChartSegment[];
  ariaLabel: string;
  title?: string;
  className?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const circ = DONUT_CIRCUMFERENCE;
  const denom = total > 0 ? total : 1;

  let offset = 0;
  const arcs = segments.map((segment) => {
    const arc = (segment.value / denom) * circ;
    const item = { ...segment, arc, offset };
    offset += arc;
    return item;
  });

  return (
    <StatChartShell title={title} className={className}>
      <div className="flex items-center gap-4">
        <svg
          viewBox="0 0 80 80"
          className="h-16 w-16 shrink-0 sm:h-20 sm:w-20"
          role="img"
          aria-label={ariaLabel}
        >
          <g transform="rotate(-90 40 40)">
            <circle
              cx="40"
              cy="40"
              r="32"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="8"
              strokeDasharray={`${circ}`}
            />
            {arcs.map(
              (segment) =>
                segment.arc > 0 && (
                  <circle
                    key={segment.key}
                    cx="40"
                    cy="40"
                    r="32"
                    fill="none"
                    stroke={segment.color}
                    strokeWidth="8"
                    strokeDasharray={`${segment.arc} ${circ}`}
                    strokeDashoffset={-segment.offset}
                  />
                ),
            )}
          </g>
        </svg>
        <StatBarLegend segments={segments} />
      </div>
    </StatChartShell>
  );
}

/** Horizontal stacked bar — same technique as dashboard invoices chart. */
export function StatStackedBar({
  segments,
  title,
  footer,
  className,
}: {
  segments: StatChartSegment[];
  title?: string;
  footer?: string;
  className?: string;
}) {
  return (
    <StatChartShell title={title} className={className}>
      <StatBarTrack segments={segments} />
      <StatBarLegend segments={segments} />
      {footer ? <p className="mt-2 text-xs text-muted-foreground">{footer}</p> : null}
    </StatChartShell>
  );
}

/**
 * Dashboard-invoices-sized card: one stacked bar + legend with counts + optional footer KPIs.
 * Keeps ~¼ of the previous tall multi-bar panels.
 */
export function StatCompactPanel({
  title,
  segments,
  kpis,
  footer,
  className,
}: {
  title?: string;
  segments: StatChartSegment[];
  kpis?: Array<{ key: string; label: string; value: number }>;
  footer?: string;
  className?: string;
}) {
  return (
    <StatChartShell title={title} className={className}>
      <StatBarTrack segments={segments} />
      <StatBarLegend segments={segments} />
      {kpis && kpis.length > 0 ? (
        <div className="mt-3 border-t border-border/40 pt-3">
          <StatKpiStrip items={kpis} />
        </div>
      ) : null}
      {footer ? <p className="mt-2 text-xs text-muted-foreground">{footer}</p> : null}
    </StatChartShell>
  );
}

/** Ranked horizontal bars — same technique as Cups pageview rankings. */
export function StatRankedBars({
  items,
  emptyLabel,
  title,
  barColor = '#14b8a6',
  className,
}: {
  items: Array<{ key: string; label: string; value: number; secondary?: string }>;
  emptyLabel: string;
  title?: string;
  barColor?: string;
  className?: string;
}) {
  const max = items.reduce((m, row) => Math.max(m, row.value), 0);

  return (
    <StatChartShell title={title} className={className}>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="space-y-0.5">
          {items.map((row) => {
            const width =
              max > 0 && row.value > 0 ? Math.min(100, Math.round((row.value / max) * 100)) : 0;
            return (
              <li key={row.key} className="relative overflow-hidden rounded-md">
                <div
                  className="absolute inset-y-0 left-0 rounded-md opacity-25"
                  style={{ width: `${width}%`, backgroundColor: barColor }}
                  aria-hidden
                />
                <div className="relative flex items-start justify-between gap-3 px-2 py-1.5 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{row.label}</div>
                    {row.secondary ? (
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {row.secondary}
                      </div>
                    ) : null}
                  </div>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{row.value}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </StatChartShell>
  );
}

export type StatTimeSeriesPoint = {
  key: string;
  label: string;
  value: number;
};

const TS_VIEW_H = 160;
const TS_PAD_L = 32;
const TS_PAD_R = 10;
const TS_PAD_T = 12;
const TS_PAD_B = 24;
const TS_MIN_WIDTH = 200;

function niceMax(raw: number): number {
  if (raw <= 0) return 1;
  const exp = Math.floor(Math.log10(raw));
  const base = 10 ** exp;
  const n = raw / base;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * base;
}

/** Compact SVG line chart for monthly (or other) numeric series. */
export function StatTimeSeriesChart({
  series,
  ariaLabel,
  valueLabel,
  title,
  emptyLabel,
  footer,
  className,
}: {
  series: StatTimeSeriesPoint[];
  ariaLabel: string;
  valueLabel: string;
  title?: string;
  emptyLabel?: string;
  footer?: string;
  className?: string;
}) {
  const gradientId = useId().replace(/:/g, '');
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(TS_MIN_WIDTH);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const apply = (w: number) => {
      setWidth(Math.max(TS_MIN_WIDTH, Math.floor(w)));
    };
    apply(el.getBoundingClientRect().width);

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      apply(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { points, yTicks, xLabels } = useMemo(() => {
    const maxVal = series.reduce((m, p) => Math.max(m, p.value), 0);
    const yMaxInner = niceMax(maxVal);
    const plotW = Math.max(1, width - TS_PAD_L - TS_PAD_R);
    const plotH = TS_VIEW_H - TS_PAD_T - TS_PAD_B;
    const n = Math.max(series.length, 1);
    const pts = series.map((p, i) => {
      const x = TS_PAD_L + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
      const y = TS_PAD_T + plotH - (p.value / yMaxInner) * plotH;
      return { x, y, ...p };
    });
    const yTicksInner = [0, 0.5, 1].map((t) => ({
      value: yMaxInner * t,
      y: TS_PAD_T + plotH - t * plotH,
    }));
    const labelCount = Math.min(6, series.length);
    const step =
      labelCount <= 1 ? 1 : Math.max(1, Math.floor((series.length - 1) / (labelCount - 1)));
    const labels: { x: number; text: string }[] = [];
    for (let i = 0; i < series.length; i += step) {
      labels.push({ x: pts[i].x, text: series[i].label });
    }
    const last = series.length - 1;
    if (last >= 0 && labels[labels.length - 1]?.text !== series[last].label) {
      labels.push({ x: pts[last].x, text: series[last].label });
    }
    return { points: pts, yTicks: yTicksInner, xLabels: labels };
  }, [series, width]);

  const linePath = useMemo(() => {
    if (points.length === 0) return '';
    return points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ');
  }, [points]);

  const areaPath = useMemo(() => {
    if (points.length === 0) return '';
    const baseY = TS_VIEW_H - TS_PAD_B;
    const first = points[0];
    const last = points[points.length - 1];
    return `${linePath} L${last.x.toFixed(1)},${baseY} L${first.x.toFixed(1)},${baseY} Z`;
  }, [linePath, points]);

  const onMove = useCallback(
    (event: ReactMouseEvent<SVGSVGElement>) => {
      if (points.length === 0 || width <= 0) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (rect.width <= 0) return;
      const xSvg = ((event.clientX - rect.left) / rect.width) * width;
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < points.length; i += 1) {
        const d = Math.abs(points[i].x - xSvg);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      setHoverIndex(best);
    },
    [points, width],
  );

  const hover = hoverIndex != null ? points[hoverIndex] : null;

  return (
    <StatChartShell title={title} className={className}>
      {series.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel ?? '—'}</p>
      ) : (
        <div ref={containerRef} className="relative w-full text-teal-600 dark:text-teal-400">
          <svg
            width={width}
            height={TS_VIEW_H}
            viewBox={`0 0 ${width} ${TS_VIEW_H}`}
            className="block h-auto max-w-full"
            role="img"
            aria-label={ariaLabel}
            onMouseMove={onMove}
            onMouseLeave={() => setHoverIndex(null)}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
              </linearGradient>
            </defs>

            {yTicks.map((tick) => (
              <g key={tick.value}>
                <line
                  x1={TS_PAD_L}
                  x2={width - TS_PAD_R}
                  y1={tick.y}
                  y2={tick.y}
                  className="stroke-border/60"
                  strokeWidth={1}
                />
                <text
                  x={TS_PAD_L - 6}
                  y={tick.y + 3}
                  textAnchor="end"
                  className="fill-muted-foreground text-[10px]"
                >
                  {tick.value % 1 === 0 ? String(tick.value) : tick.value.toFixed(1)}
                </text>
              </g>
            ))}

            {xLabels.map((label) => (
              <text
                key={`${label.x}-${label.text}`}
                x={label.x}
                y={TS_VIEW_H - 6}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {label.text}
              </text>
            ))}

            {areaPath ? <path d={areaPath} fill={`url(#${gradientId})`} /> : null}
            {linePath ? (
              <path
                d={linePath}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}

            {hover ? (
              <g>
                <line
                  x1={hover.x}
                  x2={hover.x}
                  y1={TS_PAD_T}
                  y2={TS_VIEW_H - TS_PAD_B}
                  className="stroke-border"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                <circle cx={hover.x} cy={hover.y} r={4} fill="currentColor" />
              </g>
            ) : null}
          </svg>

          {hover ? (
            <div
              className="pointer-events-none absolute top-1 rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-sm"
              style={{
                left: `clamp(0.5rem, ${(hover.x / width) * 100}% - 2rem, calc(100% - 6rem))`,
              }}
            >
              <div className="font-medium tabular-nums">
                {hover.value}{' '}
                <span className="font-normal text-muted-foreground">{valueLabel}</span>
              </div>
              <div className="text-muted-foreground">{hover.label}</div>
            </div>
          ) : null}
        </div>
      )}
      {footer ? <p className="mt-2 text-xs text-muted-foreground">{footer}</p> : null}
    </StatChartShell>
  );
}
