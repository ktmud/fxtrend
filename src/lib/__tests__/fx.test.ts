import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadRates, resetRates } from '../fx'

const snapshot = {
  end: '2024-01-03',
  dates: ['2024-01-02', '2024-01-03'],
  rates: { USD: [1.1, 1.2], JPY: [154, 156], TRY: [null, 36] },
}

function mockFetch(tail: Record<string, Record<string, number>> | 'fail') {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.endsWith('data/fx-eur.json')) return new Response(JSON.stringify(snapshot))
      if (tail === 'fail') throw new TypeError('network down')
      return new Response(JSON.stringify({ rates: tail }))
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  resetRates()
})

describe('loadRates', () => {
  it('derives cross rates from EUR-based data and appends live days', async () => {
    mockFetch({ '2024-01-03': { USD: 9, JPY: 9 }, '2024-01-04': { USD: 1.25, JPY: 160, TRY: 37 } })
    const { table, status } = await loadRates('USD', ['JPY', 'EUR', 'TRY'], '2024-01-01')
    expect(table.dates).toEqual(['2024-01-02', '2024-01-03', '2024-01-04']) // the stale echo of 01-03 is ignored
    expect(table.rates.JPY[0]).toBeCloseTo(154 / 1.1)
    expect(table.rates.JPY[2]).toBeCloseTo(160 / 1.25)
    expect(table.rates.EUR[1]).toBeCloseTo(1 / 1.2)
    expect(table.rates.TRY[0]).toBeNull()
    expect(status).toEqual({ asOf: '2024-01-04', live: true })
  })

  it('falls back to the snapshot when the live API is unreachable', async () => {
    mockFetch('fail')
    const { table, status } = await loadRates('EUR', ['USD'], '2024-01-03')
    expect(table.dates).toEqual(['2024-01-03'])
    expect(table.rates.USD).toEqual([1.2])
    expect(status).toEqual({ asOf: '2024-01-03', live: false })
  })
})
