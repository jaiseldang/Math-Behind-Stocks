"use client";
/**
 * App-wide state:
 *  - Settings: classmate mode (words instead of symbols) and theme.
 *  - Data: which prices the pages use (IA snapshot by default, or live from the API).
 *  - Guesses: what the reader predicted, so each Finding can compare.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ASSETS, DEFAULT_ASSETS, type AssetId } from "@/lib/assets";
import { SNAPSHOT } from "@/lib/data/snapshot";
import type { Method, Provenance } from "@/lib/data/types";

type Theme = "system" | "light" | "dark";

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
}

// ---------------- Settings ----------------
interface Settings {
  classmate: boolean;
  setClassmate: (v: boolean) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
}
const SettingsCtx = createContext<Settings | null>(null);

// ---------------- Data ----------------
export interface DataState {
  source: "snapshot" | "live";
  method: Method;
  setSource: (s: "snapshot" | "live") => void;
  setMethod: (m: Method) => void;
  assets: AssetId[];
  months: string[];
  prices: number[][];
  provenance: Provenance[] | null;
  warnings: string[];
  fallback: boolean;
  loading: boolean;
  error: string | null;
  /** Human-readable, for chart captions. */
  sourceNote: string;
}
const DataCtx = createContext<DataState | null>(null);

const snapshotMonths = SNAPSHOT.map((r) => r.month);
const SNAPSHOT_MONTHS_FIRST = snapshotMonths[0];
const snapshotPrices = DEFAULT_ASSETS.map((a) => SNAPSHOT.map((r) => r[ASSETS[a].snapshotKey]));

// ---------------- Guesses ----------------
export interface Guess {
  value: number | string;
  label: string;
}
interface Guesses {
  guesses: Record<string, Guess>;
  setGuess: (id: string, g: Guess | null) => void;
}
const GuessCtx = createContext<Guesses | null>(null);

export function Providers({ children }: { children: React.ReactNode }) {
  const [classmate, setClassmateState] = useState(false);
  const [theme, setThemeState] = useState<Theme>("system");
  const [guesses, setGuesses] = useState<Record<string, Guess>>({});
  const [source, setSourceState] = useState<"snapshot" | "live">("snapshot");
  const [method, setMethodState] = useState<Method>("average");
  const [data, setData] = useState({
    months: snapshotMonths,
    prices: snapshotPrices,
    provenance: null as Provenance[] | null,
    warnings: [] as string[],
    fallback: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setClassmateState(load("pe.classmate", false));
    setThemeState(load("pe.theme", "system"));
    setGuesses(load("pe.guesses", {}));
    setSourceState(load("pe.source", "snapshot"));
    setMethodState(load("pe.method", "average"));
  }, []);

  // Only touch data-theme once a theme has been chosen here, so a host page's
  // own theme (e.g. when the site is embedded) isn't overridden on load.
  const themeTouched = useRef(false);
  useEffect(() => {
    if (theme !== "system") themeTouched.current = true;
    if (!themeTouched.current) return;
    if (theme === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    // Live data uses the IA's start month so results stay comparable; it runs to the last complete month.
    fetch(`/api/prices?assets=SPX,XAU,SOL&from=${SNAPSHOT_MONTHS_FIRST}&source=${source}&method=${method}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
        return body;
      })
      .then((body) => {
        if (cancelled) return;
        setData({
          months: body.months,
          prices: DEFAULT_ASSETS.map((a) => body.prices[a]),
          provenance: body.provenance.assets,
          warnings: body.provenance.warnings,
          fallback: body.provenance.fallback,
        });
      })
      .catch((e) => !cancelled && setError(`Could not load ${source} data (${e.message}); showing the IA snapshot.`))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [source, method]);

  const setGuess = useCallback((id: string, g: Guess | null) => {
    setGuesses((prev) => {
      const next = { ...prev };
      if (g) next[id] = g;
      else delete next[id];
      save("pe.guesses", next);
      return next;
    });
  }, []);

  const settings = useMemo<Settings>(
    () => ({
      classmate,
      setClassmate: (v) => (setClassmateState(v), save("pe.classmate", v)),
      theme,
      setTheme: (t) => (setThemeState(t), save("pe.theme", t)),
    }),
    [classmate, theme],
  );

  const dataState = useMemo<DataState>(() => {
    const first = data.months[0];
    const last = data.months.at(-1)!;
    const sourceNote =
      source === "snapshot" || data.fallback
        ? `Source: IA snapshot (FRED/Shiller S&P 500, World Bank gold, Kraken SOL/USD), monthly ${method === "close" ? "month-end" : "averages"}, ${first} to ${last}.`
        : `Source: live FRED SP500, World Bank gold, Kraken SOL/USD; monthly ${method === "close" ? "month-end closes" : "averages"}, ${first} to ${last}.`;
    return {
      source,
      method,
      setSource: (s) => (setSourceState(s), save("pe.source", s)),
      setMethod: (m) => (setMethodState(m), save("pe.method", m)),
      assets: DEFAULT_ASSETS,
      ...data,
      loading,
      error,
      sourceNote,
    };
  }, [source, method, data, loading, error]);

  return (
    <SettingsCtx.Provider value={settings}>
      <DataCtx.Provider value={dataState}>
        <GuessCtx.Provider value={{ guesses, setGuess }}>{children}</GuessCtx.Provider>
      </DataCtx.Provider>
    </SettingsCtx.Provider>
  );
}

export function useSettings() {
  const c = useContext(SettingsCtx);
  if (!c) throw new Error("useSettings outside Providers");
  return c;
}
export function useData() {
  const c = useContext(DataCtx);
  if (!c) throw new Error("useData outside Providers");
  return c;
}
export function useGuess(id: string) {
  const c = useContext(GuessCtx);
  if (!c) throw new Error("useGuess outside Providers");
  return [c.guesses[id] ?? null, (g: Guess | null) => c.setGuess(id, g)] as const;
}
