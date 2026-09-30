import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { alignMonths, resampleMonthly, addMonths } from "@/lib/data/resample";
import { parseKraken } from "@/lib/data/providers/kraken";
import { parseFred } from "@/lib/data/providers/fred";
import { parseGoldCsv } from "@/lib/data/providers/gold";
import { fetchWithRetry, HttpError } from "@/lib/data/fetchWithRetry";
import { cached } from "@/lib/data/cache";
import { tradingDays, weekdayCount } from "@/lib/data/calendar";
import { SNAPSHOT } from "@/lib/data/snapshot";

const ts = (d: string) => Date.parse(d + "T00:00:00Z") / 1000;

describe("resampling", () => {
  const obs = [
    { date: "2024-01-02", value: 10 },
    { date: "2024-01-31", value: 20 },
    { date: "2024-01-15", value: 30 },
    { date: "2024-02-01", value: 5 },
  ];
  it("average = mean of the month's observations", () => {
    const m = resampleMonthly(obs, "average");
    expect(m[0]).toMatchObject({ month: "2024-01", value: 20, count: 3 });
    expect(m[1]).toMatchObject({ month: "2024-02", value: 5, count: 1 });
  });
  it("close = last observation of the month (by date, not input order)", () => {
    expect(resampleMonthly(obs, "close")[0].value).toBe(20);
  });
  it("aligns on months every series has", () => {
    const a = resampleMonthly(obs, "average");
    const b = resampleMonthly([{ date: "2024-02-10", value: 1 }, { date: "2024-03-10", value: 1 }], "average");
    expect(alignMonths([a, b])).toEqual({ months: ["2024-02"], dropped: ["2024-01", "2024-03"] });
  });
  it("month arithmetic", () => {
    expect(addMonths("2023-08", 6)).toBe("2024-02");
    expect(addMonths("2024-01", -1)).toBe("2023-12");
  });
});

describe("Kraken dating rule", () => {
  it("dates a weekly candle (opens Thursday) by its last day, the Wednesday", () => {
    const json = {
      error: [],
      result: {
        SOLUSD: [
          [ts("2023-12-28"), "1", "1", "1", "100.00", "1", "1", 1], // Thu 28 Dec → Wed 3 Jan
          [ts("2024-01-25"), "1", "1", "1", "110.00", "1", "1", 1], // Thu 25 Jan → Wed 31 Jan
          [ts("2024-02-01"), "1", "1", "1", "120.00", "1", "1", 1], // Thu 1 Feb  → Wed 7 Feb
        ],
        last: 0,
      },
    };
    const o = parseKraken(json, 10080);
    expect(o.map((x) => x.date)).toEqual(["2024-01-03", "2024-01-31", "2024-02-07"]);
    expect(o[0].value).toBe(100);
  });
  it("daily candles keep their own date", () => {
    const o = parseKraken({ error: [], result: { SOLUSD: [[ts("2024-03-05"), "1", "1", "1", "2.5", "1", "1", 1]] } }, 1440);
    expect(o).toEqual([{ date: "2024-03-05", value: 2.5 }]);
  });
  it("surfaces Kraken errors", () => {
    expect(() => parseKraken({ error: ["EGeneral:Too many requests"], result: {} }, 1440)).toThrow(/Too many/);
  });
  it("the Wednesday rule matches the IA snapshot: n × average has 2 decimals in every month", () => {
    for (const r of SNAPSHOT) {
      const s = r.solana * weekdayCount(r.month, 3) * 100;
      expect(Math.abs(s - Math.round(s)), r.month).toBeLessThan(1e-6);
    }
  });
});

describe("other parsers", () => {
  it("FRED skips '.' (holidays)", () => {
    expect(parseFred({ observations: [{ date: "2024-01-01", value: "." }, { date: "2024-01-02", value: "4742.83" }] })).toEqual([
      { date: "2024-01-02", value: 4742.83 },
    ]);
  });
  it("gold CSV", () => {
    expect(parseGoldCsv("Date,Price\n2026-07,4073.000\n2026-08,4411.000\n")).toEqual([
      { date: "2026-07-01", value: 4073 },
      { date: "2026-08-01", value: 4411 },
    ]);
  });
  it("trading-day calendar", () => {
    expect(tradingDays("2024-01")).toBe(21); // 23 weekdays − New Year − MLK
    expect(tradingDays("2025-01")).toBe(20); // also closed 9 Jan 2025
  });
});

describe("fetchWithRetry", () => {
  const sleep = vi.fn(async (_ms: number) => {});
  beforeEach(() => sleep.mockClear());

  it("retries 429 and 5xx with exponential backoff, then succeeds", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const res = await fetchWithRetry("https://example.com/x", { fetchImpl: f, sleep, baseDelayMs: 100 });
    expect(await res.text()).toBe("ok");
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([100, 200]);
  });
  it("honours Retry-After", async () => {
    const f = vi.fn().mockResolvedValueOnce(new Response("", { status: 429, headers: { "retry-after": "7" } })).mockResolvedValueOnce(new Response("ok"));
    await fetchWithRetry("https://example.com/x", { fetchImpl: f, sleep });
    expect(sleep).toHaveBeenCalledWith(7000);
  });
  it("does not retry a 403", async () => {
    const f = vi.fn().mockResolvedValue(new Response("", { status: 403 }));
    await expect(fetchWithRetry("https://example.com/x", { fetchImpl: f, sleep })).rejects.toBeInstanceOf(HttpError);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("gives up after the retries on network errors", async () => {
    const f = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    await expect(fetchWithRetry("https://example.com/x", { fetchImpl: f, sleep, retries: 2 })).rejects.toThrow("fetch failed");
    expect(f).toHaveBeenCalledTimes(3);
  });
});

describe("daily cache with stale fallback", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "pe-cache-"));
    process.env.CACHE_DIR = dir;
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    delete process.env.CACHE_DIR;
  });

  it("miss → hit within a day → refetch after a day → stale when the source is down", async () => {
    const t0 = Date.now();
    const first = await cached("k", async () => 1, undefined, t0);
    expect(first.status).toBe("miss");
    const second = await cached("k", async () => 2, undefined, t0 + 1000);
    expect(second).toMatchObject({ status: "hit", data: 1 });
    const down = await cached("k", async () => { throw new Error("source down"); }, undefined, t0 + 2 * 86400000);
    expect(down).toMatchObject({ status: "stale", data: 1, error: "source down" });
  });
  it("throws when the source is down and nothing is cached", async () => {
    await expect(cached("none", async () => { throw new Error("down"); })).rejects.toThrow("down");
  });
});
