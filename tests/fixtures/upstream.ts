/**
 * Fake versions of the three upstream sources, in their real response formats,
 * so tests never need the network. Prices are smooth made-up waves.
 */
const days = (from: string, to: string) => {
  const out: string[] = [];
  for (let d = new Date(from + "T00:00:00Z"); d <= new Date(to + "T00:00:00Z"); d = new Date(d.getTime() + 86400000)) out.push(d.toISOString().slice(0, 10));
  return out;
};
const wave = (i: number, base: number, amp: number, period: number) => base * (1 + amp * Math.sin(i / period) + i * 0.0004);

/** Returns { status, text } for a URL, like an HTTP response body. */
export function fakeUpstream(url: string): { status: number; text: string } {
  if (url.includes("stlouisfed")) {
    const obs = days("2023-06-01", "2026-09-29")
      .filter((d) => ![0, 6].includes(new Date(d).getUTCDay()))
      .map((date, i) => ({ date, value: i % 50 === 0 ? "." : wave(i, 4500, 0.05, 40).toFixed(2) }));
    return { status: 200, text: JSON.stringify({ observations: obs }) };
  }
  if (url.includes("gold-prices")) {
    const months = days("2023-01-01", "2026-08-31").filter((d) => d.endsWith("-01"));
    return { status: 200, text: "Date,Price\n" + months.map((d, i) => `${d.slice(0, 7)},${wave(i, 1900, 0.04, 3).toFixed(3)}`).join("\n") };
  }
  if (url.includes("kraken")) {
    const weekly = url.includes("10080");
    const start = Date.parse("2023-06-01T00:00:00Z") / 1000; // a Thursday
    const step = weekly ? 7 * 86400 : 86400;
    const candles = [];
    for (let t = start, i = 0; t < Date.parse("2026-09-30T00:00:00Z") / 1000; t += step, i++) {
      candles.push([t, "0", "0", "0", wave(i, 50, 0.3, 5).toFixed(2), "0", "0", 1]);
    }
    return { status: 200, text: JSON.stringify({ error: [], result: { SOLUSD: weekly ? candles : candles.slice(-720), last: 0 } }) };
  }
  throw new TypeError("unexpected url " + url);
}

/** The same fakes as a fetch() implementation. */
export function fakeFetch(input: RequestInfo | URL): Promise<Response> {
  try {
    const { status, text } = fakeUpstream(String(input));
    return Promise.resolve(new Response(text, { status }));
  } catch (e) {
    return Promise.reject(e);
  }
}
