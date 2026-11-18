import { useEffect, useState } from 'react'
import { isCurrency } from './currencies'
import { MAX_SERIES } from './palette'

export type RangeKey = '1Y' | '5Y' | '10Y' | '20Y' | 'MAX'
export const RANGES: readonly { value: RangeKey; label: string }[] = [
  { value: '1Y', label: '1Y' },
  { value: '5Y', label: '5Y' },
  { value: '10Y', label: '10Y' },
  { value: '20Y', label: '20Y' },
  { value: 'MAX', label: 'Max' },
]

export interface Pick {
  code: string
  /** Colour slot, fixed for as long as the currency stays selected. */
  slot: number
}

export interface AppState {
  base: string
  picks: Pick[]
  range: RangeKey
  adjusted: boolean
  focus: string | null
}

const DEFAULT: AppState = {
  base: 'USD',
  picks: ['EUR', 'JPY', 'GBP', 'MXN'].map((code, slot) => ({ code, slot })),
  range: '10Y',
  adjusted: true,
  focus: null,
}

const STORAGE_KEY = 'fxtrend:v1'

function parse(params: URLSearchParams, fallback: AppState): AppState {
  const base = params.get('base')?.toUpperCase()
  const to = params
    .get('to')
    ?.toUpperCase()
    .split(',')
    .filter((c, i, a) => isCurrency(c) && a.indexOf(c) === i)
  const range = params.get('range')?.toUpperCase() as RangeKey | undefined
  const real = params.get('real')
  const focus = params.get('focus')?.toUpperCase() ?? null
  const b = base && isCurrency(base) ? base : fallback.base
  const picks = to ? to.filter((c) => c !== b).slice(0, MAX_SERIES).map((code, slot) => ({ code, slot })) : fallback.picks.filter((p) => p.code !== b)
  return {
    base: b,
    picks,
    range: range && RANGES.some((r) => r.value === range) ? range : fallback.range,
    adjusted: real == null ? fallback.adjusted : real !== '0',
    focus: focus && picks.some((p) => p.code === focus) ? focus : null,
  }
}

function initial(): AppState {
  let stored = DEFAULT
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) stored = parse(new URLSearchParams(raw), DEFAULT)
  } catch {
    /* private mode */
  }
  const url = new URLSearchParams(window.location.search)
  return url.has('base') || url.has('to') ? parse(url, stored) : stored
}

function serialise(s: AppState): string {
  const p = new URLSearchParams()
  p.set('base', s.base)
  p.set('to', s.picks.map((x) => x.code).join(','))
  p.set('range', s.range)
  p.set('real', s.adjusted ? '1' : '0')
  if (s.focus) p.set('focus', s.focus)
  return p.toString().replace(/%2C/g, ',')
}

/** App state mirrored to the URL (shareable) and localStorage (sticky). */
export function useAppState() {
  const [state, setState] = useState<AppState>(initial)
  useEffect(() => {
    const qs = serialise(state)
    window.history.replaceState(null, '', `${window.location.pathname}?${qs}`)
    try {
      localStorage.setItem(STORAGE_KEY, qs)
    } catch {
      /* ignore */
    }
  }, [state])
  return [state, setState] as const
}

export function nextSlot(picks: Pick[]): number {
  for (let s = 0; s < MAX_SERIES; s++) if (!picks.some((p) => p.slot === s)) return s
  return -1
}

export function rangeStart(range: RangeKey, now = new Date()): string {
  if (range === 'MAX') return '1999-01-04'
  const years = parseInt(range, 10)
  const d = new Date(Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate()))
  return d.toISOString().slice(0, 10)
}
