import { describe, expect, it } from 'vitest'
import { excerpt, quoteFound } from '../../../scripts/explain-events'

const article = [
  'The rial is the currency of Iran.',
  'In 1932 the rial replaced the qiran.',
  'In April 2018 the government set a single official rate of 42,000 rials per dollar.',
  'Cooking and sports are unrelated paragraphs.',
  'The rial exchange rate started 2025 at 817,500 rials to the US dollar.',
].join('\n\n')

describe('excerpt', () => {
  it('keeps the intro and only paragraphs about the events’ years', () => {
    const ex = excerpt(article, [{ start: Date.UTC(2018, 7, 8), end: Date.UTC(2018, 9, 1) }])
    expect(ex).toContain('The rial is the currency of Iran.')
    expect(ex).toContain('42,000 rials')
    expect(ex).not.toContain('1932')
    expect(ex).not.toContain('Cooking')
  })
  it('returns nothing when no paragraph mentions the years, so no request is made', () => {
    expect(excerpt(article, [{ start: Date.UTC(2010, 0, 1), end: Date.UTC(2010, 5, 1) }])).toBe('')
  })
})

describe('quoteFound', () => {
  it('accepts a verbatim quote despite whitespace, case and quote-mark differences', () => {
    expect(quoteFound('in april 2018  the government set a single official rate', article)).toBe(true)
  })
  it('rejects quotes that are not in the article, or too short to mean anything', () => {
    expect(quoteFound('In 2018 the central bank abolished the official rate entirely.', article)).toBe(false)
    expect(quoteFound('2018', article)).toBe(false)
  })
})
