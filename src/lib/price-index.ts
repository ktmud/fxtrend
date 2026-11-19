// Pure price-index math with no imports, so plain Node can load it
// (scripts/explain-events.ts uses it with --experimental-strip-types).

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

/** Cumulative inflation between two timestamps from a table of annual rates, or null without data. */
export function cumulativeFrom(series: Record<string, Record<string, number>>) {
  const cache = new Map<string, PriceIndex>()
  return (code: string, from: number, to: number): number | null => {
    const annual = series[code]
    if (!annual) return null
    let idx = cache.get(code)
    if (!idx) cache.set(code, (idx = buildPriceIndex(annual)))
    return idx.at(to) / idx.at(from) - 1
  }
}
