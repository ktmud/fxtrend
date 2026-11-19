import { useEffect, useState } from 'react'
import { anomalyKey, type Anomaly } from './anomalies'

/** Written by scripts/explain-events.ts into public/data/events/<CODE>.json. */
export interface Explanation {
  key: string
  status: 'explained' | 'not_found'
  explanation?: string
  quote?: string
  source?: { title: string; url: string; revision: number }
  model?: string
  checkedAt: string
}

const DATA = `${import.meta.env.BASE_URL}data/events/`
const getJson = async <T,>(url: string): Promise<T | null> => {
  try {
    const res = await fetch(url)
    return res.ok ? ((await res.json()) as T) : null
  } catch {
    return null // explanations are optional: the notes work without them
  }
}

let index: Promise<Set<string>> | null = null
const files = new Map<string, Promise<Map<string, Explanation>>>()

function load(code: string): Promise<Map<string, Explanation>> {
  let p = files.get(code)
  if (!p) {
    index ??= getJson<{ codes: string[] }>(`${DATA}index.json`).then((j) => new Set(j?.codes ?? []))
    p = index.then(async (have) => {
      if (!have.has(code)) return new Map()
      const f = await getJson<{ events: Explanation[] }>(`${DATA}${code}.json`)
      return new Map((f?.events ?? []).filter((e) => e.status === 'explained').map((e) => [e.key, e]))
    })
    files.set(code, p)
  }
  return p
}

export const explanationKey = (a: Pick<Anomaly, 'code' | 'kind' | 'start'>) => `${a.code}:${anomalyKey(a)}`

/** Explanations for the given anomalies, keyed by explanationKey. Empty until loaded. */
export function useExplanations(anomalies: Pick<Anomaly, 'code' | 'kind' | 'start'>[]): Map<string, Explanation> {
  const [map, setMap] = useState<Map<string, Explanation>>(new Map())
  const codes = [...new Set(anomalies.map((a) => a.code))].sort().join(',')
  useEffect(() => {
    let live = true
    Promise.all(codes ? codes.split(',').map((c) => load(c).then((m) => [c, m] as const)) : []).then((loaded) => {
      if (!live) return
      const out = new Map<string, Explanation>()
      for (const [code, m] of loaded) for (const [k, e] of m) out.set(`${code}:${k}`, e)
      setMap(out)
    })
    return () => {
      live = false
    }
  }, [codes])
  return map
}
