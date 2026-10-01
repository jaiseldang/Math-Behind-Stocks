/**
 * Try the Apps Script build locally, without Google:
 *
 *   npm run build:gas && node scripts/preview-apps-script.mjs   → http://localhost:3300
 *
 * Serves apps-script/dist/Index.html and answers its google.script.run calls
 * by running apps-script/dist/Code.gs in a sandbox (scripts/gas-sandbox.mjs).
 * UrlFetchApp has no network here, so live data falls back to the snapshot,
 * exactly as it would in Apps Script if a source were down.
 * Set FRED_API_KEY to pretend a key is configured.
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createGasSandbox } from "./gas-sandbox.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "apps-script/dist");
const port = Number(process.env.PORT ?? 3300);

const { ctx, store } = createGasSandbox(readFileSync(path.join(dist, "Code.gs"), "utf8"), (url) => {
  throw new Error(`no network in the local preview (${url.split("/")[2]})`);
});
if (process.env.FRED_API_KEY) store.set("FRED_API_KEY", process.env.FRED_API_KEY);

// Stands in for google.script.run inside the page: each call is POSTed to /__gas.
const mockRun = `<script>
(function () {
  function runner(ok, fail) {
    return new Proxy({}, { get: function (_, name) {
      if (name === "withSuccessHandler") return function (f) { return runner(f, fail); };
      if (name === "withFailureHandler") return function (f) { return runner(ok, f); };
      return function () {
        var args = Array.prototype.slice.call(arguments);
        fetch("/__gas", { method: "POST", body: JSON.stringify({ fn: name, args: args }) })
          .then(function (r) { return r.json(); })
          .then(function (r) { if (r.error) { if (fail) fail(new Error(r.error)); } else if (ok) ok(r.result); });
      };
    } });
  }
  window.google = { script: { run: runner(null, null) } };
})();
</script>`;

createServer((req, res) => {
  if (req.method === "POST" && req.url === "/__gas") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const { fn, args } = JSON.parse(body);
        if (!["handleApi", "serviceUrl"].includes(fn)) throw new Error(`unknown function ${fn}`);
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ result: ctx[fn](...args) }));
      } catch (e) {
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }
  if (req.url.startsWith("/katex/")) {
    // serve KaTeX locally instead of from the CDN
    try {
      const f = path.join(root, "node_modules/katex/dist", req.url.slice(7).split("?")[0]);
      res.setHeader("content-type", f.endsWith(".css") ? "text/css" : f.endsWith(".js") ? "text/javascript" : f.endsWith(".woff2") ? "font/woff2" : "application/octet-stream");
      res.end(readFileSync(f));
    } catch {
      res.statusCode = 404;
      res.end();
    }
    return;
  }
  const html = readFileSync(path.join(dist, "Index.html"), "utf8")
    .replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/katex@[^/]+\/dist\//g, "/katex/")
    .replace("<head>", `<head>\n<meta name="viewport" content="width=device-width, initial-scale=1">${mockRun}`);
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(html);
}).listen(port, () => console.log(`Apps Script preview on http://localhost:${port}`));
