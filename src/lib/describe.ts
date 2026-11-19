import type { Anomaly } from './anomalies'
import { CURRENCY } from './currencies'
import { formatMonth, formatRate } from './format'

const DAY = 86_400_000

export interface AnomalyText {
  title: string
  body: string
}

const nf = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })
const times = (x: number) => (x >= 10 ? nf.format(x) : x.toFixed(1)) + '×'
const pct = (x: number) => nf.format(Math.round(x * 100)) + '%'
const days = (ms: number) => {
  const n = Math.max(1, Math.round(ms / DAY))
  return n === 1 ? '1 day' : `${n} days`
}
const span = (ms: number) => {
  const months = Math.round(ms / (30.44 * DAY))
  return months >= 24 ? `${(ms / (365.25 * DAY)).toFixed(1)} years` : `${months} months`
}

/**
 * Plain-language description of a detected anomaly. It states what the data shows and what that
 * pattern usually means, never a specific cause: explaining *why* needs sources.
 */
export function describe(a: Anomaly): AnomalyText {
  const c = a.code
  const region = CURRENCY[c]?.region ?? c
  const per = `${c} per US dollar`
  switch (a.kind) {
    case 'jump': {
      const r = a.ratio ?? a.to / a.from
      const within = days(a.end - a.start)
      if (a.severity === 'caveat') {
        return {
          title: `Rate ${r > 1 ? 'jumped' : 'dropped'} ${times(r > 1 ? r : 1 / r)} in ${within}`,
          body:
            `From ${formatRate(a.from)} to ${formatRate(a.to)} ${per}. Moves this large rarely happen in a market: ` +
            `they usually mean the currency was redenominated (zeros removed) or the source switched which rate it ` +
            `reports, for example from an official rate to a market rate. Comparisons across this date are unreliable.`,
        }
      }
      return {
        title: r > 1 ? `${c} lost ${pct(1 - 1 / r)} against the dollar in ${within}` : `${c} gained ${pct(1 / r - 1)} against the dollar in ${within}`,
        body: `From ${formatRate(a.from)} to ${formatRate(a.to)} ${per}. Moves this sharp usually come from a devaluation, a change in exchange-rate policy, or a crisis.`,
      }
    }
    case 'frozen': {
      const mid = (a.from + a.to) / 2
      const band = (a.to / a.from - 1) / 2
      const infl = a.inflation
      return {
        title: `Rate held almost fixed for ${span(a.end - a.start)}`,
        body:
          `From ${formatMonth(a.start)} to ${formatMonth(a.end)} the rate stayed within ${band < 0.005 ? '0.5%' : pct(band)} of ` +
          `${formatRate(mid)} ${per}` +
          (infl ? `, while prices in ${region} rose ${pct(infl.local)} (United States: ${pct(infl.usd)})` : '') +
          `. That points to a fixed official rate rather than what people actually paid for dollars, so the ` +
          `inflation-adjusted line for this stretch is not meaningful.`,
      }
    }
    case 'erratic':
      return {
        title: `Erratic data: ${a.moves ?? 'several'} sudden swings`,
        body:
          `Between ${formatMonth(a.start)} and ${formatMonth(a.end)} the source jumps back and forth between values as far apart as ` +
          `${formatRate(a.from)} and ${formatRate(a.to)} ${per}. That usually means it mixes different rates or currency units, so treat this stretch with caution.`,
      }
  }
}
