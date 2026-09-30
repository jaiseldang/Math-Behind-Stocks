"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { EXTRA_PAGES, PAGES } from "@/lib/pages";
import { useData, useSettings } from "@/components/providers";

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);

  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <div className="mobile-bar">
        <button className="btn" aria-expanded={open} aria-controls="sidebar" onClick={() => setOpen(!open)}>
          ☰ Menu
        </button>
        <span className="brand">Portfolio Explorer</span>
      </div>
      <div className="shell">
        <aside className="sidebar" id="sidebar" data-open={open} aria-label="Site navigation">
          <div className="brand">Portfolio Explorer</div>
          <div className="brand-sub">S&amp;P 500 · Gold · Solana. The maths behind a minimum-risk portfolio.</div>
          <nav className="nav">
            <ol>
              {PAGES.map((p, i) => (
                <li key={p.href}>
                  <Link href={p.href} aria-current={path === p.href ? "page" : undefined}>
                    <span className="num">{i + 1}</span>
                    <span>{p.short}</span>
                  </Link>
                </li>
              ))}
            </ol>
            <ol className="nav-extra">
              {EXTRA_PAGES.map((p) => (
                <li key={p.href}>
                  <Link href={p.href} aria-current={path === p.href ? "page" : undefined}>
                    <span className="num">·</span>
                    <span>{p.short}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
          <Controls />
        </aside>
        {open && <div aria-hidden onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 45 }} />}
        <main className="main" id="main">
          <div className="content">
            <DataBanner />
            {children}
            <PageNav path={path} />
          </div>
        </main>
      </div>
    </>
  );
}

function Controls() {
  const { classmate, setClassmate, theme, setTheme } = useSettings();
  const { source, setSource, loading } = useData();
  return (
    <div className="controls">
      <label className="switch">
        <input type="checkbox" checked={classmate} onChange={(e) => setClassmate(e.target.checked)} />
        <span>
          <strong>Classmate mode</strong>
          <br />
          <span className="note">words instead of symbols</span>
        </span>
      </label>
      <div>
        <div className="note" id="theme-label">Theme</div>
        <div className="seg" role="group" aria-labelledby="theme-label">
          {(["system", "light", "dark"] as const).map((t) => (
            <button key={t} aria-pressed={theme === t} onClick={() => setTheme(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="note" id="data-label">Data {loading && "(loading…)"}</div>
        <div className="seg" role="group" aria-labelledby="data-label">
          <button aria-pressed={source === "snapshot"} onClick={() => setSource("snapshot")}>IA snapshot</button>
          <button aria-pressed={source === "live"} onClick={() => setSource("live")}>Live</button>
        </div>
      </div>
    </div>
  );
}

function DataBanner() {
  const { source, warnings, fallback, error } = useData();
  if (error) return <div className="banner" role="status">{error}</div>;
  if (source !== "live" || (!fallback && warnings.length === 0)) return null;
  return (
    <div className="banner" role="status">
      <strong>{fallback ? "Some live data is unavailable, so fallback data is shown." : "Data notes"}</strong>
      <ul>
        {warnings.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
    </div>
  );
}

function PageNav({ path }: { path: string }) {
  const i = PAGES.findIndex((p) => p.href === path);
  if (i < 0) return null;
  const prev = PAGES[i - 1];
  const next = PAGES[i + 1];
  return (
    <nav aria-label="Previous and next page" style={{ display: "flex", justifyContent: "space-between", marginTop: 48, gap: 12 }}>
      {prev ? <Link className="btn" href={prev.href}>← {prev.title}</Link> : <span />}
      {next ? <Link className="btn primary" href={next.href}>{next.title} →</Link> : <span />}
    </nav>
  );
}
