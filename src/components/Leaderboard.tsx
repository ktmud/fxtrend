import { CURRENCY } from '../lib/currencies'
import { formatPct } from '../lib/format'

export interface LeaderRow {
  code: string
  color: string
  value: number | null
  /** Not comparable with the others ("nominal" when the rest are real, "data caveat"): ranked last. */
  tag?: string
}

interface Props {
  rows: LeaderRow[]
  /** Fixed scale for the whole time range, so bars grow and shrink in a stable frame while scrubbing. */
  domain: [number, number]
  caption: string
}

const ROW = 40

/** Diverging bars, ranked; rows glide to their new rank as the reader scrubs through time. */
export function Leaderboard({ rows, domain, caption }: Props) {
  const lo = Math.min(0, domain[0])
  const hi = Math.max(0, domain[1])
  const span = hi - lo || 1
  const zero = ((0 - lo) / span) * 100
  const ranked = [...rows].sort((a, b) => Number(!!a.tag) - Number(!!b.tag) || (b.value ?? -Infinity) - (a.value ?? -Infinity))
  const rank = new Map(ranked.map((r, i) => [r.code, i]))
  return (
    <figure className="leaderboard">
      <figcaption>{caption}</figcaption>
      <ol style={{ height: rows.length * ROW }}>
        {rows.map((r) => {
          const v = r.value
          const left = v == null ? zero : Math.min(zero, ((v - lo) / span) * 100)
          const width = v == null ? 0 : (Math.abs(v) / span) * 100
          return (
            <li key={r.code} className={r.tag ? 'is-tagged' : undefined} style={{ transform: `translateY(${(rank.get(r.code) ?? 0) * ROW}px)` }}>
              <span className="lb-id">
                <span aria-hidden="true">{CURRENCY[r.code]?.flag}</span> {r.code}
                {r.tag && <span className="tag">{r.tag}</span>}
              </span>
              <span className="lb-track">
                <span className="lb-zero" style={{ left: `${zero}%` }} />
                <span className="lb-bar" style={{ left: `${left}%`, width: `${width}%`, background: r.color }} />
              </span>
              <span className="lb-value">{formatPct(v, 1)}</span>
            </li>
          )
        })}
      </ol>
    </figure>
  )
}
