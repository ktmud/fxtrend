import { describe, expect, it } from 'vitest'
import { detectAnomalies, type InflationFn } from '../anomalies'

const DAY = 86_400_000
const T0 = Date.UTC(2020, 0, 1)
/** One quote per day from T0. */
const daily = (values: number[]) => ({ times: values.map((_, i) => T0 + i * DAY), values })
const noInflation: InflationFn = () => 0

describe('detectAnomalies', () => {
  it('reports a move that sticks as a jump, and a 5×+ move as a caveat', () => {
    const { times, values } = daily([...Array(30).fill(100), ...Array(30).fill(220)])
    const [ev] = detectAnomalies('ARS', times, values, noInflation)
    expect(ev).toMatchObject({ kind: 'jump', severity: 'info', from: 100, to: 220 })
    expect(ev.ratio).toBeCloseTo(2.2)

    const big = daily([...Array(30).fill(42_000), ...Array(30).fill(640_000)])
    expect(detectAnomalies('IRR', big.times, big.values, noInflation)[0]).toMatchObject({ kind: 'jump', severity: 'caveat' })
  })

  it('merges same-direction steps a few days apart into one jump', () => {
    const { times, values } = daily([...Array(10).fill(100), 1500, 1500, 3000, ...Array(20).fill(3000)])
    const ev = detectAnomalies('IRR', times, values, noInflation)
    expect(ev).toHaveLength(1)
    expect(ev[0].ratio).toBeCloseTo(30)
  })

  it('treats moves that reverse within days as erratic data, not two crashes', () => {
    const vals: number[] = []
    for (let i = 0; i < 60; i++) vals.push(i % 7 < 3 ? 50 : 80) // flips every few days
    const { times, values } = daily(vals)
    const ev = detectAnomalies('LRD', times, values, noInflation)
    expect(ev).toHaveLength(1)
    expect(ev[0]).toMatchObject({ kind: 'erratic', severity: 'caveat', from: 50, to: 80 })
  })

  it('flags a long flat stretch only when local inflation runs far above US inflation', () => {
    const { times, values } = daily(Array(800).fill(42_000))
    const high: InflationFn = (code) => (code === 'USD' ? 0.05 : 1.5)
    const low: InflationFn = (code) => (code === 'USD' ? 0.05 : 0.06)
    expect(detectAnomalies('IRR', times, values, high)[0]).toMatchObject({ kind: 'frozen', severity: 'caveat' })
    expect(detectAnomalies('HKD', times, values, low)).toEqual([]) // an ordinary peg
    expect(detectAnomalies('XDR', times, values, () => null)).toEqual([]) // no CPI: can't judge
  })

  it('ignores ordinary volatility and gaps in the data', () => {
    const vals = Array.from({ length: 500 }, (_, i) => 100 * (1 + 0.1 * Math.sin(i / 9)))
    const { times, values } = daily(vals)
    expect(detectAnomalies('JPY', times, values, noInflation)).toEqual([])
    // a 3× change across a 3-week hole in the data is not a one-day move
    const gap = { times: [T0, T0 + DAY, T0 + 22 * DAY, T0 + 23 * DAY], values: [10, 10, 30, 30] }
    expect(detectAnomalies('XXX', gap.times, gap.values, noInflation)).toEqual([])
  })
})
