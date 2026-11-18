import { describe, expect, it } from 'vitest'
import { buildPriceIndex, realFactor } from '../inflation'
import { change, indexed, niceTicks, sampleIndices } from '../series'

const mid = (y: number) => Date.UTC(y, 6, 2)

describe('buildPriceIndex', () => {
  it('compounds annual rates between mid-year anchors', () => {
    const idx = buildPriceIndex({ 2020: 0, 2021: 10, 2022: 10 })
    expect(idx.at(mid(2022)) / idx.at(mid(2020))).toBeCloseTo(1.21, 10)
  })
  it('interpolates geometrically inside a year', () => {
    const idx = buildPriceIndex({ 2020: 0, 2021: 21 })
    const half = (mid(2020) + mid(2021)) / 2
    expect(idx.at(half) / idx.at(mid(2020))).toBeCloseTo(1.1, 10)
  })
  it('extrapolates with the last segment slope', () => {
    const idx = buildPriceIndex({ 2020: 0, 2021: 10 })
    const span = mid(2021) - mid(2020)
    expect(idx.at(mid(2021) + span) / idx.at(mid(2021))).toBeCloseTo(1.1, 10)
  })
})

describe('realFactor', () => {
  it('is 1 at the anchor', () => {
    const a = buildPriceIndex({ 2020: 2, 2021: 2 })
    const b = buildPriceIndex({ 2020: 30, 2021: 30 })
    expect(realFactor(a, b, mid(2021), mid(2021))).toBeCloseTo(1, 12)
  })
  it('undoes a purely inflationary depreciation', () => {
    // Quote country runs 10 %/yr inflation, base 0 %; the nominal rate rises 10 %/yr (PPP holds).
    const base = buildPriceIndex({ 2020: 0, 2021: 0, 2022: 0 })
    const quote = buildPriceIndex({ 2020: 0, 2021: 10, 2022: 10 })
    const nominal2020 = 100
    const nominal2022 = 121
    const real2020 = nominal2020 * realFactor(base, quote, mid(2020), mid(2022))
    expect(real2020).toBeCloseTo(nominal2022, 8)
  })
})

describe('series helpers', () => {
  it('computes change and indexed values ignoring leading gaps', () => {
    expect(change([null, 2, 3, 4])).toBeCloseTo(1)
    expect(indexed([null, 2, 3])).toEqual([null, 0, 0.5])
  })
  it('samples evenly and keeps the endpoints', () => {
    const s = sampleIndices(1000, 10)
    expect(s[0]).toBe(0)
    expect(s.at(-1)).toBe(999)
    expect(s).toHaveLength(10)
  })
  it('produces 1-2-5 ticks covering the domain', () => {
    const { ticks, step } = niceTicks(0.83, 0.97, 5)
    expect([0.02, 0.05].some((s) => Math.abs(s - step) < 1e-12)).toBe(true)
    expect(ticks[0]).toBeLessThanOrEqual(0.83)
    expect(ticks.at(-1)).toBeGreaterThanOrEqual(0.97)
  })
})
