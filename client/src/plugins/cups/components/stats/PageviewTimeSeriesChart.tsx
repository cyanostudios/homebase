import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

import type { CupPageviewSeriesPoint } from '../../types/pageviewStats';

const VIEW_H = 208;
const PAD_L = 36;
const PAD_R = 12;
const PAD_T = 16;
const PAD_B = 28;
const MIN_WIDTH = 240;

function niceMax(raw: number): number {
  if (raw <= 0) return 1;
  const exp = Math.floor(Math.log10(raw));
  const base = 10 ** exp;
  const n = raw / base;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * base;
}

function formatAxisDay(day: string): string {
  const d = new Date(`${day}T12:00:00`);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function PageviewTimeSeriesChart({
  series,
  ariaLabel,
  viewsLabel,
  className,
}: {
  series: CupPageviewSeriesPoint[];
  ariaLabel: string;
  viewsLabel: string;
  className?: string;
}) {
  const gradientId = useId().replace(/:/g, '');
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(MIN_WIDTH);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const apply = (w: number) => {
      setWidth(Math.max(MIN_WIDTH, Math.floor(w)));
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
    const maxViews = series.reduce((m, p) => Math.max(m, p.views), 0);
    const yMaxInner = niceMax(maxViews);
    const plotW = Math.max(1, width - PAD_L - PAD_R);
    const plotH = VIEW_H - PAD_T - PAD_B;
    const n = Math.max(series.length, 1);
    const pts = series.map((p, i) => {
      const x = PAD_L + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
      const y = PAD_T + plotH - (p.views / yMaxInner) * plotH;
      return { x, y, ...p };
    });
    const yTicksInner = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
      value: yMaxInner * t,
      y: PAD_T + plotH - t * plotH,
    }));
    const labelCount = Math.min(6, series.length);
    const step =
      labelCount <= 1 ? 1 : Math.max(1, Math.floor((series.length - 1) / (labelCount - 1)));
    const labels: { x: number; text: string }[] = [];
    for (let i = 0; i < series.length; i += step) {
      labels.push({ x: pts[i].x, text: formatAxisDay(series[i].day) });
    }
    const last = series.length - 1;
    if (last >= 0 && labels[labels.length - 1]?.text !== formatAxisDay(series[last].day)) {
      labels.push({ x: pts[last].x, text: formatAxisDay(series[last].day) });
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
    const baseY = VIEW_H - PAD_B;
    const first = points[0];
    const last = points[points.length - 1];
    return `${linePath} L${last.x.toFixed(1)},${baseY} L${first.x.toFixed(1)},${baseY} Z`;
  }, [linePath, points]);

  const onMove = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      if (points.length === 0 || width <= 0) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (rect.width <= 0) return;
      // SVG is sized 1:1 with the container (no letterboxing).
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
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <svg
        width={width}
        height={VIEW_H}
        viewBox={`0 0 ${width} ${VIEW_H}`}
        className="block h-auto max-w-full text-primary"
        role="img"
        aria-label={ariaLabel}
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((tick) => (
          <g key={tick.value}>
            <line
              x1={PAD_L}
              x2={width - PAD_R}
              y1={tick.y}
              y2={tick.y}
              className="stroke-border/60"
              strokeWidth={1}
            />
            <text
              x={PAD_L - 8}
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
            y={VIEW_H - 8}
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
              y1={PAD_T}
              y2={VIEW_H - PAD_B}
              className="stroke-border"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <circle cx={hover.x} cy={hover.y} r={4} className="fill-primary" />
          </g>
        ) : null}
      </svg>

      {hover ? (
        <div
          className="pointer-events-none absolute top-2 rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-sm"
          style={{
            left: `clamp(0.5rem, ${(hover.x / width) * 100}% - 2rem, calc(100% - 6rem))`,
          }}
        >
          <div className="font-medium tabular-nums">
            {hover.views} <span className="font-normal text-muted-foreground">{viewsLabel}</span>
          </div>
          <div className="text-muted-foreground">{formatAxisDay(hover.day)}</div>
        </div>
      ) : null}
    </div>
  );
}
