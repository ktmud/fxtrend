/**
 * Exchange-rate data.
 *
 * 1. A committed snapshot of ECB daily reference rates (public/data/fx-eur.json, all
 *    currencies per 1 EUR since 1999) is the primary source: same-origin, cacheable,
 *    and works even if the live API is unreachable.
 * 2. Days newer than the snapshot are topped up from frankfurter.dev (free, CORS-enabled).
 *    If that fails the app simply shows the snapshot.
 * 3. Any base is derived as a cross rate: quote/EUR ÷ base/EUR.
 */
const API = 'https://api.frankfurter.dev/v1'
const SNAPSHOT_URL = `${import.meta.env.BASE_URL}data/fx-eur.json`

export interface RateTable {
  base: string
  /** ISO dates (YYYY-MM-DD), ascending. */
  dates: string[]
  /** epoch ms for each date */
  times: number[]
  /** units of quote currency per 1 base, aligned with `dates`; null when not quoted that day */
  rates: Record<string, (number | null)[]>
}

export interface DataStatus {
  /** Last date with data. */
  asOf: string
  /** Whether the newest days came from the live API (false = snapshot only). */
  live: boolean
}

interface EurHistory {
  dates: string[]
  /** per 1 EUR; EUR itself is implicitly 1 */
  rates: Record<string, (number | null)[]>
  live: boolean
}

interface Snapshot {
  end: string
  dates: string[]
  rates: Record<string, (number | null)[]>
}

const dayAfter = (iso: string) => new Date(Date.parse(iso + 'T00:00:00Z') + 86_400_000).toISOString().slice(0, 10)

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} returned ${res.status}`)
  return (await res.json()) as T
}

/** Live EUR-based rates from `start` onward, every currency in one request. */
async function fetchLive(start: string): Promise<{ dates: string[]; rates: Record<string, Record<string, number>> }> {
  const json = await getJson<{ rates: Record<string, Record<string, number>> }>(`${API}/${start}..?base=EUR`)
  // The API answers an empty range with the latest earlier day, so filter.
  const dates = Object.keys(json.rates).filter((d) => d >= start).sort()
  return { dates, rates: json.rates }
}

async function loadHistory(): Promise<EurHistory> {
  let snap: Snapshot | null = null
  try {
    snap = await getJson<Snapshot>(SNAPSHOT_URL)
  } catch {
    snap = null
  }

  if (!snap) {
    // No snapshot (e.g. a dev checkout without data): fall back to the live API alone.
    const live = await fetchLive('1999-01-04')
    const codes = new Set(live.dates.flatMap((d) => Object.keys(live.rates[d])))
    const rates: Record<string, (number | null)[]> = {}
    for (const c of codes) rates[c] = live.dates.map((d) => live.rates[d][c] ?? null)
    return { dates: live.dates, rates, live: true }
  }

  const dates = [...snap.dates]
  const rates: Record<string, (number | null)[]> = Object.fromEntries(Object.entries(snap.rates).map(([c, v]) => [c, [...v]]))
  let live = false
  try {
    const tail = await fetchLive(dayAfter(snap.end))
    for (const d of tail.dates) {
      dates.push(d)
      for (const c of Object.keys(rates)) rates[c].push(tail.rates[d][c] ?? null)
    }
    live = true
  } catch {
    /* offline or API down: the snapshot is still a complete history */
  }
  return { dates, rates, live }
}

let history: Promise<EurHistory> | null = null
function getHistory(): Promise<EurHistory> {
  if (!history) {
    history = loadHistory()
    history.catch(() => (history = null))
  }
  return history
}

/** Retry after a failure starts from scratch. */
export function resetRates() {
  history = null
}

const eurRate = (h: EurHistory, code: string, i: number): number | null => (code === 'EUR' ? 1 : (h.rates[code]?.[i] ?? null))

export async function loadRates(base: string, codes: string[], start: string): Promise<{ table: RateTable; status: DataStatus }> {
  const h = await getHistory()
  let from = h.dates.findIndex((d) => d >= start)
  if (from < 0) from = h.dates.length
  const dates = h.dates.slice(from)
  const rates: Record<string, (number | null)[]> = {}
  for (const code of codes) {
    if (code === base) continue
    rates[code] = dates.map((_, k) => {
      const i = from + k
      const b = eurRate(h, base, i)
      const q = eurRate(h, code, i)
      return b == null || q == null || b === 0 ? null : q / b
    })
  }
  return {
    table: { base, dates, times: dates.map((d) => Date.parse(d + 'T00:00:00Z')), rates },
    status: { asOf: h.dates[h.dates.length - 1] ?? start, live: h.live },
  }
}
