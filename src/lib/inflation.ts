import data from '../data/inflation.json'

export interface InflationData {
  source: string
  url: string
  fetchedAt: string
  projectedFrom: number
  series: Record<string, Record<string, number>>
}

export const INFLATION = data as InflationData

const DAY = 86_400_000
const midYear = (y: number) => Date.UTC(y, 6, 2) // annual averages are centred on ~2 July

export interface PriceIndex {
  /** Price level (arbitrary base) at an epoch-ms timestamp. */
  at(t: number): number
}

/**
 * Builds a continuous consumer price index from annual average inflation rates.
 * Each year's average level is placed mid-year and the curve between years is
 * interpolated geometrically (constant monthly inflation between anchors).
 */
export function buildPriceIndex(annual: Record<string, number>): PriceIndex {
  const years = Object.keys(annual).map(Number).sort((a, b) => a - b)
  if (years.length === 0) return { at: () => 1 }
  const ts: number[] = []
  const logs: number[] = []
  let log = 0
  for (const y of years) {
    log += Math.log1p(annual[y] / 100)
    ts.push(midYear(y))
    logs.push(log)
  }
  const n = ts.length
  const slope = (i: number, j: number) => (logs[j] - logs[i]) / (ts[j] - ts[i])
  return {
    at(t: number) {
      if (n === 1) return Math.exp(logs[0])
      if (t <= ts[0]) return Math.exp(logs[0] + (t - ts[0]) * slope(0, 1))
      if (t >= ts[n - 1]) return Math.exp(logs[n - 1] + (t - ts[n - 1]) * slope(n - 2, n - 1))
      // binary search for the segment containing t
      let lo = 0
      let hi = n - 1
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1
        if (ts[mid] <= t) lo = mid
        else hi = mid
      }
      return Math.exp(logs[lo] + (t - ts[lo]) * slope(lo, hi))
    },
  }
}

const cache = new Map<string, PriceIndex>()
export function priceIndex(code: string): PriceIndex | null {
  const annual = INFLATION.series[code]
  if (!annual) return null
  let idx = cache.get(code)
  if (!idx) {
    idx = buildPriceIndex(annual)
    cache.set(code, idx)
  }
  return idx
}

/**
 * Restates a nominal rate (units of `quote` per 1 `base`) observed at time `t`
 * in the purchasing power of time `anchor`:
 *
 *   real(t) = nominal(t) × [P_base(t) / P_base(anchor)] ÷ [P_quote(t) / P_quote(anchor)]
 *
 * At `anchor` the real and nominal rates coincide. Earlier points answer
 * "how many of today's `quote` units did one of today's `base` units buy back then?"
 */
export function realFactor(base: PriceIndex, quote: PriceIndex, t: number, anchor: number): number {
  return (base.at(t) / base.at(anchor)) / (quote.at(t) / quote.at(anchor))
}

/** Cumulative inflation between two timestamps, e.g. 0.25 for +25 %. */
export function cumulativeInflation(code: string, from: number, to: number): number | null {
  const idx = priceIndex(code)
  if (!idx) return null
  return idx.at(to) / idx.at(from) - 1
}

/** Average annual inflation between two timestamps. */
export function annualisedInflation(code: string, from: number, to: number): number | null {
  const cum = cumulativeInflation(code, from, to)
  if (cum === null) return null
  const years = (to - from) / (365.25 * DAY)
  if (years <= 0) return 0
  return Math.pow(1 + cum, 1 / years) - 1
}
