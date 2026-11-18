/** Daily reference rates from the European Central Bank via frankfurter.dev (free, no key, CORS-enabled). */
const API = 'https://api.frankfurter.dev/v1'

export interface RateTable {
  base: string
  /** ISO dates (YYYY-MM-DD), ascending. */
  dates: string[]
  /** epoch ms for each date */
  times: number[]
  /** units of quote currency per 1 base, aligned with `dates`; null when not quoted that day */
  rates: Record<string, (number | null)[]>
}

export interface RateSeries {
  dates: string[]
  values: number[]
}

const cache = new Map<string, Promise<RateSeries>>()

/** One currency pair per request so adding or removing a currency never refetches the others. */
export function fetchSeries(base: string, quote: string, start: string): Promise<RateSeries> {
  const key = `${base}|${quote}|${start}`
  let p = cache.get(key)
  if (!p) {
    p = load(base, quote, start)
    cache.set(key, p)
    p.catch(() => cache.delete(key))
  }
  return p
}

async function load(base: string, quote: string, start: string): Promise<RateSeries> {
  const url = `${API}/${start}..?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(quote)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Exchange-rate service returned ${res.status}`)
  const json = (await res.json()) as { rates: Record<string, Record<string, number>> }
  const dates = Object.keys(json.rates).sort()
  const out: RateSeries = { dates: [], values: [] }
  for (const d of dates) {
    const v = json.rates[d][quote]
    if (typeof v === 'number') {
      out.dates.push(d)
      out.values.push(v)
    }
  }
  return out
}

/** Aligns several pair series on the union of their dates. */
export function mergeSeries(base: string, series: Record<string, RateSeries>): RateTable {
  const all = new Set<string>()
  for (const s of Object.values(series)) for (const d of s.dates) all.add(d)
  const dates = [...all].sort()
  const pos = new Map(dates.map((d, i) => [d, i]))
  const rates: Record<string, (number | null)[]> = {}
  for (const [code, s] of Object.entries(series)) {
    const arr: (number | null)[] = new Array(dates.length).fill(null)
    s.dates.forEach((d, i) => (arr[pos.get(d)!] = s.values[i]))
    rates[code] = arr
  }
  return { base, dates, times: dates.map((d) => Date.parse(d + 'T00:00:00Z')), rates }
}
