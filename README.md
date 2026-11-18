# fxtrend

Inflation-adjusted foreign currency conversion rates over time.

Pick a base currency, add up to eight currencies to compare, and flip **Adjust for inflation** to restate
every historical rate in today's purchasing power. Each currency is adjusted by its own home economy's
consumer price inflation.

- **Compare view**: % change of 1 unit of the base currency against every selected currency, on one shared axis.
- **Detail view** (tap a card): the actual rate, with the inflation-adjusted line, the nominal line (dashed),
  and a breakdown of cumulative inflation in both economies.
- Mobile-first layout with bottom-sheet pickers; two-column layout on desktop. Light and dark themes.
- Crosshair tooltip (mouse, touch, or arrow keys on the focused chart) and a data-table view.
- The URL holds the current view, so a link shares exactly what you see.

## How the adjustment works

For a nominal rate `S(t)` (units of quote currency per 1 base) and consumer price indices `P`:

```
real(t) = S(t) × [P_base(t) / P_base(today)] ÷ [P_quote(t) / P_quote(today)]
```

Today's real and nominal rates are equal. Earlier points show what the rate was worth in today's money.
When a currency weakens by exactly its extra inflation (purchasing-power parity), its real line stays flat.

## Data

| What | Source | How |
|---|---|---|
| Exchange rates | ECB reference rates via [Frankfurter](https://frankfurter.dev), daily since 1999 | Fetched live in the browser (no key, CORS-enabled) |
| Inflation | [IMF World Economic Outlook](https://www.imf.org/external/datamapper/PCPIPCH), annual average CPI change; euro-area aggregate for EUR | Bundled in `src/data/inflation.json` because the IMF API blocks browser requests |

Annual averages are placed mid-year and interpolated geometrically, giving a smooth daily price index.
WEO numbers for the current and next year are IMF estimates or projections.

To refresh the inflation snapshot (needs `curl`):

```sh
npm run data:inflation
```

## Development

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests for the inflation math
npm run build    # static site in dist/ (relative paths, can be hosted anywhere)
```

Stack: Vite, React 19, TypeScript. The chart is plain SVG with no chart library.
