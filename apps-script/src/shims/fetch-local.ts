/**
 * For the static website (no server at all): fetch("/api/…") is answered in
 * the browser by the same router and maths as the real API, using the
 * bundled IA snapshot. Live sources can't be reached from a static page, so
 * a "live" request falls back to the snapshot with a clear warning.
 */
import { parseQuery, route } from "@/lib/api/router";
import { assembleDataset, snapshotSeries, unavailableSeries, type DatasetQuery } from "@/lib/data/assemble";

const WHY = "this hosted page can't reach FRED, the World Bank or Kraken; the full site can";

function load(q: DatasetQuery) {
  return assembleDataset(q, q.assets.map((a) => (q.source === "snapshot" ? snapshotSeries(a) : unavailableSeries(a, WHY))));
}

const realFetch = window.fetch.bind(window);

window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith("/api/")) return realFetch(input, init);
  const [path, qs = ""] = url.split("?");
  const r = route(init?.method ?? "GET", path.replace(/^\/api\//, ""), parseQuery(qs), typeof init?.body === "string" ? init.body : null, load);
  return Promise.resolve(new Response(JSON.stringify(r.body), { status: r.status, headers: { "content-type": "application/json" } }));
};

/** No Apps Script here: callers treat this as "not available". */
export function scriptRun(): never {
  throw new Error("not running in Apps Script");
}
