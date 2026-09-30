/**
 * Shared plumbing for API routes: JSON responses, error handling and a simple
 * per-visitor rate limit (so nobody can hammer the upstream sources through us).
 */
import { BadRequest } from "./query";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 120;
const hits = new Map<string, { start: number; count: number }>();

export function rateLimit(ip: string, now = Date.now()): { ok: boolean; retryAfter: number } {
  const h = hits.get(ip);
  if (!h || now - h.start > WINDOW_MS) {
    hits.set(ip, { start: now, count: 1 });
    return { ok: true, retryAfter: 0 };
  }
  h.count++;
  return { ok: h.count <= MAX_PER_WINDOW, retryAfter: Math.ceil((h.start + WINDOW_MS - now) / 1000) };
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*", ...headers },
  });
}

export class Unprocessable extends Error {
  status = 422;
  constructor(message: string, public details?: unknown) {
    super(message);
  }
}

export async function handle(req: Request, fn: () => Promise<unknown>): Promise<Response> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const rl = rateLimit(ip);
  if (!rl.ok) return json({ error: "Too many requests, slow down.", retryAfterSeconds: rl.retryAfter }, 429, { "retry-after": String(rl.retryAfter) });
  try {
    return json(await fn(), 200, { "cache-control": "public, max-age=300" });
  } catch (e) {
    if (e instanceof BadRequest) return json({ error: e.message }, 400);
    if (e instanceof Unprocessable) return json({ error: e.message, details: e.details }, 422);
    console.error(e);
    return json({ error: (e as Error).message ?? "internal error" }, 500);
  }
}
