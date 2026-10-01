/**
 * Portfolio Explorer: Apps Script LOADER.
 *
 * Instead of pasting the two large generated files, this small script
 * downloads them from GitHub (pinned to one tested commit, so they can't
 * change underneath you) and caches them for 6 hours:
 *
 *   Index.html → the website
 *   Code.gs    → the backend (API, data fetching, daily cache)
 *
 * Source: https://github.com/jaiseldang/Math-Behind-Stocks/tree/<commit>/apps-script/dist
 *
 * Setup:
 *   1. (Optional) Project Settings → Script Properties → add FRED_API_KEY.
 *   2. Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone).
 * Functions you can run from the editor: testSources, clearCache, refreshCode.
 */

var PE_COMMIT = "236e84df54ec250d65941883532edc281c4beb12";
var PE_SOURCE = "https://raw.githubusercontent.com/jaiseldang/Math-Behind-Stocks/" + PE_COMMIT + "/apps-script/dist/";
var PE_CHUNK = 60000; // CacheService values are limited to 100 KB

/** Download a generated file (or take it from the cache). */
function peFetch_(name) {
  var cache = CacheService.getScriptCache();
  var prefix = "src:" + PE_COMMIT.slice(0, 12) + ":" + name;
  var n = Number(cache.get(prefix + ":n") || 0);
  if (n) {
    var keys = [];
    for (var i = 0; i < n; i++) keys.push(prefix + ":" + i);
    var parts = cache.getAll(keys);
    if (keys.every(function (k) { return parts[k] != null; })) {
      return keys.map(function (k) { return parts[k]; }).join("");
    }
  }
  var res = UrlFetchApp.fetch(PE_SOURCE + name, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    throw new Error("Could not download " + name + " from GitHub (HTTP " + res.getResponseCode() + "). Is the repository still public?");
  }
  var text = res.getContentText("UTF-8");
  var chunks = {};
  var count = Math.ceil(text.length / PE_CHUNK);
  for (var j = 0; j < count; j++) chunks[prefix + ":" + j] = text.slice(j * PE_CHUNK, (j + 1) * PE_CHUNK);
  chunks[prefix + ":n"] = String(count);
  try {
    cache.putAll(chunks, 21600);
  } catch (e) {
    // caching is only a speed-up
  }
  return text;
}

var PE_APP = null;
/** Load the backend (Code.gs) once per request and return its functions. */
function peApp_() {
  if (!PE_APP) PE_APP = new Function(peFetch_("Code.gs") + "\nreturn PortfolioExplorer;")();
  return PE_APP;
}

/** The website, or the JSON API when ?api=… is given. */
function doGet(e) {
  if (e && e.parameter && e.parameter.api) return peApp_().doGet(e);
  return HtmlService.createHtmlOutput(peFetch_("Index.html"))
    .setTitle("Portfolio Explorer")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

/** POST ?api=optimize with a JSON body. */
function doPost(e) {
  return peApp_().doPost(e);
}

/** Called by the web page through google.script.run. */
function handleApi(method, url, body) {
  return peApp_().handleApi(method, url, body);
}

function serviceUrl() {
  return ScriptApp.getService().getUrl();
}

/** Run from the editor: checks FRED, the gold CSV and Kraken (see the execution log). */
function testSources() {
  return peApp_().testSources();
}

/** Run from the editor: deletes cached price data so the next request downloads fresh data. */
function clearCache() {
  return peApp_().clearCache();
}

/** Run from the editor: re-download Index.html and Code.gs from GitHub. */
function refreshCode() {
  var cache = CacheService.getScriptCache();
  ["Index.html", "Code.gs"].forEach(function (name) {
    cache.remove("src:" + PE_COMMIT.slice(0, 12) + ":" + name + ":n");
  });
  peFetch_("Index.html");
  peFetch_("Code.gs");
  Logger.log("Downloaded the site and backend from commit " + PE_COMMIT);
}
