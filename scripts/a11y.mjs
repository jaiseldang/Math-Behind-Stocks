/**
 * Accessibility audit: runs axe-core (WCAG 2 A/AA rules) on every page in
 * light and dark mode. Usage: node scripts/a11y.mjs [baseUrl]
 */
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { existsSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3000";
const routes = ["/", "/data", "/returns", "/risk", "/matrices", "/lagrange", "/solving", "/explore", "/limitations", "/write-up", "/glossary", "/api-docs"];
const executablePath = process.env.CHROMIUM_PATH || (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const browser = await chromium.launch(executablePath ? { executablePath } : {});
let total = 0;
for (const [colorScheme, width] of [["light", 1280], ["dark", 1280], ["light", 390]]) {
  const ctx = await browser.newContext({ colorScheme, viewport: { width, height: 900 } });
  for (const r of routes) {
    const page = await ctx.newPage();
    // HASH=1: the Apps Script build uses hash routes (/#/data)
    await page.goto(process.env.HASH ? `${base}/#${r}` : base + r, { waitUntil: "networkidle" });
    const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude(".tv-box").analyze();
    total += res.violations.length;
    console.log(`${res.violations.length ? "✗" : "✓"} ${r} (${colorScheme}, ${width}px)`);
    for (const v of res.violations) console.log(`   ${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} node(s): ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
    await page.close();
  }
  await ctx.close();
}
await browser.close();
process.exit(total ? 1 : 0);
