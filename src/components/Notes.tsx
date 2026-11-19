import type { Anomaly } from '../lib/anomalies'
import { CURRENCY } from '../lib/currencies'
import type { AnomalyText } from '../lib/describe'
import { explanationKey, type Explanation } from '../lib/explanations'
import { formatDate, formatMonth } from '../lib/format'

export type Note = Anomaly & { n: number; text: AnomalyText }

/** The numbered notes behind the chart's badges. Found by statistics on the data, not by AI. */
export function Notes({ notes, color, explanations }: { notes: Note[]; color: (code: string) => string; explanations: Map<string, Explanation> }) {
  const anyExplained = notes.some((n) => explanations.has(explanationKey(n)))
  return (
    <section className="notes" aria-labelledby="notes-title">
      <h3 id="notes-title">Notes on this chart</h3>
      <ol>
        {notes.map((n) => (
          <li key={n.n} id={`note-${n.n}`}>
            <span className="note-num" style={{ background: color(n.code) }} aria-hidden="true">
              {n.n}
            </span>
            <div>
              <p className="note-title">
                <span aria-hidden="true">{CURRENCY[n.code]?.flag}</span> {n.text.title}
                {n.severity === 'caveat' && <span className="tag tag-caveat">data caveat</span>}
              </p>
              <p className="note-when">
                {n.code} · {n.kind === 'jump' ? formatDate(n.end) : `${formatMonth(n.start)} – ${formatMonth(n.end)}`}
              </p>
              <Why e={explanations.get(explanationKey(n))} />
              <p className="note-body">{n.text.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="notes-foot">
        Notes are found automatically from unusual patterns in the data.
        {anyExplained
          ? ' “Why” summaries are written by AI (Claude) from the linked Wikipedia article and checked against it; they can still be wrong.'
          : ' They describe what happened, not why.'}
      </p>
    </section>
  )
}

function Why({ e }: { e?: Explanation }) {
  if (!e?.explanation || !e.source) return null
  return (
    <div className="note-why">
      <p>
        <span className="note-why-label">Why: </span>
        {e.explanation}
      </p>
      <details>
        <summary>
          Source: Wikipedia, <cite>{e.source.title}</cite>
        </summary>
        <blockquote>“{e.quote}”</blockquote>
        <a href={`${e.source.url}?oldid=${e.source.revision}`} target="_blank" rel="noreferrer">
          Read the article version this summary used ↗
        </a>
      </details>
    </div>
  )
}
