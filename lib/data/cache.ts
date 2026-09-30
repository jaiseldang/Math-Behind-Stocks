/**
 * A tiny file cache: one JSON file per key, refreshed at most once a day.
 *
 * If a refresh fails (source down, rate-limited, no network), we serve the
 * last cached copy and mark it "stale" so the site can show a banner.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function cacheDir(): string {
  if (process.env.CACHE_DIR) return process.env.CACHE_DIR;
  // Vercel's file system is read-only apart from /tmp (which may be wiped between requests).
  return process.env.VERCEL ? "/tmp/portfolio-cache" : path.join(process.cwd(), ".cache");
}

interface Entry<T> {
  savedAt: string;
  data: T;
}

const fileFor = (key: string) => path.join(cacheDir(), key.replace(/[^a-z0-9_.-]/gi, "_") + ".json");

export async function readCache<T>(key: string): Promise<Entry<T> | null> {
  try {
    return JSON.parse(await fs.readFile(fileFor(key), "utf8")) as Entry<T>;
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, data: T): Promise<void> {
  try {
    await fs.mkdir(cacheDir(), { recursive: true });
    await fs.writeFile(fileFor(key), JSON.stringify({ savedAt: new Date().toISOString(), data }));
  } catch {
    // A read-only disk shouldn't break the API; we just don't cache.
  }
}

export type CacheStatus = "hit" | "miss" | "stale";

/**
 * Return cached data if it is less than `maxAgeMs` old; otherwise call `fetcher`,
 * save and return the result. If `fetcher` throws and an older copy exists,
 * return that copy with status "stale" and the error message.
 */
export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  maxAgeMs = ONE_DAY_MS,
  now = Date.now(),
): Promise<{ data: T; status: CacheStatus; savedAt: string; error?: string }> {
  const entry = await readCache<T>(key);
  if (entry && now - Date.parse(entry.savedAt) < maxAgeMs) {
    return { data: entry.data, status: "hit", savedAt: entry.savedAt };
  }
  try {
    const data = await fetcher();
    await writeCache(key, data);
    return { data, status: "miss", savedAt: new Date(now).toISOString() };
  } catch (e) {
    if (entry) return { data: entry.data, status: "stale", savedAt: entry.savedAt, error: (e as Error).message };
    throw e;
  }
}
