/**
 * Finds stretches of a currency's history that a reader (or the inflation adjustment) should not
 * take at face value. Runs on the raw per-currency series (units per 1 USD), no AI involved.
 *
 *  - jump:    a move of ≥50% within a few days that sticks. Real devaluations (e.g. ARS, Dec 2023)
 *             are "info"; moves of ≥5× usually mean a redenomination or a change in which rate the
 *             source reports, so they are a "caveat".
 *  - erratic: big moves that reverse within days, or many of them close together: the source is
 *             flipping between inconsistent values (bad data). Always a "caveat".
 *  - frozen:  a year or more within ±1% while local inflation runs ≥10 points/yr above US
 *             inflation: an official rate rather than a market price, so the inflation-adjusted
 *             line overstates how the currency moved. Always a "caveat". Ordinary pegs with
 *             ordinary inflation (HKD, AED, ...) are not flagged.
 */

const DAY = 86_400_000

export type AnomalyKind = 'jump' | 'erratic' | 'frozen'

export interface Anomaly {
  code: string
  kind: AnomalyKind
  /** "caveat" = comparisons across this stretch are unreliable; "info" = a real, notable move. */
  severity: 'info' | 'caveat'
  /** epoch ms; for a jump: the last quote before it and the first quote after it. */
  start: number
  end: number
  /** Units per USD: before/after for a jump, min/max for frozen and erratic stretches. */
  from: number
  to: number
  /** jump: after ÷ before (> 1 means the currency lost value against the dollar). */
  ratio?: number
  /** erratic: how many big moves the stretch contains. */
  moves?: number
  /** frozen: cumulative inflation over the stretch, e.g. 5.2 for +520 %. */
  inflation?: { local: number; usd: number }
}

/** Cumulative inflation of a currency between two timestamps, or null without CPI data. */
export type InflationFn = (code: string, from: number, to: number) => number | null

export const JUMP_RATIO = 1.5
export const EXTREME_RATIO = 5
const MAX_GAP = 7 * DAY // quotes further apart than this are not "one move"
const CLUSTER_GAP = 45 * DAY
const FROZEN_BAND = 1.02 // max/min within the stretch
const FROZEN_MIN = 365 * DAY
const FROZEN_EXCESS_INFLATION = 0.1 // 10 points per year above US inflation

interface Step {
  i: number // index of the quote after the move
  ratio: number
}

export function detectAnomalies(code: string, times: number[], values: number[], inflation: InflationFn): Anomaly[] {
  const out: Anomaly[] = []

  // ---- big steps between consecutive quotes ----
  const steps: Step[] = []
  for (let i = 1; i < values.length; i++) {
    if (times[i] - times[i - 1] > MAX_GAP) continue
    const r = values[i] / values[i - 1]
    if (r >= JUMP_RATIO || r <= 1 / JUMP_RATIO) steps.push({ i, ratio: r })
  }

  // Group steps that are close in time, then decide what each group is.
  const groups: Step[][] = []
  for (const s of steps) {
    const g = groups[groups.length - 1]
    if (g && times[s.i] - times[g[g.length - 1].i] <= CLUSTER_GAP) g.push(s)
    else groups.push([s])
  }
  for (const g of groups) {
    const first = g[0]
    const last = g[g.length - 1]
    const sameDirection = g.every((s) => s.ratio > 1 === first.ratio > 1)
    const quick = times[last.i] - times[first.i] <= 14 * DAY
    if (sameDirection && quick && g.length <= 3) {
      const before = values[first.i - 1]
      const after = values[last.i]
      const ratio = after / before
      out.push({
        code,
        kind: 'jump',
        severity: ratio >= EXTREME_RATIO || ratio <= 1 / EXTREME_RATIO ? 'caveat' : 'info',
        start: times[first.i - 1],
        end: times[last.i],
        from: before,
        to: after,
        ratio,
      })
    } else {
      let lo = Infinity
      let hi = -Infinity
      for (let i = first.i - 1; i <= last.i; i++) {
        lo = Math.min(lo, values[i])
        hi = Math.max(hi, values[i])
      }
      out.push({ code, kind: 'erratic', severity: 'caveat', start: times[first.i - 1], end: times[last.i], from: lo, to: hi, moves: g.length })
    }
  }

  // ---- long, nearly flat stretches during high inflation ----
  let i = 0
  while (i < values.length) {
    let lo = values[i]
    let hi = values[i]
    let j = i
    while (j + 1 < values.length) {
      const v = values[j + 1]
      const nlo = Math.min(lo, v)
      const nhi = Math.max(hi, v)
      if (nhi / nlo > FROZEN_BAND) break
      lo = nlo
      hi = nhi
      j++
    }
    const span = times[j] - times[i]
    if (span >= FROZEN_MIN) {
      const local = inflation(code, times[i], times[j])
      const usd = inflation('USD', times[i], times[j])
      if (local != null && usd != null) {
        const years = span / (365.25 * DAY)
        const excess = Math.pow((1 + local) / (1 + usd), 1 / years) - 1
        if (excess >= FROZEN_EXCESS_INFLATION) {
          out.push({ code, kind: 'frozen', severity: 'caveat', start: times[i], end: times[j], from: lo, to: hi, inflation: { local, usd } })
        }
      }
      i = j + 1
    } else i++
  }

  return out.sort((a, b) => a.start - b.start)
}

/** Events that overlap [t0, t1]. */
export function inRange(events: Anomaly[], t0: number, t1: number): Anomaly[] {
  return events.filter((e) => e.end >= t0 && e.start <= t1)
}

/**
 * Stable id for an event, shared by the app and scripts/explain-events.ts. It uses the start
 * date, which doesn't move as new data arrives (a frozen stretch's end date does).
 */
export function anomalyKey(a: Pick<Anomaly, 'kind' | 'start'>): string {
  return `${a.kind}@${new Date(a.start).toISOString().slice(0, 10)}`
}
