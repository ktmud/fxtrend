import { useEffect, useState } from 'react'
import type { Anomaly } from './anomalies'
import { loadRates, resetRates, type DataStatus, type RateTable } from './fx'

interface Result {
  table: RateTable | null
  status: DataStatus | null
  /** Anomalies of the base and selected currencies that overlap the loaded range. */
  anomalies: Anomaly[]
  loading: boolean
  error: string | null
  retry: () => void
}

/** Loads rates for the selection, keeping the previous table on screen while new data arrives. */
export function useRates(base: string, codes: string[], start: string): Result {
  const [table, setTable] = useState<RateTable | null>(null)
  const [status, setStatus] = useState<DataStatus | null>(null)
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const key = codes.join(',')

  useEffect(() => {
    let live = true
    setLoading(true)
    setError(null)
    loadRates(base, key ? key.split(',') : [], start)
      .then((r) => {
        if (!live) return
        setTable(r.table)
        setStatus(r.status)
        setAnomalies(r.anomalies)
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

  return {
    table,
    status,
    anomalies,
    loading,
    error,
    retry: () => {
      resetRates()
      setAttempt((a) => a + 1)
    },
  }
}
