# Portfolio Explorer on Google Apps Script

The whole site (all 10 pages, the maths engine and the real-data API) as a **Google Apps Script web app**. There is nothing to install: you paste three files into a script project and deploy.

The three files in [`dist/`](dist/) are **generated** from the same source code as the Next.js site, so the pages, numbers and tests are identical.

| File | What it is | Size |
|---|---|---|
| [`dist/Code.gs`](dist/Code.gs) | The backend: the JSON API, fetching FRED / World Bank / Kraken data with retries, and a daily cache | ~53 KB |
| [`dist/Index.html`](dist/Index.html) | The whole website in one file | ~235 KB |
| [`dist/appsscript.json`](dist/appsscript.json) | Project settings (V8 runtime, web app access) | tiny |

## Quickest setup: paste one short file (about 2 minutes)

[`loader/Code.gs`](loader/Code.gs) is about 100 lines. It downloads `Index.html` and `Code.gs` from this public GitHub repository, pinned to one tested commit so they can't change underneath you, caches them, and runs them. The site and API behave exactly as if you had pasted the big files.

1. Go to **<https://script.google.com>** → **New project**, and rename it “Portfolio Explorer”.
2. Replace everything in `Code.gs` with the contents of [`loader/Code.gs`](loader/Code.gs), then 💾 **Save**.
3. Optional: ⚙️ **Project Settings → Script Properties → Add script property** `FRED_API_KEY` (your free key) for live S&P 500 data.
4. Optional check: pick `testSources` in the function menu → ▶ **Run** → allow access (see step 7 below about the “unverified app” screen) → read the **Execution log**.
5. **Deploy → New deployment → ⚙️ Web app**. Set *Execute as* to **Me** and *Who has access* to **Anyone**, click **Deploy**, and open the **Web app URL**.

The repository must stay public for the loader to work. If you'd rather not depend on GitHub, use the full setup below.

## Full setup: paste the three files (about 5 minutes)

1. Go to **<https://script.google.com>** and click **New project**. Rename it “Portfolio Explorer”.
2. **Code.gs**: select everything in the editor's `Code.gs`, delete it, and paste the contents of [`dist/Code.gs`](dist/Code.gs). (On GitHub, open the file, click **Raw**, then select all and copy.)
3. **Index.html**: click **＋** next to *Files* → **HTML**, name it exactly `Index` (Apps Script adds `.html`), delete the starter text, and paste [`dist/Index.html`](dist/Index.html).
4. **appsscript.json**: click ⚙️ **Project Settings** → tick **Show "appsscript.json" manifest file in editor**. Go back to the editor, open `appsscript.json`, and replace it with [`dist/appsscript.json`](dist/appsscript.json).
5. **Your FRED key** (optional, for live S&P 500 data): ⚙️ **Project Settings** → **Script Properties** → **Add script property**. Property `FRED_API_KEY`, value: your key ([how to get a free key](../README.md#getting-a-free-fred-api-key)). Without it the site uses the IA snapshot for the S&P 500 and shows a banner saying so.
6. Click 💾 **Save**.
7. **Check the data sources** (optional): choose `testSources` in the function menu at the top and click ▶ **Run**. The first time, Google asks you to authorise the script to “connect to an external service”; this is UrlFetchApp downloading the price data. If you see *“Google hasn't verified this app”*, click **Advanced → Go to Portfolio Explorer (unsafe)**. That warning appears for every personal script. Then open **Execution log**: each source should say `OK`.
8. **Deploy**: **Deploy → New deployment** → ⚙️ *Select type* → **Web app**.
   - *Execute as*: **Me**
   - *Who has access*: **Anyone** (so classmates can open it without signing in), or **Anyone with a Google account**
   - Click **Deploy** and copy the **Web app URL**. That's your site.

After changing any file, use **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy** so the URL serves the new code.

## Using the API

The API lives at the web app URL with an `api` parameter (same endpoints and parameters as the Next.js version):

```
<web app URL>?api=prices&from=2023-08&to=2026-08&method=average
<web app URL>?api=stats&source=snapshot
<web app URL>?api=frontier&source=snapshot&from_mu=0.01&to_mu=0.034&step=0.001
<web app URL>?api=explore/sensitivity&source=snapshot&pair=SPX,XAU&rho=-0.5,0,0.5
<web app URL>?api=snapshot
<web app URL>?api=docs                       (OpenAPI spec)
```

`optimize` is a POST:

```bash
curl -L -X POST "<web app URL>?api=optimize" \
     -H 'content-type: application/json' \
     -d '{"source":"snapshot","targetReturn":0.02,"amount":1000}'
```

Apps Script always answers with HTTP 200, so errors appear in the body as `{ "status": 400, "error": "…" }`.

## How it differs from the Next.js version

| | Next.js | Apps Script |
|---|---|---|
| Page addresses | `/data`, `/returns`, … | `#/data`, `#/returns`, … (one-page app) |
| API address | `/api/stats?…` | `<web app URL>?api=stats&…` |
| Fetching | `fetch()` | `UrlFetchApp` (same retries and backoff) |
| Daily cache | files on disk | Script Properties (gzipped, split into 8 KB chunks), which also keep the last good copy if a source goes down |
| React | React 19 | Preact (a 10 KB React-compatible library; keeps Index.html small) |
| KaTeX | bundled | loaded from the jsDelivr CDN |
| Rate limit | 120/min per IP | 120/min per visitor (CacheService), plus Google's own quotas |

Handy functions you can run from the editor:
- `testSources`: checks FRED, the gold CSV and Kraken, and writes the results to the execution log.
- `clearCache`: deletes the cached downloads so the next request fetches fresh data.

## Rebuilding after changing the code

The source is the normal project (`app/`, `components/`, `lib/`) plus `apps-script/src/`. Don't edit `dist/` by hand.

```bash
npm install
npm run build:gas                          # regenerates apps-script/dist/
node scripts/preview-apps-script.mjs       # try it locally at http://localhost:3300 (no Google account needed)
npm test                                   # includes tests that run the generated Code.gs with fake Apps Script services
```

The local preview runs `Code.gs` with stand-ins for the Apps Script services. It has no internet access, so live data falls back to the snapshot.
