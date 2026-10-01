/**
 * Visit every page, report console errors, and save full-page screenshots.
 * Usage: node scripts/screenshots.mjs [baseUrl] [outDir] [routes...]
 */
import { chromium } from "playwright";
import { existsSync, mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3000";
const out = process.argv[3] ?? "screenshots";
const only = process.argv.slice(4);
const routes = only.length
  ? only
  : ["/", "/data", "/returns", "/risk", "/matrices", "/lagrange", "/solving", "/explore", "/limitations", "/write-up", "/glossary", "/api-docs"];
// Use a pre-installed Chromium if one is provided (e.g. CHROMIUM_PATH=/opt/pw-browsers/chromium)
const executablePath = process.env.CHROMIUM_PATH || (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);

mkdirSync(out, { recursive: true });
const browser = await chromium.launch(executablePath ? { executablePath } : {});
let failures = 0;
for (const theme of (process.env.THEMES ?? "light").split(",")) {
  for (const [label, viewport] of Object.entries({ desktop: { width: 1280, height: 900 }, ...(process.env.MOBILE ? { mobile: { width: 390, height: 844 } } : {}) })) {
    const ctx = await browser.newContext({ viewport, colorScheme: theme, deviceScaleFactor: 1 });
    for (const r of routes) {
      const page = await ctx.newPage();
      const errors = [];
      page.on("console", (m) => m.type() === "error" && !/tradingview|ERR_TUNNEL|ERR_CONNECTION|Failed to load resource/i.test(m.text()) && errors.push(m.text()));
      page.on("pageerror", (e) => errors.push(e.message));
      // HASH=1: the Apps Script build uses hash routes (/#/data)
      await page.goto(process.env.HASH ? `${base}/#${r}` : base + r, { waitUntil: "networkidle", timeout: 60000 }).catch((e) => errors.push(e.message));
      await page.waitForTimeout(800);
      const name = `${out}/${(r === "/" ? "home" : r.slice(1).replace(/\//g, "-"))}-${label}${theme === "light" ? "" : "-" + theme}.png`;
      await page.screenshot({ path: name, fullPage: true });
      console.log(errors.length ? `✗ ${r} (${label}, ${theme})\n   ${errors.join("\n   ")}` : `✓ ${r} (${label}, ${theme}) → ${name}`);
      failures += errors.length ? 1 : 0;
      await page.close();
    }
    await ctx.close();
  }
}
await browser.close();
process.exit(failures ? 1 : 0);
