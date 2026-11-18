# fxtrend

Inflation-adjusted foreign currency conversion rates over time.

Pick a base currency, add up to eight currencies to compare, and flip **Adjust for inflation** to restate
every historical rate in today's purchasing power. Each currency is adjusted by its own home economy's
consumer price inflation.

- **Time travel**: drag across the chart (or use the arrow keys) to pick a date in the past.
  - **Detail view** (tap a card): a two-part ticket answers *"$100 then bought what ¥X buys today; today it gets ¥Y"*.
    The headline says how much further your money goes now. The space between the nominal and inflation-adjusted lines
    is shaded as the *inflation gap*.
  - **Compare view**: % change against every selected currency on one axis, and a leaderboard that re-ranks
    the currencies as you scrub through time.
- **Banknote look**: each currency pair gets its own generated guilloche rosette (the engraved line pattern on
  banknotes), plus serif display figures (Fraunces, self-hosted) and currency-symbol watermarks.
- Mobile-first layout with bottom-sheet pickers; two-column layout on desktop. Light and dark themes.
- The URL holds the current view, so a link shares exactly what you see. A data-table view is included for accessibility.

## How the adjustment works

For a nominal rate `S(t)` (units of quote currency per 1 base) and consumer price indices `P`:

```
real(t) = S(t) × [P_base(t) / P_base(today)] ÷ [P_quote(t) / P_quote(today)]
```

Today's real and nominal rates are equal. Earlier points show what the rate was worth in today's money.
When a currency weakens by exactly its extra inflation (purchasing-power parity), its real line stays flat.

## Data

| What | Source | Stored in repo | Live |
|---|---|---|---|
| Exchange rates | ECB daily reference rates via [Frankfurter](https://frankfurter.dev), since 1999 | `public/data/fx-eur.json` (every currency per 1 EUR) | Days newer than the snapshot are fetched in the browser |
| Inflation | [IMF World Economic Outlook](https://www.imf.org/external/datamapper/PCPIPCH), annual average CPI change; euro-area aggregate for EUR | `src/data/inflation.json` | – (the IMF API blocks browser requests) |

The app always loads the committed snapshot first, so it works even when the live API is down. The footer says whether
the newest days came from the live feed or the snapshot. Rates for any base currency are cross rates of the
EUR-based data (`quote/EUR ÷ base/EUR`).

Annual inflation averages are placed mid-year and interpolated geometrically, giving a smooth daily price index.
WEO numbers for the current and next year are IMF estimates or projections.

Refresh the snapshots (inflation needs `curl`):

```sh
npm run data          # both
npm run data:fx       # exchange rates only
npm run data:inflation
```

## Deploying to GitHub Pages

`.github/workflows/deploy.yml` builds and publishes the site on every push to `main`, on weekday evenings
(to pick up new ECB rates), and on demand from the Actions tab. Each run refreshes both datasets before building,
and keeps the committed copies if a source is down.

One-time setup: in the repository go to **Settings → Pages → Build and deployment** and set **Source** to
**GitHub Actions**. The site will be at `https://<owner>.github.io/<repo>/`. The build uses relative asset paths,
so it also works from any other static host.

## Development

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests for the inflation math
npm run build    # static site in dist/ (relative paths, can be hosted anywhere)
```

Stack: Vite, React 19, TypeScript. The chart is plain SVG with no chart library.
