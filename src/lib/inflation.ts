import data from '../data/inflation.json'
import { buildPriceIndex, type PriceIndex } from './price-index'

export { buildPriceIndex, type PriceIndex }

export interface InflationData {
  source: string
  url: string
  fetchedAt: string
  projectedFrom: number
  series: Record<string, Record<string, number>>
}

export const INFLATION = data as InflationData

const DAY = 86_400_000

export const hasInflation = (code: string): boolean => code in INFLATION.series

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
