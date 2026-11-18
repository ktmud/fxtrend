import { useCallback, useMemo, useState } from 'react'
import { Chart, type ChartSeries } from './components/Chart'
import { Segmented, Switch } from './components/Controls'
import { CurrencySheet } from './components/CurrencySheet'
import { Sparkline } from './components/Sparkline'
import { CURRENCY } from './lib/currencies'
import { formatDate, formatMonth, formatPct, formatRate, formatTick } from './lib/format'
import { annualisedInflation, cumulativeInflation, INFLATION } from './lib/inflation'
import { MAX_SERIES, seriesVar } from './lib/palette'
import { change, derivePairs, firstLast, indexed, sampleIndices, type PairSeries } from './lib/series'
import { nextSlot, RANGES, rangeStart, useAppState, type Pick } from './lib/state'
import { useTheme } from './lib/theme'
import { useRates } from './lib/useRates'

const CHART_POINTS = 520
const SPARK_POINTS = 120

export default function App() {
  const [state, setState] = useAppState()
  const [theme, toggleTheme] = useTheme()
  const [sheet, setSheet] = useState<'base' | 'add' | null>(null)
  const [hot, setHot] = useState<string | null>(null)
  const { base, picks, range, adjusted } = state

  const start = useMemo(() => rangeStart(range), [range])
  const codes = useMemo(() => picks.map((p) => p.code), [picks])
  const { table, loading, error, retry } = useRates(base, codes, start)

  const focus = picks.length === 1 ? picks[0].code : state.focus
  const slotOf = useCallback((code: string) => picks.find((p) => p.code === code)?.slot ?? 0, [picks])

  // ---------- derived data ----------
  const view = useMemo(() => {
    if (!table || table.times.length === 0) return null
    const pairs = derivePairs(table, codes)
    const idx = sampleIndices(table.times.length, CHART_POINTS)
    const times = idx.map((i) => table.times[i])
    const pick = (arr: (number | null)[]) => idx.map((i) => arr[i])
    const t0 = table.times[0]
    const t1 = table.times[table.times.length - 1]
    return { pairs, times, pick, t0, t1, base: table.base }
  }, [table, codes])

  const measure = (p: PairSeries) => (adjusted ? p.real : p.nominal)

  // ---------- actions ----------
  const setBase = (code: string) =>
    setState((s) => {
      if (code === s.base) return s
      // If the new base was one of the targets, swap the old base into its slot.
      const picks = s.picks.map((p) => (p.code === code ? { ...p, code: s.base } : p))
      return { ...s, base: code, picks, focus: s.focus === code ? s.base : s.focus }
    })

  const togglePick = (code: string) =>
    setState((s) => {
      if (s.picks.some((p) => p.code === code)) {
        const picks = s.picks.filter((p) => p.code !== code)
        return { ...s, picks, focus: s.focus === code ? null : s.focus }
      }
      const slot = nextSlot(s.picks)
      if (slot < 0 || code === s.base) return s
      return { ...s, picks: [...s.picks, { code, slot }] }
    })

  const setFocus = (code: string | null) => setState((s) => ({ ...s, focus: code }))

  // ---------- chart model ----------
  const baseMeta = CURRENCY[base]
  let chart: { series: ChartSeries[]; zero: boolean; ends: boolean; fmt: (v: number) => string; tick: (v: number, s: number) => string; aria: string } | null = null
  let hero: React.ReactNode = null

  if (view) {
    const rangeLabel = formatMonth(view.t0)
    const focusPair = focus ? view.pairs.find((p) => p.code === focus) : undefined
    if (focusPair) {
      const color = seriesVar(slotOf(focusPair.code))
      const series: ChartSeries[] = adjusted
        ? [
            { id: 'real', label: 'Inflation-adjusted', color, values: view.pick(focusPair.real), area: true },
            { id: 'nominal', label: 'Nominal', color: 'var(--text-muted)', values: view.pick(focusPair.nominal), dashed: true },
          ]
        : [{ id: 'nominal', label: 'Nominal', color, values: view.pick(focusPair.nominal), area: true }]
      chart = {
        series,
        zero: false,
        ends: false,
        fmt: formatRate,
        tick: formatTick,
        aria: `${view.base} to ${focusPair.code} exchange rate since ${rangeLabel}${adjusted ? ', inflation-adjusted' : ''}. Use arrow keys to read values.`,
      }
      const { last } = firstLast(focusPair.nominal)
      const chg = change(measure(focusPair))
      hero = (
        <div className="hero">
          <p className="eyebrow">
            {CURRENCY[focusPair.code]?.flag} {CURRENCY[focusPair.code]?.name}
          </p>
          <p className="hero-value">
            <span className="hero-unit">1 {view.base} =</span> {formatRate(last)} <span className="hero-unit">{focusPair.code}</span>
          </p>
          <p className="hero-sub">
            <Delta value={chg} /> since {rangeLabel}
            <span className="muted"> · {adjusted ? 'in today’s purchasing power' : 'nominal'}</span>
          </p>
        </div>
      )
    } else {
      const series: ChartSeries[] = view.pairs.map((p) => ({
        id: p.code,
        label: p.code,
        color: seriesVar(slotOf(p.code)),
        values: indexed(view.pick(measure(p))),
        dim: hot != null && hot !== p.code,
      }))
      chart = {
        series,
        zero: true,
        ends: series.length <= 4,
        fmt: (v) => formatPct(v, 1),
        tick: (v, s) => formatPct(v, s >= 0.01 ? 0 : 1),
        aria: `Percent change of ${view.base} against ${codes.join(', ')} since ${rangeLabel}${adjusted ? ', inflation-adjusted' : ''}. Use arrow keys to read values.`,
      }
      const ranked = view.pairs
        .map((p) => ({ code: p.code, chg: change(measure(p)) }))
        .filter((r): r is { code: string; chg: number } => r.chg != null)
        .sort((a, b) => b.chg - a.chg)
      const best = ranked[0]
      const worst = ranked[ranked.length - 1]
      hero = (
        <div className="hero">
          <p className="eyebrow">
            {baseMeta?.flag} What 1 {view.base} buys
          </p>
          <h2 className="hero-title">
            {adjusted ? 'Real' : 'Nominal'} change since {rangeLabel}
          </h2>
          {best && worst && best !== worst && (
            <p className="hero-sub">
              Strongest against <b>{best.code}</b> <Delta value={best.chg} />, weakest against <b>{worst.code}</b> <Delta value={worst.chg} />
            </p>
          )}
        </div>
      )
    }
  }

  const empty = picks.length === 0

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="28" height="28">
              <defs>
                <linearGradient id="lg" x1="0" y1="1" x2="1" y2="0">
                  <stop offset="0" stopColor="#2a78d6" />
                  <stop offset="1" stopColor="#1baf7a" />
                </linearGradient>
              </defs>
              <rect width="32" height="32" rx="9" fill="url(#lg)" />
              <path d="M7 21 L13 15 L17 18 L25 10" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="brand-name">fxtrend</span>
        </div>
        <button type="button" className="icon-btn" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
          {theme === 'dark' ? '☀︎' : '☾'}
        </button>
      </header>

      <section className="controls" aria-label="Chart settings">
        <button type="button" className="base-btn" onClick={() => setSheet('base')}>
          <span className="flag" aria-hidden="true">
            {baseMeta?.flag}
          </span>
          <span className="base-text">
            <span className="base-caption">Base</span>
            <span className="base-code">
              {base} <span className="chev" aria-hidden="true">▾</span>
            </span>
          </span>
        </button>
        <Switch
          checked={adjusted}
          onChange={(v) => setState((s) => ({ ...s, adjusted: v }))}
          label="Adjust for inflation"
          hint={adjusted ? 'Each currency by its own CPI' : 'Showing nominal rates'}
        />
        <Segmented label="Time range" value={range} options={RANGES} onChange={(r) => setState((s) => ({ ...s, range: r }))} />
      </section>

      <main className="layout">
        <section className="card chart-card" aria-busy={loading}>
          {focus && picks.length > 1 && (
            <button type="button" className="back-btn" onClick={() => setFocus(null)}>
              ← Compare all
            </button>
          )}
          {empty ? (
            <div className="empty-state">
              <p className="hero-title">Pick a currency to compare</p>
              <p className="muted">See how far one {base} has gone over time — with or without inflation.</p>
              <button type="button" className="btn-primary" onClick={() => setSheet('add')}>
                + Add currency
              </button>
            </div>
          ) : error && !view ? (
            <div className="empty-state">
              <p className="hero-title">Couldn’t load rates</p>
              <p className="muted">{error}</p>
              <button type="button" className="btn-primary" onClick={retry}>
                Try again
              </button>
            </div>
          ) : !view || !chart ? (
            <div className="skeleton" aria-label="Loading">
              <div className="sk-line w40" />
              <div className="sk-line w70 tall" />
              <div className="sk-chart" />
            </div>
          ) : (
            <>
              {hero}
              {chart.series.length >= 2 && (
                <ul className="legend" aria-label="Legend">
                  {chart.series.map((s) => (
                    <li key={s.id}>
                      <span className={`key${s.dashed ? ' dashed' : ''}`} style={{ borderColor: s.color }} />
                      {s.label}
                    </li>
                  ))}
                </ul>
              )}
              <Chart
                times={view.times}
                series={chart.series}
                formatValue={chart.fmt}
                formatTick={chart.tick}
                zeroLine={chart.zero}
                endLabels={chart.ends}
                ariaLabel={chart.aria}
                busy={loading}
              />
              {error && (
                <p className="inline-error">
                  {error} <button type="button" className="btn-text" onClick={retry}>Retry</button>
                </p>
              )}
              {focus && view && <Explainer base={view.base} quote={focus} t0={view.t0} t1={view.t1} pair={view.pairs.find((p) => p.code === focus)} />}
              <DataTable view={view} series={chart.series} fmt={chart.fmt} />
            </>
          )}
        </section>

        <section className="side" aria-label="Currencies">
          <div className="side-head">
            <h2>
              1 {base} in…
            </h2>
            <button type="button" className="btn-chip" onClick={() => setSheet('add')} disabled={false}>
              + Add
            </button>
          </div>
          <ul className="cards">
            {picks.map((p) => (
              <CurrencyCard
                key={p.code}
                pick={p}
                pair={view?.pairs.find((x) => x.code === p.code)}
                adjusted={adjusted}
                active={focus === p.code}
                t0={view?.t0}
                t1={view?.t1}
                onFocus={() => setFocus(focus === p.code && picks.length > 1 ? null : p.code)}
                onRemove={() => togglePick(p.code)}
                onHover={(on) => setHot(on ? p.code : null)}
              />
            ))}
          </ul>
          {picks.length < MAX_SERIES && (
            <button type="button" className="add-card" onClick={() => setSheet('add')}>
              <span aria-hidden="true">＋</span> Add currency
            </button>
          )}
        </section>
      </main>

      <footer className="footer">
        <p>
          <b>How it works.</b> Inflation-adjusted rates restate every past rate in today’s money: each point is multiplied by
          {' '}{base}’s inflation since then and divided by the target currency’s own inflation since then. If prices rose 30% in
          one country and 10% in another, a rate that drifted by the same gap would read flat — the currency only looks
          stronger or weaker if it moved more than inflation explains.
        </p>
        <p className="muted small">
          Exchange rates: European Central Bank reference rates via{' '}
          <a href="https://frankfurter.dev" target="_blank" rel="noreferrer">Frankfurter</a>. Inflation:{' '}
          <a href={INFLATION.url} target="_blank" rel="noreferrer">IMF World Economic Outlook</a> annual average CPI (euro-area
          aggregate for EUR), interpolated monthly; figures from {INFLATION.projectedFrom} on are IMF estimates. Data
          snapshot {INFLATION.fetchedAt}. Not financial advice.
        </p>
      </footer>

      <CurrencySheet
        open={sheet === 'base'}
        title="Base currency"
        mode="single"
        selected={[base]}
        onToggle={setBase}
        onClose={() => setSheet(null)}
      />
      <CurrencySheet
        open={sheet === 'add'}
        title={`Compare 1 ${base} with…`}
        mode="multi"
        selected={codes}
        disabled={[base]}
        max={MAX_SERIES}
        onToggle={togglePick}
        onClose={() => setSheet(null)}
      />
    </div>
  )
}

function Delta({ value }: { value: number | null }) {
  if (value == null) return <span className="delta">—</span>
  const dir = value > 0.0005 ? 'up' : value < -0.0005 ? 'down' : 'flat'
  return (
    <span className={`delta ${dir}`}>
      <span aria-hidden="true">{dir === 'up' ? '▲' : dir === 'down' ? '▼' : '•'}</span> {formatPct(value, 1)}
    </span>
  )
}

function CurrencyCard({
  pick,
  pair,
  adjusted,
  active,
  t0,
  t1,
  onFocus,
  onRemove,
  onHover,
}: {
  pick: Pick
  pair?: PairSeries
  adjusted: boolean
  active: boolean
  t0?: number
  t1?: number
  onFocus: () => void
  onRemove: () => void
  onHover: (on: boolean) => void
}) {
  const meta = CURRENCY[pick.code]
  const color = seriesVar(pick.slot)
  const values = useMemo(() => (pair ? (adjusted ? pair.real : pair.nominal) : []), [pair, adjusted])
  const spark = useMemo(() => {
    const idx = sampleIndices(values.length, SPARK_POINTS)
    return idx.map((i) => values[i])
  }, [values])
  const last = pair ? firstLast(pair.nominal).last : null
  const chg = change(values)
  const nominalChg = pair ? change(pair.nominal) : null
  const infl = t0 != null && t1 != null ? annualisedInflation(pick.code, t0, t1) : null
  return (
    <li
      className={`ccy-card${active ? ' is-active' : ''}`}
      style={{ ['--c' as string]: color }}
      onPointerEnter={(e) => e.pointerType === 'mouse' && onHover(true)}
      onPointerLeave={() => onHover(false)}
    >
      <button type="button" className="ccy-main" onClick={onFocus} aria-pressed={active} aria-label={`${meta?.name ?? pick.code}: show detail`}>
        <span className="ccy-stripe" aria-hidden="true" />
        <span className="flag big" aria-hidden="true">
          {meta?.flag}
        </span>
        <span className="ccy-id">
          <span className="code">{pick.code}</span>
          <span className="name">{meta?.name}</span>
        </span>
        <span className="ccy-spark">{pair ? <Sparkline values={spark} color={color} /> : <span className="sk-line w100" />}</span>
        <span className="ccy-nums">
          <span className="rate">{formatRate(last)}</span>
          <Delta value={chg} />
        </span>
        <span className="ccy-foot">
          {infl != null && <span>{meta?.region} CPI {formatPct(infl, 1, false)}/yr</span>}
          {adjusted && nominalChg != null && <span>Nominal {formatPct(nominalChg, 1)}</span>}
        </span>
      </button>
      <button type="button" className="ccy-remove" onClick={onRemove} aria-label={`Remove ${pick.code}`}>
        ×
      </button>
    </li>
  )
}

function Explainer({ base, quote, t0, t1, pair }: { base: string; quote: string; t0: number; t1: number; pair?: PairSeries }) {
  if (!pair) return null
  const bi = cumulativeInflation(base, t0, t1)
  const qi = cumulativeInflation(quote, t0, t1)
  const nom = change(pair.nominal)
  const real = change(pair.real)
  const bm = CURRENCY[base]
  const qm = CURRENCY[quote]
  return (
    <dl className="explainer">
      <div>
        <dt>
          {bm?.flag} Prices in {bm?.region}
        </dt>
        <dd>{formatPct(bi, 0)}</dd>
      </div>
      <div>
        <dt>
          {qm?.flag} Prices in {qm?.region}
        </dt>
        <dd>{formatPct(qi, 0)}</dd>
      </div>
      <div>
        <dt>Nominal rate</dt>
        <dd>{formatPct(nom, 1)}</dd>
      </div>
      <div>
        <dt>Real rate</dt>
        <dd>{formatPct(real, 1)}</dd>
      </div>
    </dl>
  )
}

function DataTable({ view, series, fmt }: { view: { times: number[] }; series: ChartSeries[]; fmt: (v: number) => string }) {
  // One row per year (first sample of each year) plus the latest value.
  const rows = useMemo(() => {
    const out: number[] = []
    let year = -1
    view.times.forEach((t, i) => {
      const y = new Date(t).getUTCFullYear()
      if (y !== year) {
        out.push(i)
        year = y
      }
    })
    const last = view.times.length - 1
    if (out[out.length - 1] !== last) out.push(last)
    return out.reverse()
  }, [view.times])
  return (
    <details className="table-view">
      <summary>Show data table</summary>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Date</th>
              {series.map((s) => (
                <th scope="col" key={s.id}>
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i}>
                <th scope="row">{formatDate(view.times[i])}</th>
                {series.map((s) => (
                  <td key={s.id}>{s.values[i] == null ? '—' : fmt(s.values[i]!)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
