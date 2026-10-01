/** The hosted single-page build (static/index.html) and its in-browser API. */
import { describe, expect, it } from "vitest";
// @ts-expect-error: plain JavaScript build script
import { buildStatic } from "../scripts/build-apps-script.mjs";
import { route } from "@/lib/api/router";
import { assembleDataset, snapshotSeries, unavailableSeries, type DatasetQuery } from "@/lib/data/assemble";
import { expectSig } from "./helpers";

describe("static page", () => {
  it("follows the host's page contract", async () => {
    const page: string = await buildStatic();
    expect(page.startsWith("<title>Portfolio Explorer</title>")).toBe(true);
    expect(page).not.toMatch(/<!doctype|<html|<head>|<body/i);
    expect(page).toMatch(/url\(data:font\/woff2;base64,/); // KaTeX fonts embedded
    expect(page).not.toMatch(/url\(fonts\//);
    // external scripts only from an allowed CDN
    for (const m of page.matchAll(/<script src="([^"]+)"/g)) expect(m[1]).toMatch(/^https:\/\/cdn\.jsdelivr\.net\/npm\//);
    expect(page).not.toMatch(/<link rel="stylesheet"/);
    expect(Buffer.byteLength(page)).toBeLessThan(16 * 1024 * 1024);
  });

  it("answers API calls in the browser with the IA numbers, and explains that live data needs the full site", () => {
    const load = (q: DatasetQuery) => assembleDataset(q, q.assets.map((a) => (q.source === "snapshot" ? snapshotSeries(a) : unavailableSeries(a, "static page"))));
    const f = route("GET", "frontier", { source: "snapshot" }, null, load).body as { noShortSelling: { lower: number; upper: number } };
    expectSig(f.noShortSelling.lower, "0.019439");
    const live = route("GET", "prices", { source: "live" }, null, load).body as { provenance: { fallback: boolean; warnings: string[] } };
    expect(live.provenance.fallback).toBe(true);
    expect(live.provenance.warnings[0]).toMatch(/static page/);
  });
});
