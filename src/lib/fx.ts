/**
 * Exchange-rate data.
 *
 * 1. Committed snapshot: one file per currency (public/data/fx/<CODE>.json, units per 1 USD,
 *    daily since 1999), so the app only downloads the currencies on screen. Same-origin and
 *    cacheable; works even if the live API is unreachable.
 * 2. Days newer than the snapshot are topped up from frankfurter.dev (free, CORS-enabled).
 *    If that fails the app simply shows the snapshot.
 * 3. Any pair is a cross rate: quote/USD ÷ base/USD. Sources publish on different calendars
 *    (some skip weekends, some don't), so each leg carries its last value forward for a few days.
 */
const API = 'https://api.frankfurter.dev/v2'
const DATA = `${import.meta.env.BASE_URL}data/fx/`
const DAY = 86_400_000
/** Longest a quote is carried forward across missing days before the line breaks. */
const MAX_STALE_DAYS = 7

export interface RateTable {
  base: string
  /** ISO dates (YYYY-MM-DD), ascending. */
  dates: string[]
  /** epoch ms for each date */
  times: number[]
  /** units of quote currency per 1 base, aligned with `dates`; null when unavailable */
  rates: Record<string, (number | null)[]>
}

export interface DataStatus {
  /** Last date with data. */
  asOf: string
  /** Whether the newest days came from the live API (false = snapshot only). */
  live: boolean
}

interface Series {
  times: number[]
  values: number[]
  live: boolean
}

interface SnapshotFile {
  start: string
  d: number[]
  v: number[]
}

interface IndexFile {
  end: string
}

const toTime = (iso: string) => Date.parse(iso + 'T00:00:00Z')
const toIso = (t: number) => new Date(t).toISOString().slice(0, 10)

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} returned ${res.status}`)
  return (await res.json()) as T
}

type LiveRow = { date: string; quote: string; rate: number }

async function fetchLive(code: string, from: string): Promise<{ times: number[]; values: number[] }> {
  const rows = await getJson<LiveRow[]>(`${API}/rates?base=USD&quotes=${encodeURIComponent(code)}&from=${from}`)
  const pts = rows.filter((r) => r.quote === code && r.date >= from && r.rate > 0).sort((a, b) => (a.date < b.date ? -1 : 1))
  return { times: pts.map((p) => toTime(p.date)), values: pts.map((p) => p.rate) }
}

let index: Promise<IndexFile | null> | null = null
const getIndex = () => (index ??= getJson<IndexFile>(`${DATA}index.json`).catch(() => null))

async function loadSeries(code: string): Promise<Series> {
  const idx = await getIndex()
  let snap: SnapshotFile | null = null
  try {
    snap = await getJson<SnapshotFile>(`${DATA}${code}.json`)
  } catch {
    snap = null
  }
  if (!snap) {
    // Not in the snapshot: take the whole history from the live API.
    const live = await fetchLive(code, '1999-01-01')
    if (live.times.length === 0) throw new Error(`No exchange-rate data for ${code}`)
    return { ...live, live: true }
  }
  const times: number[] = []
  let t = toTime(snap.start)
  for (const d of snap.d) times.push((t += d * DAY))
  const values = [...snap.v]
  const snapEnd = idx?.end && idx.end > toIso(times[times.length - 1]) ? toTime(idx.end) : times[times.length - 1]
  try {
    const tail = await fetchLive(code, toIso(snapEnd + DAY))
    tail.times.forEach((tt, i) => {
      if (tt > times[times.length - 1]) {
        times.push(tt)
        values.push(tail.values[i])
      }
    })
    return { times, values, live: true }
  } catch {
    return { times, values, live: false } // offline or API down
  }
}

const cache = new Map<string, Promise<Series>>()
function getSeries(code: string): Promise<Series> {
  let p = cache.get(code)
  if (!p) {
    p = loadSeries(code)
    cache.set(code, p)
    p.catch(() => cache.delete(code))
  }
  return p
}

/** Retry after a failure starts from scratch. */
export function resetRates() {
  cache.clear()
  index = null
}

/** Value of `s` at each of `times`, carrying the last quote forward up to MAX_STALE_DAYS. */
function align(s: Series, times: number[]): (number | null)[] {
  const out: (number | null)[] = new Array(times.length)
  let j = -1
  for (let i = 0; i < times.length; i++) {
    while (j + 1 < s.times.length && s.times[j + 1] <= times[i]) j++
    out[i] = j >= 0 && times[i] - s.times[j] <= MAX_STALE_DAYS * DAY ? s.values[j] : null
  }
  return out
}

export async function loadRates(base: string, codes: string[], start: string): Promise<{ table: RateTable; status: DataStatus }> {
  const quotes = [...new Set(codes)].filter((c) => c !== base)
  const needed = [...new Set([base, ...quotes])].filter((c) => c !== 'USD')
  const loaded = await Promise.all(needed.map((c) => getSeries(c).then((s) => [c, s] as const)))
  const series = new Map(loaded)

  const t0 = toTime(start)
  const all = new Set<number>()
  for (const s of series.values()) for (const t of s.times) if (t >= t0) all.add(t)
  const times = [...all].sort((a, b) => a - b)

  const usd = (code: string): (number | null)[] => (code === 'USD' ? times.map(() => 1) : align(series.get(code)!, times))
  const b = usd(base)
  const rates: Record<string, (number | null)[]> = {}
  for (const q of quotes) {
    const qv = usd(q)
    rates[q] = times.map((_, i) => {
      const x = qv[i]
      const y = b[i]
      return x == null || y == null || y === 0 ? null : x / y
    })
  }

  const asOf = times.length ? toIso(times[times.length - 1]) : start
  const live = loaded.length === 0 || loaded.every(([, s]) => s.live)
  return { table: { base, dates: times.map(toIso), times, rates }, status: { asOf, live } }
}
