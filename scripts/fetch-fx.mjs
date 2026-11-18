#!/usr/bin/env node
// Downloads the full daily history of ECB reference rates (via frankfurter.dev)
// for every supported currency and writes public/data/fx-eur.json.
//
// Rates are stored as published by the ECB: units of each currency per 1 EUR.
// Any other base is derived in the app as a cross rate (quote/EUR ÷ base/EUR).
// The app loads this snapshot first and only asks the live API for newer days.
//   npm run data:fx
import { writeFile } from 'node:fs/promises'

const CODES = [
  'AUD', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'GBP', 'HKD', 'HUF', 'IDR', 'ILS', 'INR', 'ISK', 'JPY',
  'KRW', 'MXN', 'MYR', 'NOK', 'NZD', 'PHP', 'PLN', 'RON', 'SEK', 'SGD', 'THB', 'TRY', 'USD', 'ZAR',
]
const START = '1999-01-04'
const url = `https://api.frankfurter.dev/v1/${START}..?base=EUR&symbols=${CODES.join(',')}`

const res = await fetch(url, { headers: { Accept: 'application/json' } })
if (!res.ok) throw new Error(`Frankfurter request failed: ${res.status}`)
const json = await res.json()
const dates = Object.keys(json.rates).sort()
if (dates.length < 5000) throw new Error(`Suspiciously short history (${dates.length} days); refusing to overwrite`)

const rates = {}
for (const c of CODES) rates[c] = dates.map((d) => json.rates[d][c] ?? null)

const out = {
  source: 'European Central Bank reference rates via frankfurter.dev',
  base: 'EUR',
  fetchedAt: new Date().toISOString().slice(0, 10),
  start: dates[0],
  end: dates[dates.length - 1],
  dates,
  rates,
}
await writeFile(new URL('../public/data/fx-eur.json', import.meta.url), JSON.stringify(out) + '\n')
console.log(`Wrote ${dates.length} days (${out.start} → ${out.end}) for ${CODES.length} currencies`)
