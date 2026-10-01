/**
 * Portfolio Explorer: Google Apps Script backend (becomes Code.gs).
 *
 * It serves the website (Index.html) and the same JSON API as the Next.js
 * version, re-using the same maths and data code. Only the input/output is
 * different:
 *   - fetching:  UrlFetchApp instead of fetch()
 *   - caching:   Script Properties (compressed) instead of files on disk
 *   - the API:   <web app URL>?api=prices&...  instead of /api/prices?...
 *
 * Apps Script runs each request synchronously, so everything here is synchronous.
 */
import { parseAssets, type AssetId } from "@/lib/assets";
import { frontierPayload, optimizePayload, pricesPayload, returnsPayload, sensitivityPayload, statsPayload } from "@/lib/api/compute";
import { Unprocessable } from "@/lib/api/http";
import { openApiSpec } from "@/lib/api/openapi";
import { BadRequest, num, parseCommon } from "@/lib/api/query";
import {
  assembleDataset, failedSeries, liveSeriesFromRaw, snapshotSeries, unavailableSeries,
  type CacheResult, type DatasetQuery, type SeriesResult,
} from "@/lib/data/assemble";
import { fredRawSeries, fredUrl, FRED_NAME, type FredResponse } from "@/lib/data/providers/fred";
import { GOLD_CSV_URL, GOLD_NAME, goldRawSeries } from "@/lib/data/providers/gold";
import { KRAKEN_NAME, krakenRawSeries, krakenUrl, type KrakenResponse } from "@/lib/data/providers/kraken";
import { SNAPSHOT, SNAPSHOT_META } from "@/lib/data/snapshot";
import type { MonthlyDataset, RawSeries } from "@/lib/data/types";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const props = () => PropertiesService.getScriptProperties();

// ---------------------------------------------------------------------------
// Fetching with retries
// ---------------------------------------------------------------------------

/**
 * GET a URL, retrying with exponential backoff (0.5 s, 1 s, 2 s) on network
 * errors, HTTP 429 (honouring Retry-After) and 5xx. Other errors fail at once.
 */
export function fetchText(url: string, retries = 3): string {
  let lastError: Error = new Error("no attempt made");
  const host = url.split("/")[2];
  for (let attempt = 0; attempt <= retries; attempt++) {
    let code = 0;
    let wait = 500 * 2 ** attempt;
    try {
      const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      code = res.getResponseCode();
      if (code >= 200 && code < 300) return res.getContentText();
      lastError = new Error(`HTTP ${code} from ${host}`);
      const retryAfter = Number(res.getHeaders()["Retry-After"] ?? res.getHeaders()["retry-after"]);
      if (Number.isFinite(retryAfter) && retryAfter > 0) wait = retryAfter * 1000;
    } catch (e) {
      lastError = e as Error; // network error
    }
    const retryable = code === 0 || code === 429 || code >= 500;
    if (!retryable || attempt === retries) break;
    Utilities.sleep(Math.min(wait, 10000));
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// Daily cache in Script Properties
// ---------------------------------------------------------------------------
// Each property holds at most 9 KB, so the JSON is gzipped, base64-encoded and
// split into chunks. Unlike CacheService (max 6 hours), properties persist, so
// the last good copy is always available if a source goes down.

const CHUNK = 8000;

export function writeCache(key: string, data: unknown): void {
  const text = JSON.stringify({ savedAt: new Date().toISOString(), data });
  const packed = Utilities.base64Encode(Utilities.gzip(Utilities.newBlob(text)).getBytes());
  const p = props();
  const old = Number(p.getProperty(`cache:${key}:n`) ?? 0);
  const chunks: Record<string, string> = {};
  const n = Math.ceil(packed.length / CHUNK);
  for (let i = 0; i < n; i++) chunks[`cache:${key}:${i}`] = packed.slice(i * CHUNK, (i + 1) * CHUNK);
  chunks[`cache:${key}:n`] = String(n);
  p.setProperties(chunks);
  for (let i = n; i < old; i++) p.deleteProperty(`cache:${key}:${i}`);
}

export function readCache<T>(key: string): { savedAt: string; data: T } | null {
  try {
    const p = props();
    const n = Number(p.getProperty(`cache:${key}:n`) ?? 0);
    if (!n) return null;
    let packed = "";
    for (let i = 0; i < n; i++) packed += p.getProperty(`cache:${key}:${i}`) ?? "";
    const text = Utilities.ungzip(Utilities.newBlob(Utilities.base64Decode(packed), "application/x-gzip")).getDataAsString();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Cached for a day; if a refresh fails, the last good copy is returned as "stale". */
export function cachedSync<T>(key: string, fetcher: () => T, now = Date.now()): CacheResult<T> {
  const entry = readCache<T>(key);
  if (entry && now - Date.parse(entry.savedAt) < ONE_DAY_MS) return { data: entry.data, status: "hit", savedAt: entry.savedAt };
  try {
    const data = fetcher();
    try {
      writeCache(key, data);
    } catch {
      // Out of property storage: carry on without caching.
    }
    return { data, status: "miss", savedAt: new Date(now).toISOString() };
  } catch (e) {
    if (entry) return { data: entry.data, status: "stale", savedAt: entry.savedAt, error: (e as Error).message };
    throw e;
  }
}

/** Run from the editor to force fresh downloads next time. */
export function clearCache(): void {
  const p = props();
  for (const k of p.getKeys()) if (k.startsWith("cache:")) p.deleteProperty(k);
}

// ---------------------------------------------------------------------------
// Loading a dataset (same logic as lib/data/dataset.ts, but synchronous)
// ---------------------------------------------------------------------------

const PROVIDER_NAMES: Record<AssetId, string> = { SPX: FRED_NAME, XAU: GOLD_NAME, SOL: KRAKEN_NAME };

function fetchRaw(asset: AssetId, q: DatasetQuery): RawSeries {
  if (asset === "SPX") {
    const key = props().getProperty("FRED_API_KEY") ?? "";
    return fredRawSeries(asset, JSON.parse(fetchText(fredUrl(key))) as FredResponse, key);
  }
  if (asset === "XAU") return goldRawSeries(asset, fetchText(GOLD_CSV_URL));
  const weekly = (q.solInterval ?? "weekly") === "weekly";
  return krakenRawSeries(asset, JSON.parse(fetchText(krakenUrl(weekly))) as KrakenResponse, weekly);
}

function liveSeries(asset: AssetId, q: DatasetQuery): SeriesResult {
  if (asset === "SPX" && !props().getProperty("FRED_API_KEY")) {
    return unavailableSeries(asset, "FRED_API_KEY is not set in Script Properties");
  }
  const interval = asset === "SOL" ? q.solInterval ?? "weekly" : "default";
  try {
    return liveSeriesFromRaw(asset, q, cachedSync(`${asset}-${interval}`, () => fetchRaw(asset, q)));
  } catch (e) {
    return failedSeries(asset, PROVIDER_NAMES[asset], (e as Error).message);
  }
}

export function loadMonthlyPrices(q: DatasetQuery): MonthlyDataset {
  const series = q.source === "snapshot" ? q.assets.map((a) => snapshotSeries(a)) : q.assets.map((a) => liveSeries(a, q));
  return assembleDataset(q, series);
}

// ---------------------------------------------------------------------------
// The API router (same endpoints and parameters as the Next.js version)
// ---------------------------------------------------------------------------

export interface ApiResult {
  status: number;
  body: unknown;
}

/** "a=1&b=x%2Cy" → { a: "1", b: "x,y" } */
export function parseQuery(qs: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of qs.split("&")) {
    if (!part) continue;
    const [k, v = ""] = part.split("=");
    out[decodeURIComponent(k.replace(/\+/g, " "))] = decodeURIComponent(v.replace(/\+/g, " "));
  }
  return out;
}

function gasDocs() {
  return {
    ...openApiSpec,
    info: {
      ...openApiSpec.info,
      description:
        openApiSpec.info.description +
        " In the Google Apps Script version, call <web app URL>?api=<endpoint>&<parameters>, e.g. ?api=stats&source=snapshot or ?api=explore/sensitivity&pair=SPX,XAU&rho=-0.5,0,0.5. POST optimize with ?api=optimize and a JSON body. Apps Script always answers HTTP 200, so errors are reported in the body as { status, error }.",
    },
  };
}

/** Route a request. `endpoint` is e.g. "prices" or "explore/sensitivity". */
export function route(method: string, endpoint: string, query: Record<string, string>, bodyText?: string | null): ApiResult {
  try {
    const get = (k: string) => query[k];
    const load = (q: DatasetQuery) => loadMonthlyPrices(q);
    switch (endpoint) {
      case "prices":
        return { status: 200, body: pricesPayload(load(parseCommon(get))) };
      case "returns":
        return { status: 200, body: returnsPayload(load(parseCommon(get))) };
      case "stats":
        return { status: 200, body: statsPayload(load(parseCommon(get))) };
      case "frontier":
        return {
          status: 200,
          body: frontierPayload(load(parseCommon(get)), num(get("from_mu"), "from_mu", 0.01), num(get("to_mu"), "to_mu", 0.034), num(get("step"), "step", 0.001)),
        };
      case "explore/sensitivity": {
        let pair: AssetId[];
        try {
          pair = parseAssets(get("pair") ?? "SPX,XAU");
        } catch (e) {
          throw new BadRequest((e as Error).message);
        }
        if (pair.length !== 2) throw new BadRequest("pair must name exactly two assets, e.g. SPX,XAU");
        const rhos = (get("rho") ?? "-0.5,0,0.5").split(",").map((r) => num(r, "rho"));
        if (rhos.length > 50) throw new BadRequest("at most 50 rho values");
        return { status: 200, body: sensitivityPayload(load(parseCommon(get)), pair as [AssetId, AssetId], rhos) };
      }
      case "optimize": {
        if (method !== "POST") throw new BadRequest("optimize needs POST with a JSON body");
        let body: Record<string, unknown>;
        try {
          body = JSON.parse(bodyText ?? "");
        } catch {
          throw new BadRequest("body must be JSON");
        }
        const q = parseCommon((k) => body[k]);
        return { status: 200, body: optimizePayload(load(q), num(body.targetReturn, "targetReturn"), num(body.amount, "amount", 1000), body.includeSteps === true) };
      }
      case "snapshot": {
        const ds = load({ assets: ["SPX", "XAU", "SOL"], method: "average", source: "snapshot" });
        return { status: 200, body: { meta: SNAPSHOT_META, data: SNAPSHOT, provenance: pricesPayload(ds).provenance } };
      }
      case "docs":
        return { status: 200, body: gasDocs() };
      default:
        return { status: 404, body: { error: `unknown endpoint "${endpoint}"` } };
    }
  } catch (e) {
    if (e instanceof BadRequest) return { status: 400, body: { error: e.message } };
    if (e instanceof Unprocessable) return { status: 422, body: { error: e.message, details: e.details } };
    return { status: 500, body: { error: (e as Error).message ?? "internal error" } };
  }
}

/** At most 120 API calls a minute per visitor (Apps Script has its own quotas too). */
function rateLimited(): boolean {
  try {
    const cache = CacheService.getScriptCache();
    const key = `rl:${Session.getTemporaryActiveUserKey() || "anon"}:${Math.floor(Date.now() / 60000)}`;
    const n = Number(cache.get(key) ?? 0) + 1;
    cache.put(key, String(n), 120);
    return n > 120;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Entry points called by Apps Script
// ---------------------------------------------------------------------------

function jsonOutput(r: ApiResult) {
  const body = r.status === 200 ? r.body : { status: r.status, ...(r.body as object) };
  return ContentService.createTextOutput(JSON.stringify(body, null, 2)).setMimeType(ContentService.MimeType.JSON);
}

/** GET: the website, or the JSON API when ?api=… is given. */
export function doGet(e: GasEvent) {
  const params = { ...(e?.parameter ?? {}) };
  const endpoint = params.api;
  if (endpoint) {
    delete params.api;
    if (rateLimited()) return jsonOutput({ status: 429, body: { error: "Too many requests, slow down." } });
    return jsonOutput(route("GET", endpoint, params));
  }
  return HtmlService.createHtmlOutputFromFile("Index").setTitle("Portfolio Explorer").addMetaTag("viewport", "width=device-width, initial-scale=1");
}

/** POST ?api=optimize with a JSON body. */
export function doPost(e: GasEvent) {
  const params = { ...(e?.parameter ?? {}) };
  const endpoint = params.api ?? "optimize";
  delete params.api;
  if (rateLimited()) return jsonOutput({ status: 429, body: { error: "Too many requests, slow down." } });
  return jsonOutput(route("POST", endpoint, params, e?.postData?.contents ?? null));
}

/**
 * Called from the web page via google.script.run with the same URLs the
 * Next.js site uses, e.g. handleApi("GET", "/api/prices?source=live").
 * Returns { status, body } with the body as a JSON string.
 */
export function handleApi(method: string, url: string, bodyText?: string | null): { status: number; body: string } {
  const [path, qs = ""] = url.split("?");
  const endpoint = path.replace(/^\/api\//, "");
  const r = rateLimited() ? { status: 429, body: { error: "Too many requests, slow down." } } : route(method, endpoint, parseQuery(qs), bodyText);
  return { status: r.status, body: JSON.stringify(r.body) };
}

/** The web app's own URL, so the API docs page can show real links. */
export function serviceUrl(): string {
  try {
    return ScriptApp.getService().getUrl();
  } catch {
    return "";
  }
}

/** Run this from the editor (Run ▶ testSources) to check every data source. Results appear in the execution log. */
export function testSources(): void {
  const key = props().getProperty("FRED_API_KEY");
  Logger.log(key ? "FRED_API_KEY is set." : "FRED_API_KEY is NOT set: add it under Project Settings → Script Properties.");
  for (const asset of ["SPX", "XAU", "SOL"] as AssetId[]) {
    try {
      if (asset === "SPX" && !key) continue;
      const raw = fetchRaw(asset, { assets: [asset], method: "average", source: "live" });
      Logger.log(`${asset}: OK, ${raw.observations.length} observations from ${raw.observations[0]?.date} to ${raw.observations[raw.observations.length - 1]?.date}`);
    } catch (e) {
      Logger.log(`${asset}: FAILED (${(e as Error).message})`);
    }
  }
  const r = route("GET", "stats", { source: "live", from: "2023-08" });
  Logger.log(`Live statistics: HTTP ${r.status}. Warnings: ${JSON.stringify((r.body as { provenance?: { warnings: string[] } }).provenance?.warnings ?? r.body)}`);
}
