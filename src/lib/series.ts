import type { RateTable } from './fx'
import { priceIndex, realFactor } from './inflation'

export interface PairSeries {
  code: string
  nominal: (number | null)[]
  /** Inflation-adjusted, expressed in the purchasing power of the latest date. */
  real: (number | null)[]
}

export function derivePairs(table: RateTable, codes: string[]): PairSeries[] {
  const anchor = table.times[table.times.length - 1]
  const baseIdx = priceIndex(table.base)
  return codes.map((code) => {
    const nominal = table.rates[code] ?? table.times.map(() => null)
    const quoteIdx = priceIndex(code)
    const real =
      baseIdx && quoteIdx
        ? nominal.map((v, i) => (v == null ? null : v * realFactor(baseIdx, quoteIdx, table.times[i], anchor)))
        : nominal.map(() => null)
    return { code, nominal, real }
  })
}

export function firstLast(values: (number | null)[]): { first: number | null; last: number | null; firstIndex: number } {
  let firstIndex = values.findIndex((v) => v != null)
  let lastIndex = values.length - 1
  while (lastIndex >= 0 && values[lastIndex] == null) lastIndex--
  if (firstIndex < 0) firstIndex = 0
  return { first: values[firstIndex] ?? null, last: lastIndex >= 0 ? values[lastIndex] : null, firstIndex }
}

export function change(values: (number | null)[]): number | null {
  const { first, last } = firstLast(values)
  if (first == null || last == null || first === 0) return null
  return last / first - 1
}

/** Re-expresses a series as % change from its first available value. */
export function indexed(values: (number | null)[]): (number | null)[] {
  const { first } = firstLast(values)
  if (first == null || first === 0) return values.map(() => null)
  return values.map((v) => (v == null ? null : v / first - 1))
}

/** Evenly thins a series to at most `max` positions, always keeping the last one. */
export function sampleIndices(n: number, max: number): number[] {
  if (n <= max) return Array.from({ length: n }, (_, i) => i)
  const out: number[] = []
  const step = (n - 1) / (max - 1)
  for (let i = 0; i < max; i++) out.push(Math.round(i * step))
  return out
}

/** "Nice" axis ticks (1-2-5 steps). */
export function niceTicks(min: number, max: number, target = 5): { ticks: number[]; step: number; min: number; max: number } {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { ticks: [], step: 1, min: 0, max: 1 }
  if (min === max) {
    const pad = Math.abs(min) * 0.05 || 1
    min -= pad
    max += pad
  }
  const raw = (max - min) / Math.max(1, target)
  const mag = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / mag
  const st = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag
  const lo = Math.floor(min / st) * st
  const hi = Math.ceil(max / st) * st
  const ticks: number[] = []
  for (let v = lo; v <= hi + st / 2; v += st) ticks.push(Math.abs(v) < st / 1e6 ? 0 : v)
  return { ticks, step: st, min: lo, max: hi }
}

export interface TimeTick {
  t: number
  label: string
}

/** Calendar-aligned ticks: years for long ranges, months for short ones. */
export function timeTicks(t0: number, t1: number, maxTicks: number, fmtYear: (t: number) => string, fmtMonth: (t: number) => string): TimeTick[] {
  const years = (t1 - t0) / (365.25 * 86_400_000)
  const out: TimeTick[] = []
  if (years >= 2) {
    const yStep = [1, 2, 5, 10].find((s) => years / s <= maxTicks) ?? 10
    const startY = new Date(t0).getUTCFullYear() + 1
    for (let y = Math.ceil(startY / yStep) * yStep; ; y += yStep) {
      const t = Date.UTC(y, 0, 1)
      if (t > t1) break
      if (t >= t0) out.push({ t, label: fmtYear(t) })
    }
  } else {
    const months = years * 12
    const mStep = [1, 2, 3, 6].find((s) => months / s <= maxTicks) ?? 6
    const d = new Date(t0)
    let y = d.getUTCFullYear()
    let m = d.getUTCMonth() + 1
    m = Math.ceil(m / mStep) * mStep
    for (;;) {
      if (m >= 12) {
        y += Math.floor(m / 12)
        m %= 12
      }
      const t = Date.UTC(y, m, 1)
      if (t > t1) break
      out.push({ t, label: m === 0 ? String(y) : fmtMonth(t) })
      m += mStep
    }
  }
  return out
}
