import { parseAssets, type AssetId } from "@/lib/assets";
import type { DataSource, Method } from "@/lib/data/types";

export class BadRequest extends Error {
  status = 400;
}

export interface CommonQuery {
  assets: AssetId[];
  from?: string;
  to?: string;
  method: Method;
  source: DataSource;
  solInterval: "daily" | "weekly";
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function month(v: unknown, name: string): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v !== "string" || !MONTH.test(v)) throw new BadRequest(`${name} must look like YYYY-MM`);
  return v;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T, name: string): T {
  if (v === undefined || v === null || v === "") return fallback;
  if (!allowed.includes(v as T)) throw new BadRequest(`${name} must be one of: ${allowed.join(", ")}`);
  return v as T;
}

/** Parse the parameters shared by every data endpoint (from a query string or a JSON body). */
export function parseCommon(get: (k: string) => unknown): CommonQuery {
  let assets: AssetId[];
  try {
    const raw = get("assets");
    assets = parseAssets(Array.isArray(raw) ? raw.join(",") : (raw as string | undefined));
  } catch (e) {
    throw new BadRequest((e as Error).message);
  }
  const from = month(get("from"), "from");
  const to = month(get("to"), "to");
  if (from && to && from > to) throw new BadRequest("from must be before to");
  return {
    assets,
    from,
    to,
    method: oneOf(get("method"), ["average", "close"] as const, "average", "method"),
    source: oneOf(get("source"), ["live", "snapshot"] as const, "live", "source"),
    solInterval: oneOf(get("solInterval"), ["weekly", "daily"] as const, "weekly", "solInterval"),
  };
}

export function num(v: unknown, name: string, fallback?: number): number {
  if (v === undefined || v === null || v === "") {
    if (fallback === undefined) throw new BadRequest(`${name} is required`);
    return fallback;
  }
  const x = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(x)) throw new BadRequest(`${name} must be a number`);
  return x;
}
