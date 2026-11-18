#!/usr/bin/env node
// Downloads annual CPI inflation (IMF World Economic Outlook, indicator PCPIPCH:
// "Inflation, average consumer prices, annual percent change") for the home
// economy of every supported currency and writes src/data/inflation.json.
//
// The IMF DataMapper API does not send CORS headers, so the data is bundled at
// build time instead of fetched from the browser. Re-run with:
//   npm run data:inflation
import { readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'

// currency -> IMF economy, from src/data/currencies.json (written by fetch-fx.mjs)
const currencies = JSON.parse(await readFile(new URL('../src/data/currencies.json', import.meta.url), 'utf8'))
const ECONOMIES = Object.fromEntries(currencies.filter((c) => c.imf).map((c) => [c.code, c.imf]))
const FIRST_YEAR = 1997
const LAST_YEAR = new Date().getUTCFullYear() + 1 // include next year's projection so "today" is covered

const url = 'https://www.imf.org/external/datamapper/api/v1/PCPIPCH'
// The IMF edge rejects Node's built-in HTTP client but serves curl, so use curl.
const body = execFileSync('curl', ['-sSf', '--max-time', '120', url], { maxBuffer: 64 * 1024 * 1024 })
const all = JSON.parse(body.toString('utf8')).values.PCPIPCH

const series = {}
const missing = []
const thisYear = new Date().getUTCFullYear()
for (const [ccy, code] of Object.entries(ECONOMIES)) {
  const raw = all[code]
  const years = {}
  for (let y = FIRST_YEAR; y <= LAST_YEAR; y++) {
    const v = raw?.[String(y)]
    if (typeof v === 'number') years[y] = v
  }
  // Needs recent coverage: extrapolating stale CPI across years would invent inflation.
  const last = Math.max(...Object.keys(years).map(Number))
  if (Object.keys(years).length < 3 || last < thisYear - 1) {
    missing.push(`${ccy}→${code}${raw ? ` (data ends ${last})` : ''}`)
    continue
  }
  series[ccy] = years
}
if (missing.length) console.warn('No usable IMF inflation for:', missing.join(', '))
const out = {
  source: 'IMF World Economic Outlook (PCPIPCH, annual average CPI inflation, %)',
  url: 'https://www.imf.org/external/datamapper/PCPIPCH',
  fetchedAt: new Date().toISOString().slice(0, 10),
  // WEO figures for the current and following year are estimates/projections.
  projectedFrom: new Date().getUTCFullYear(),
  series,
}
const target = new URL('../src/data/inflation.json', import.meta.url)
// Leave the file alone when the numbers haven't changed, so a refresh with no new IMF
// data produces no diff (just a new fetchedAt would otherwise make every run a change).
const prev = await readFile(target, 'utf8').then(JSON.parse).catch(() => null)
if (prev && prev.projectedFrom === out.projectedFrom && JSON.stringify(prev.series) === JSON.stringify(out.series)) {
  console.log(`Inflation unchanged since ${prev.fetchedAt} (${Object.keys(series).length} currencies)`)
} else {
  await writeFile(target, JSON.stringify(out, null, 0) + '\n')
  console.log(`Wrote inflation for ${Object.keys(series).length} currencies, ${FIRST_YEAR}-${LAST_YEAR}`)
}
