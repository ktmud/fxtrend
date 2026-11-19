import { useEffect, useMemo, useRef, useState } from 'react'
import { CURRENCIES, POPULAR_COUNT, type CurrencyMeta } from '../lib/currencies'
import { hasInflation } from '../lib/inflation'

interface Props {
  open: boolean
  title: string
  mode: 'single' | 'multi'
  selected: string[]
  /** Currencies that cannot be picked (e.g. the base itself). */
  disabled?: string[]
  max?: number
  onToggle: (code: string) => void
  onClose: () => void
}

export function CurrencySheet({ open, title, mode, selected, disabled = [], max, onToggle, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      setQ('')
      d.showModal()
      // Don't pop the on-screen keyboard on touch devices.
      if (window.matchMedia('(pointer: fine)').matches) inputRef.current?.focus()
    } else if (!open && d.open) d.close()
  }, [open])

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return CURRENCIES
    return CURRENCIES.filter((c) => [c.code, c.name, c.region].some((f) => f.toLowerCase().includes(s)))
  }, [q])

  const full = max != null && selected.length >= max
  const groups: { label: string; items: readonly CurrencyMeta[] }[] = q.trim()
    ? [{ label: '', items: list }]
    : [
        { label: 'Popular', items: CURRENCIES.slice(0, POPULAR_COUNT) },
        { label: `All currencies (${CURRENCIES.length})`, items: [...CURRENCIES.slice(POPULAR_COUNT)].sort((a, b) => a.code.localeCompare(b.code)) },
      ]

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={title}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="sheet-body">
        <div className="sheet-grip" aria-hidden="true" />
        <header className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="btn-text" onClick={onClose}>
            {mode === 'multi' ? 'Done' : 'Cancel'}
          </button>
        </header>
        <input
          ref={inputRef}
          className="search"
          type="search"
          placeholder="Search currency or country"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search currencies"
        />
        {mode === 'multi' && max != null && (
          <p className="sheet-note">
            {selected.length} of {max} selected{full ? ' — remove one to add another' : ''}
          </p>
        )}
        <div className="sheet-list" role="listbox" aria-multiselectable={mode === 'multi'} aria-label={title}>
          {groups.map((g) => (
            <section key={g.label} aria-label={g.label}>
              {g.label && <h3 className="sheet-group">{g.label}</h3>}
              {g.items.map((c) => {
                const isSel = selected.includes(c.code)
                const isDis = disabled.includes(c.code) || (!isSel && full && mode === 'multi')
                return (
                  <button
                    key={c.code}
                    type="button"
                    role="option"
                    aria-selected={isSel}
                    disabled={isDis}
                    className={isSel ? 'is-selected' : undefined}
                    onClick={() => {
                      onToggle(c.code)
                      if (mode === 'single') onClose()
                    }}
                  >
                    <span className="flag" aria-hidden="true">
                      {c.flag}
                    </span>
                    <span className="sheet-item-text">
                      <span className="code">
                        {c.code}
                        {!hasInflation(c.code) && <span className="tag">no CPI</span>}
                      </span>
                      <span className="name">
                        {c.name} · {c.region}
                      </span>
                    </span>
                    <span className="check" aria-hidden="true">
                      {isSel ? '✓' : ''}
                    </span>
                  </button>
                )
              })}
            </section>
          ))}
          {list.length === 0 && <p className="empty">No currency matches “{q}”</p>}
        </div>
      </div>
    </dialog>
  )
}
