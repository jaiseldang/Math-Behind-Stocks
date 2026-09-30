/**
 * fetch() with a timeout and retries using exponential backoff.
 *
 * We retry only when trying again could help: network errors, HTTP 429
 * ("too many requests", honouring the Retry-After header) and 5xx server
 * errors. A 4xx such as "bad API key" fails immediately.
 */
export interface RetryOptions {
  retries?: number; // extra attempts after the first (default 3)
  baseDelayMs?: number; // 500 → waits 0.5 s, 1 s, 2 s
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function fetchWithRetry(url: string, opts: RetryOptions = {}): Promise<Response> {
  const { retries = 3, baseDelayMs = 500, timeoutMs = 15000, fetchImpl = fetch, sleep = defaultSleep } = opts;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, { signal: controller.signal, headers: { "User-Agent": "portfolio-explorer (IB IA)" } });
      if (res.ok) return res;
      const retryable = res.status === 429 || res.status >= 500;
      lastError = new HttpError(res.status, `HTTP ${res.status} from ${new URL(url).host}`);
      if (!retryable || attempt === retries) throw lastError;
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : baseDelayMs * 2 ** attempt);
    } catch (e) {
      if (e instanceof HttpError) throw e;
      lastError = e; // network error or timeout
      if (attempt === retries) break;
      await sleep(baseDelayMs * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
