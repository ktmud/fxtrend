#!/usr/bin/env node
// Builds the exchange-rate snapshot for every fiat currency Frankfurter (v2) knows about.
//
// Writes:
//   public/data/fx/<CODE>.json   daily history, units of CODE per 1 USD (one small file per currency,
//                                so the app only downloads what the reader picks)
//   public/data/fx/index.json    snapshot date + coverage per currency
//   src/data/currencies.json     names, regions, flags and the IMF economy used for inflation
//
//   npm run data:fx            (then npm run data:inflation, which reads currencies.json)
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const countries = require('i18n-iso-countries')

const API = 'https://api.frankfurter.dev/v2'
const START = '1999-01-01'
const OUT = new URL('../public/data/fx/', import.meta.url)
const META = new URL('../src/data/currencies.json', import.meta.url)

/** Shown first in the picker, in this order. */
const POPULAR = ['USD', 'EUR', 'JPY', 'GBP', 'CNY', 'CHF', 'CAD', 'AUD', 'HKD', 'SGD', 'INR', 'KRW', 'MXN', 'BRL']

/**
 * ISO 4217 codes start with the issuing country's ISO 3166 alpha-2 code. Exceptions:
 * country: flag + region name; imf: economy whose CPI measures this currency's inflation.
 */
const OVERRIDES = {
  EUR: { region: 'Euro area', country: 'EU', imf: 'EURO' },
  XAF: { region: 'Central African CFA zone', flag: '🌍', imf: 'CMR', note: 'Cameroon CPI' },
  XOF: { region: 'West African CFA zone', flag: '🌍', imf: 'CIV', note: 'Côte d’Ivoire CPI' },
  XCD: { region: 'Eastern Caribbean', flag: '🌎', imf: 'LCA', note: 'Saint Lucia CPI' },
  XPF: { region: 'French Pacific territories', flag: '🌏', imf: null },
  XDR: { region: 'IMF Special Drawing Rights', flag: '🌐', imf: null },
  CMD: { region: 'COMESA', flag: '🌍', imf: null },
  XCG: { country: 'CW', region: 'Curaçao & Sint Maarten' },
  ANG: { country: 'CW', region: 'Curaçao & Sint Maarten' },
  CNH: { country: 'CN', region: 'China (offshore)' },
  // Crown dependencies and territories pegged 1:1 to sterling: UK inflation is the closest measure.
  GGP: { imf: 'GBR', note: 'UK CPI' },
  IMP: { imf: 'GBR', note: 'UK CPI' },
  JEP: { imf: 'GBR', note: 'UK CPI' },
  FKP: { imf: 'GBR', note: 'UK CPI' },
  SHP: { imf: 'GBR', note: 'UK CPI' },
  GIP: { imf: 'GBR', note: 'UK CPI' },
}

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
const flagOf = (cc) => String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))

async function getJson(url, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      // Long histories can take ~30 s to serve; anything far beyond that is a hung connection.
      const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(120_000) })
      if (!res.ok) throw new Error(`${res.status} ${url}`)
      return await res.json()
    } catch (e) {
      if (i >= tries) throw e
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i))
    }
  }
}

const list = (await getJson(`${API}/currencies`)).filter((c) => c.type === 'currency')
console.log(`${list.length} fiat currencies`)

// ---------- metadata ----------
const meta = []
for (const c of list) {
  const o = OVERRIDES[c.iso_code] ?? {}
  const cc = o.country ?? c.iso_code.slice(0, 2)
  const known = countries.isValid(cc) || cc === 'EU'
  const region = o.region ?? (known ? regionNames.of(cc) : c.name)
  const imf = 'imf' in o ? o.imf : known ? countries.alpha2ToAlpha3(cc) : null
  meta.push({
    code: c.iso_code,
    name: c.name,
    region,
    flag: o.flag ?? (known ? flagOf(cc) : '🌐'),
    imf: imf ?? null,
    ...(o.note ? { cpiNote: o.note } : {}),
  })
}
const rank = (code) => (POPULAR.includes(code) ? POPULAR.indexOf(code) : POPULAR.length)
meta.sort((a, b) => rank(a.code) - rank(b.code) || a.code.localeCompare(b.code))

// --meta-only: just refresh src/data/currencies.json (names, regions, flags, IMF mapping).
if (process.argv.includes('--meta-only')) {
  await writeFile(META, JSON.stringify(meta, null, 1) + '\n')
  console.log(`Wrote metadata for ${meta.length} currencies`)
  process.exit(0)
}

// ---------- rates ----------
await mkdir(OUT, { recursive: true })
const DAY = 86_400_000
const coverage = {}
let end = ''
const todo = meta.map((m) => m.code).filter((c) => c !== 'USD')
const failed = []

// --resume: keep files written in the last day (e.g. after an interrupted full run).
// --update: keep every existing file and only fetch the days after its last date (used by CI).
const RESUME = process.argv.includes('--resume')
const UPDATE = process.argv.includes('--update')
const iso = (t) => new Date(t).toISOString().slice(0, 10)

async function readExisting(code) {
  const file = new URL(`${code}.json`, OUT)
  const st = await stat(file).catch(() => null)
  if (!st) return null
  const f = JSON.parse(await readFile(file, 'utf8'))
  const times = []
  let t = Date.parse(f.start + 'T00:00:00Z')
  for (const x of f.d) times.push((t += x * DAY))
  return { mtime: st.mtimeMs, times, values: f.v }
}

async function one(code) {
  const old = RESUME || UPDATE ? await readExisting(code) : null
  let times = []
  let values = []
  let from = START
  if (old && (UPDATE || Date.now() - old.mtime < 86_400_000)) {
    times = old.times
    values = old.values
    from = RESUME && !UPDATE ? null : iso(times[times.length - 1] + DAY)
  }
  if (from) {
    const rows = await getJson(`${API}/rates?base=USD&quotes=${code}&from=${from}`)
    const pts = rows.filter((r) => r.quote === code && r.rate > 0 && r.date >= from).sort((a, b) => (a.date < b.date ? -1 : 1))
    for (const p of pts) {
      times.push(Date.parse(p.date + 'T00:00:00Z'))
      values.push(p.rate)
    }
  }
  if (times.length === 0) throw new Error('no data')
  // Compact form: first date, day deltas, values.
  const d = times.map((t, i) => (i ? Math.round((t - times[i - 1]) / DAY) : 0))
  await writeFile(new URL(`${code}.json`, OUT), JSON.stringify({ code, base: 'USD', start: iso(times[0]), d, v: values }) + '\n')
  const last = iso(times[times.length - 1])
  coverage[code] = [iso(times[0]), last]
  if (last > end) end = last
}

// a few at a time, to be polite to the free API
const queue = [...todo]
await Promise.all(
  Array.from({ length: 4 }, async () => {
    for (let code; (code = queue.shift()); ) {
      try {
        await one(code)
        process.stdout.write('.')
      } catch (e) {
        failed.push(`${code} (${e.message})`)
      }
    }
  }),
)
console.log()
if (failed.length) console.warn('No rates for:', failed.join(', '))
if (Object.keys(coverage).length < 100) throw new Error('Too few currencies downloaded; keeping the previous snapshot')

// drop files of currencies that disappeared, and their metadata
for (const f of await readdir(OUT)) {
  const code = f.replace('.json', '')
  if (f !== 'index.json' && !(code in coverage)) await rm(new URL(f, OUT))
}
const kept = meta.filter((m) => m.code === 'USD' || m.code in coverage)
coverage.USD = [START, end]

await writeFile(
  new URL('index.json', OUT),
  JSON.stringify({ source: 'Frankfurter v2 (central-bank reference rates)', base: 'USD', fetchedAt: new Date().toISOString().slice(0, 10), end, coverage }) + '\n',
)
await writeFile(META, JSON.stringify(kept, null, 1) + '\n')
console.log(`Wrote ${Object.keys(coverage).length - 1} currencies through ${end}`)
