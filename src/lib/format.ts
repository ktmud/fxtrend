const cache = new Map<string, Intl.NumberFormat>()
function nf(opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = JSON.stringify(opts)
  let f = cache.get(key)
  if (!f) {
    f = new Intl.NumberFormat(undefined, opts)
    cache.set(key, f)
  }
  return f
}

/** Exchange rates span 0.0001 → 20 000, so precision follows magnitude. */
export function formatRate(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—'
  const a = Math.abs(v)
  if (a >= 1000) return nf({ maximumFractionDigits: 0 }).format(v)
  if (a >= 100) return nf({ minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
  if (a >= 1) return nf({ minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(v)
  return nf({ maximumSignificantDigits: 4, minimumSignificantDigits: 4 }).format(v)
}

/** Compact axis labels. */
export function formatTick(v: number, step: number): string {
  const a = Math.abs(step)
  const digits = a >= 1 ? 0 : Math.min(6, Math.ceil(-Math.log10(a) + 0.0001))
  if (Math.abs(v) >= 10_000) return nf({ notation: 'compact', maximumFractionDigits: 1 }).format(v)
  return nf({ minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v)
}

export function formatPct(v: number | null | undefined, digits = 1, signed = true): string {
  if (v == null || !Number.isFinite(v)) return '—'
  const s = nf({ style: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Math.abs(v))
  if (!signed) return s
  if (Math.abs(v) < 0.5 * 10 ** -(digits + 2)) return s
  return (v > 0 ? '+' : '−') + s
}

const dateFmt = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
const monthFmt = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', timeZone: 'UTC' })
const monthOnly = new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' })
export const formatDate = (t: number) => dateFmt.format(t)
export const formatMonth = (t: number) => monthFmt.format(t)
export const formatMonthShort = (t: number) => monthOnly.format(t)
