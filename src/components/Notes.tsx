import type { Anomaly } from '../lib/anomalies'
import { CURRENCY } from '../lib/currencies'
import type { AnomalyText } from '../lib/describe'
import { formatDate, formatMonth } from '../lib/format'

export type Note = Anomaly & { n: number; text: AnomalyText }

/** The numbered notes behind the chart's badges. Found by statistics on the data, not by AI. */
export function Notes({ notes, color }: { notes: Note[]; color: (code: string) => string }) {
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
              <p className="note-body">{n.text.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="notes-foot">Found automatically by looking for unusual patterns in the data. They describe what happened, not why.</p>
    </section>
  )
}
