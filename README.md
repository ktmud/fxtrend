# fxtrend

Inflation-adjusted foreign currency conversion rates over time.

Pick a base currency from 160+ world currencies, add up to eight to compare, and flip **Adjust for inflation** to restate
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
| Exchange rates | [Frankfurter v2](https://frankfurter.dev): central-bank reference rates for 160+ currencies, daily since 1999 where available | `public/data/fx/<CODE>.json` (units per 1 USD, one file per currency) | Days newer than the snapshot are fetched in the browser |
| Inflation | [IMF World Economic Outlook](https://www.imf.org/external/datamapper/PCPIPCH), annual average CPI change | `src/data/inflation.json` | – (the IMF API blocks browser requests) |
| Currency names, regions, flags | Frankfurter + ISO 3166 | `src/data/currencies.json` | – |

The app loads only the files for the currencies on screen, so it works even when the live API is down. The footer
says whether the newest days came from the live feed or the snapshot. Any pair is a cross rate through USD
(`quote/USD ÷ base/USD`). Sources publish on different calendars, so each leg carries its last quote forward for up
to a week.

Inflation comes from each currency's home economy. Currency unions use the euro-area aggregate (EUR) or their
largest member (Cameroon for XAF, Côte d'Ivoire for XOF, Saint Lucia for XCD). Sterling-pegged territories use UK CPI.
Currencies with no usable CPI (e.g. SDR, KPW) are tagged "no CPI" and shown as nominal rates.

Annual inflation averages are placed mid-year and interpolated geometrically, giving a smooth daily price index.
WEO numbers for the current and next year are IMF estimates or projections.

Refresh the snapshots (inflation needs `curl`):

```sh
npm run data            # both (exchange rates incrementally)
npm run data:fx         # append days newer than each currency's file
npm run data:fx:full    # rebuild every currency's full history (~15 min; add --resume after an interruption)
npm run data:inflation
```

## Deploying to GitHub Pages

`.github/workflows/deploy.yml` builds and publishes the site on every push to `main`, on weekday evenings
(to pick up new ECB rates), and on demand from the Actions tab. Each run refreshes both datasets before building,
and keeps the committed copies if a source is down.

`.github/workflows/refresh-inflation.yml` checks the IMF for new inflation figures each quarter (early February,
May, August and November, after each World Economic Outlook release or update). It can also be started from the
Actions tab. When the numbers changed, it runs the tests and opens or updates a pull request from
`data/inflation-refresh`. For it to open PRs, enable **Settings → Actions → General → Workflow permissions →
Allow GitHub Actions to create and approve pull requests**.

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
