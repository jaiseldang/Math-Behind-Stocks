/**
 * Run the generated Code.gs outside Google, with stand-ins for the Apps Script
 * services it uses. Used by the tests and by the local preview server.
 */
import vm from "node:vm";
import zlib from "node:zlib";

const blob = (bytes) => ({ bytes, getBytes: () => [...bytes], getDataAsString: () => bytes.toString("utf8") });

/**
 * @param {string} code  the contents of Code.gs
 * @param {(url: string) => {status: number, text: string, headers?: object}} upstream  answers UrlFetchApp
 */
export function createGasSandbox(code, upstream) {
  const store = new Map();
  const cache = new Map();
  const fetchLog = [];
  const sleeps = [];
  const props = {
    getProperty: (k) => store.get(k) ?? null,
    setProperty: (k, v) => (store.set(k, v), props),
    setProperties: (o) => {
      for (const [k, v] of Object.entries(o)) {
        if (v.length > 9000) throw new Error(`property ${k} too large (${v.length})`); // the real 9 KB limit
        store.set(k, v);
      }
      return props;
    },
    deleteProperty: (k) => (store.delete(k), props),
    getKeys: () => [...store.keys()],
  };
  const sandbox = {
    PropertiesService: { getScriptProperties: () => props },
    CacheService: { getScriptCache: () => ({ get: (k) => cache.get(k) ?? null, put: (k, v) => void cache.set(k, v) }) },
    UrlFetchApp: {
      fetch: (url) => {
        fetchLog.push(url);
        const r = upstream(url);
        return { getResponseCode: () => r.status, getContentText: () => r.text, getHeaders: () => r.headers ?? {} };
      },
    },
    Utilities: {
      sleep: (ms) => void sleeps.push(ms),
      newBlob: (data) => blob(typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data)),
      gzip: (b) => blob(zlib.gzipSync(b.bytes)),
      ungzip: (b) => blob(zlib.gunzipSync(b.bytes)),
      base64Encode: (bytes) => Buffer.from(bytes).toString("base64"),
      base64Decode: (s) => [...Buffer.from(s, "base64")],
    },
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput: (text) => ({ text, mime: "", setMimeType(m) { this.mime = m; return this; } }),
    },
    HtmlService: {
      createHtmlOutputFromFile: (name) => ({ file: name, title: "", meta: {}, setTitle(t) { this.title = t; return this; }, addMetaTag(k, v) { this.meta[k] = v; return this; } }),
    },
    Session: { getTemporaryActiveUserKey: () => "local-user" },
    ScriptApp: { getService: () => ({ getUrl: () => "https://script.google.com/macros/s/LOCAL-PREVIEW/exec" }) },
    Logger: { log: (...a) => console.log("[Logger]", ...a) },
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(code, ctx, { filename: "Code.gs" });
  return { ctx, store, fetchLog, sleeps };
}
