#!/usr/bin/env node
// Downloads annual CPI inflation (IMF World Economic Outlook, indicator PCPIPCH:
// "Inflation, average consumer prices, annual percent change") for the home
// economy of every supported currency and writes src/data/inflation.json.
//
// The IMF DataMapper API does not send CORS headers, so the data is bundled at
// build time instead of fetched from the browser. Re-run with:
//   npm run data:inflation
import { writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'

// currency -> IMF economy code
const ECONOMIES = {
  AUD: 'AUS', BRL: 'BRA', CAD: 'CAN', CHF: 'CHE', CNY: 'CHN', CZK: 'CZE',
  DKK: 'DNK', EUR: 'EURO', GBP: 'GBR', HKD: 'HKG', HUF: 'HUN', IDR: 'IDN',
  ILS: 'ISR', INR: 'IND', ISK: 'ISL', JPY: 'JPN', KRW: 'KOR', MXN: 'MEX',
  MYR: 'MYS', NOK: 'NOR', NZD: 'NZL', PHP: 'PHL', PLN: 'POL', RON: 'ROU',
  SEK: 'SWE', SGD: 'SGP', THB: 'THA', TRY: 'TUR', USD: 'USA', ZAR: 'ZAF',
}
const FIRST_YEAR = 1997
const LAST_YEAR = new Date().getUTCFullYear() + 1 // include next year's projection so "today" is covered

const url = 'https://www.imf.org/external/datamapper/api/v1/PCPIPCH'
// The IMF edge rejects Node's built-in HTTP client but serves curl, so use curl.
const body = execFileSync('curl', ['-sSf', '--max-time', '120', url], { maxBuffer: 64 * 1024 * 1024 })
const all = JSON.parse(body.toString('utf8')).values.PCPIPCH

const series = {}
for (const [ccy, code] of Object.entries(ECONOMIES)) {
  const raw = all[code]
  if (!raw) throw new Error(`IMF has no data for ${code} (${ccy})`)
  const years = {}
  for (let y = FIRST_YEAR; y <= LAST_YEAR; y++) {
    const v = raw[String(y)]
    if (typeof v === 'number') years[y] = v
  }
  series[ccy] = years
}

const out = {
  source: 'IMF World Economic Outlook (PCPIPCH, annual average CPI inflation, %)',
  url: 'https://www.imf.org/external/datamapper/PCPIPCH',
  fetchedAt: new Date().toISOString().slice(0, 10),
  // WEO figures for the current and following year are estimates/projections.
  projectedFrom: new Date().getUTCFullYear(),
  series,
}
await writeFile(new URL('../src/data/inflation.json', import.meta.url), JSON.stringify(out, null, 0) + '\n')
console.log(`Wrote inflation for ${Object.keys(series).length} currencies, ${FIRST_YEAR}-${LAST_YEAR}`)
