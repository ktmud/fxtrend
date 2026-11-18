import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadRates, resetRates } from '../fx'

// Snapshot files: units per 1 USD, first date + day deltas.
const files: Record<string, unknown> = {
  'index.json': { end: '2024-01-03' },
  // Mon 1 Jan .. Wed 3 Jan
  'JPY.json': { start: '2024-01-01', d: [0, 1, 1], v: [140, 141, 142] },
  'EUR.json': { start: '2024-01-01', d: [0, 2], v: [0.9, 0.92] }, // no quote on 2 Jan
  'ARS.json': { start: '2023-12-01', d: [0], v: [800] }, // stale for > 7 days by January
}

type LiveRow = { date: string; base: string; quote: string; rate: number }

function mockFetch(live: LiveRow[] | 'fail') {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const file = url.match(/data\/fx\/(.+)$/)?.[1]
      if (file) return file in files ? new Response(JSON.stringify(files[file])) : new Response('', { status: 404 })
      if (live === 'fail') throw new TypeError('network down')
      const quote = new URL(url).searchParams.get('quotes')
      return new Response(JSON.stringify(live.filter((r) => r.quote === quote)))
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  resetRates()
})

describe('loadRates', () => {
  it('derives cross rates, carries a leg forward over missing days, and appends live days', async () => {
    mockFetch([
      { date: '2024-01-04', base: 'USD', quote: 'JPY', rate: 150 },
      { date: '2024-01-04', base: 'USD', quote: 'EUR', rate: 1 },
    ])
    const { table, status } = await loadRates('EUR', ['JPY', 'USD'], '2024-01-01')
    expect(table.dates).toEqual(['2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04'])
    expect(table.rates.JPY[0]).toBeCloseTo(140 / 0.9)
    expect(table.rates.JPY[1]).toBeCloseTo(141 / 0.9) // EUR carried forward from 1 Jan
    expect(table.rates.JPY[3]).toBeCloseTo(150)
    expect(table.rates.USD[2]).toBeCloseTo(1 / 0.92)
    expect(status).toEqual({ asOf: '2024-01-04', live: true })
  })

  it('breaks the line when a leg is stale for more than a week', async () => {
    mockFetch([])
    const { table } = await loadRates('USD', ['ARS', 'JPY'], '2024-01-01')
    expect(table.rates.ARS).toEqual([null, null, null])
  })

  it('falls back to the snapshot when the live API is unreachable', async () => {
    mockFetch('fail')
    const { table, status } = await loadRates('USD', ['JPY'], '2024-01-02')
    expect(table.rates.JPY).toEqual([141, 142])
    expect(status).toEqual({ asOf: '2024-01-03', live: false })
  })
})
