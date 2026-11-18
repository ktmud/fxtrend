import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { formatDate, formatMonthShort } from '../lib/format'
import { niceTicks, timeTicks } from '../lib/series'

export interface ChartSeries {
  id: string
  label: string
  color: string
  values: (number | null)[]
  dashed?: boolean
  /** Fill a soft gradient under the line (single-series focus view). */
  area?: boolean
  dim?: boolean
}

interface Props {
  times: number[]
  series: ChartSeries[]
  formatValue: (v: number) => string
  formatTick: (v: number, step: number) => string
  /** Emphasise y = 0 (used for % change). */
  zeroLine?: boolean
  /** Direct labels at the right end of each line. */
  endLabels?: boolean
  ariaLabel: string
  busy?: boolean
}

const HEIGHT_MOBILE = 260
const HEIGHT_DESKTOP = 360
const PAD_TOP = 16
const PAD_BOTTOM = 28

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.getBoundingClientRect().width)
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

function linePath(xs: number[], ys: (number | null)[]): string {
  let d = ''
  let pen = false
  for (let i = 0; i < xs.length; i++) {
    const y = ys[i]
    if (y == null) {
      pen = false
      continue
    }
    d += `${pen ? 'L' : 'M'}${xs[i].toFixed(1)},${y.toFixed(1)}`
    pen = true
  }
  return d
}

function areaPath(xs: number[], ys: (number | null)[], floor: number): string {
  let d = ''
  let segStart = -1
  const close = (end: number) => {
    if (segStart < 0) return
    d += `L${xs[end].toFixed(1)},${floor}L${xs[segStart].toFixed(1)},${floor}Z`
    segStart = -1
  }
  for (let i = 0; i < xs.length; i++) {
    const y = ys[i]
    if (y == null) {
      close(i - 1)
      continue
    }
    d += `${segStart < 0 ? 'M' : 'L'}${xs[i].toFixed(1)},${y.toFixed(1)}`
    if (segStart < 0) segStart = i
  }
  close(xs.length - 1)
  return d
}

export function Chart({ times, series, formatValue, formatTick, zeroLine, endLabels, ariaLabel, busy }: Props) {
  const [wrapRef, width] = useWidth<HTMLDivElement>()
  const gradId = useId().replace(/:/g, '')
  const [rawHover, setHover] = useState<number | null>(null)
  // A stale hover index (data shrank) simply reads as "no hover".
  const hover = rawHover != null && rawHover < times.length ? rawHover : null
  const pointerType = useRef<string>('mouse')

  const narrow = width < 560
  const height = narrow ? HEIGHT_MOBILE : HEIGHT_DESKTOP

  const geo = useMemo(() => {
    let lo = Infinity
    let hi = -Infinity
    for (const s of series)
      for (const v of s.values)
        if (v != null) {
          if (v < lo) lo = v
          if (v > hi) hi = v
        }
    if (zeroLine && Number.isFinite(lo)) {
      lo = Math.min(lo, 0)
      hi = Math.max(hi, 0)
    }
    const yt = niceTicks(lo, hi, narrow ? 4 : 5)
    const labels = yt.ticks.map((t) => formatTick(t, yt.step))
    const padLeft = Math.max(28, Math.max(...labels.map((l) => l.length), 1) * 7 + 10)
    const padRight = endLabels ? (narrow ? 64 : 92) : 12
    const plotW = Math.max(10, width - padLeft - padRight)
    const plotH = height - PAD_TOP - PAD_BOTTOM
    const t0 = times[0] ?? 0
    const t1 = times[times.length - 1] ?? 1
    const x = (t: number) => padLeft + (t1 === t0 ? plotW / 2 : ((t - t0) / (t1 - t0)) * plotW)
    const y = (v: number) => PAD_TOP + (1 - (v - yt.min) / (yt.max - yt.min || 1)) * plotH
    const xs = times.map(x)
    const xt = timeTicks(t0, t1, Math.max(2, Math.floor(plotW / (narrow ? 54 : 72))), (t) => String(new Date(t).getUTCFullYear()), formatMonthShort)
    return { yt, labels, padLeft, padRight, plotW, plotH, x, y, xs, xt }
  }, [series, times, width, height, narrow, zeroLine, endLabels, formatTick])

  const ys = series.map((s) => s.values.map((v) => (v == null ? null : geo.y(v))))

  // Direct end labels, nudged apart so they never collide.
  const ends = useMemo(() => {
    if (!endLabels) return []
    const items = series
      .map((s, k) => {
        let i = s.values.length - 1
        while (i >= 0 && s.values[i] == null) i--
        return i < 0 ? null : { id: s.id, label: s.label, color: s.color, value: s.values[i]!, y: ys[k][i]!, dim: s.dim }
      })
      .filter((v): v is NonNullable<typeof v> => v !== null)
      .sort((a, b) => a.y - b.y)
    const gap = 30
    for (let i = 1; i < items.length; i++) if (items[i].y - items[i - 1].y < gap) items[i].y = items[i - 1].y + gap
    const overflow = items.length ? items[items.length - 1].y - (height - PAD_BOTTOM) : 0
    if (overflow > 0) for (const it of items) it.y -= overflow
    for (let i = items.length - 2; i >= 0; i--) if (items[i + 1].y - items[i].y < gap) items[i].y = items[i + 1].y - gap
    return items
  }, [endLabels, series, ys, height])

  const indexAt = (px: number) => {
    const xs = geo.xs
    if (xs.length === 0) return null
    let lo = 0
    let hi = xs.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (xs[mid] <= px) lo = mid
      else hi = mid
    }
    return px - xs[lo] < xs[hi] - px ? lo : hi
  }

  const onPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    pointerType.current = e.pointerType
    const r = e.currentTarget.getBoundingClientRect()
    setHover(indexAt(e.clientX - r.left))
  }

  const onKey = (e: React.KeyboardEvent) => {
    const n = times.length
    if (!n) return
    const step = e.shiftKey ? Math.max(1, Math.round(n / 20)) : 1
    if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? n - 1) - step))
    else if (e.key === 'ArrowRight') setHover((h) => Math.min(n - 1, (h ?? n - 1) + step))
    else if (e.key === 'Home') setHover(0)
    else if (e.key === 'End') setHover(n - 1)
    else if (e.key === 'Escape') setHover(null)
    else return
    e.preventDefault()
  }

  const floor = height - PAD_BOTTOM
  const hx = hover != null ? geo.xs[hover] : null
  const rows =
    hover != null
      ? series
          .map((s) => ({ s, v: s.values[hover] }))
          .filter((r): r is { s: ChartSeries; v: number } => r.v != null)
          .sort((a, b) => b.v - a.v)
      : []
  const tipLeft = hx != null && hx > width * 0.55

  return (
    <div className={`chart${busy ? ' is-busy' : ''}`} ref={wrapRef} style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel}
          tabIndex={0}
          onPointerMove={onPointer}
          onPointerDown={onPointer}
          onPointerLeave={() => pointerType.current === 'mouse' && setHover(null)}
          onKeyDown={onKey}
          onFocus={() => setHover((h) => h ?? (times.length ? times.length - 1 : null))}
          onBlur={() => setHover(null)}
        >
          <defs>
            {series.map(
              (s) =>
                s.area && (
                  <linearGradient key={s.id} id={`${gradId}-${s.id}`} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity="0.22" />
                    <stop offset="100%" stopColor={s.color} stopOpacity="0" />
                  </linearGradient>
                ),
            )}
          </defs>

          {/* grid + y axis */}
          <g className="grid">
            {geo.yt.ticks.map((t, i) => (
              <g key={t}>
                <line x1={geo.padLeft} x2={geo.padLeft + geo.plotW} y1={geo.y(t)} y2={geo.y(t)} className={zeroLine && t === 0 ? 'zero' : undefined} />
                <text x={geo.padLeft - 8} y={geo.y(t)} dy="0.32em" textAnchor="end">
                  {geo.labels[i]}
                </text>
              </g>
            ))}
          </g>
          <g className="x-axis">
            {geo.xt.map((t) => (
              <text key={t.t} x={geo.x(t.t)} y={height - 8} textAnchor="middle">
                {t.label}
              </text>
            ))}
          </g>

          {/* data */}
          <g className="marks">
            {series.map(
              (s, k) =>
                s.area && <path key={`a-${s.id}`} d={areaPath(geo.xs, ys[k], floor)} fill={`url(#${gradId}-${s.id})`} className="area" />,
            )}
            {series.map((s, k) => (
              <path
                key={s.id}
                d={linePath(geo.xs, ys[k])}
                stroke={s.color}
                className={`line${s.dashed ? ' dashed' : ''}${s.dim ? ' dim' : ''}`}
              />
            ))}
          </g>

          {ends.map((e) => (
            <g key={`end-${e.id}`} className={`end-label${e.dim ? ' dim' : ''}`} transform={`translate(${geo.padLeft + geo.plotW + 8},${e.y})`}>
              <text className="end-code" dy="-0.15em">
                {e.label}
              </text>
              <text className="end-value" dy="1.05em">
                {formatValue(e.value)}
              </text>
            </g>
          ))}

          {/* hover layer */}
          {hx != null && (
            <g className="crosshair">
              <line x1={hx} x2={hx} y1={PAD_TOP} y2={floor} />
              {series.map((s, k) => {
                const y = hover != null ? ys[k][hover] : null
                return y == null ? null : <circle key={s.id} cx={hx} cy={y} r={4.5} fill={s.color} className="dot" />
              })}
            </g>
          )}
        </svg>
      )}

      {hover != null && hx != null && rows.length > 0 && (
        <div
          className="tooltip"
          role="status"
          style={{
            left: tipLeft ? undefined : hx + 14,
            right: tipLeft ? width - hx + 14 : undefined,
          }}
        >
          <div className="tooltip-date">{formatDate(times[hover])}</div>
          {rows.map(({ s, v }) => (
            <div className="tooltip-row" key={s.id}>
              <span className={`key${s.dashed ? ' dashed' : ''}`} style={{ borderColor: s.color }} />
              <strong>{formatValue(v)}</strong>
              <span className="tooltip-label">{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
