import { useEffect, useState } from 'react'
import { fetchSeries, mergeSeries, type RateSeries, type RateTable } from './fx'

interface Result {
  table: RateTable | null
  loading: boolean
  error: string | null
  retry: () => void
}

/** Loads every pair, keeping the previous table on screen while new data arrives. */
export function useRates(base: string, codes: string[], start: string): Result {
  const [table, setTable] = useState<RateTable | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const key = codes.join(',')

  useEffect(() => {
    let live = true
    const list = key ? key.split(',') : []
    setLoading(true)
    setError(null)
    Promise.all(list.map((c) => fetchSeries(base, c, start).then((s) => [c, s] as const)))
      .then((pairs) => {
        if (!live) return
        const map: Record<string, RateSeries> = Object.fromEntries(pairs)
        setTable(mergeSeries(base, map))
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (!live) return
        setError(e instanceof Error ? e.message : 'Could not load exchange rates')
        setLoading(false)
      })
    return () => {
      live = false
    }
  }, [base, key, start, attempt])

  return { table, loading, error, retry: () => setAttempt((a) => a + 1) }
}
