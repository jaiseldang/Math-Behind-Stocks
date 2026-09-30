"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { EXTRA_PAGES, PAGES } from "@/lib/pages";
import { useData, useSettings } from "@/components/providers";

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => setOpen(false), [path]);
  // Mobile drawer: Escape closes it; focus moves into it when opened and back to the Menu button when closed.
  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      menuButton.current?.focus();
    };
  }, [open]);
  useKeyboardScrollable();

  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <div className="mobile-bar">
        <button ref={menuButton} className="btn" aria-expanded={open} aria-controls="sidebar" onClick={() => setOpen(!open)}>
          ☰ Menu
        </button>
        <span className="brand">Portfolio Explorer</span>
      </div>
      <div className="shell">
        <aside className="sidebar" id="sidebar" data-open={open} aria-label="Site navigation">
          <button ref={closeButton} className="btn close-menu" onClick={() => setOpen(false)} aria-label="Close menu">✕ Close</button>
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

/**
 * Wide equations and tables scroll sideways on phones. A scrollable box must be
 * reachable by keyboard, so give it a tab stop, but only while it actually
 * overflows (no pointless tab stops on desktop).
 */
function useKeyboardScrollable() {
  useEffect(() => {
    const SEL = ".katex-display, .table-wrap, .chart-wrap, pre";
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        document.querySelectorAll<HTMLElement>(SEL).forEach((el) => {
          const scrolls = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
          if (scrolls && !el.hasAttribute("tabindex")) {
            el.setAttribute("tabindex", "0");
            el.dataset.autoTab = "1";
            if (!el.getAttribute("role")) el.setAttribute("role", "region");
            if (!el.getAttribute("aria-label")) el.setAttribute("aria-label", "Scrollable content");
          } else if (!scrolls && el.dataset.autoTab) {
            el.removeAttribute("tabindex");
            delete el.dataset.autoTab;
          }
        });
      });
    };
    update();
    const mo = new MutationObserver(update);
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", update);
    return () => {
      mo.disconnect();
      window.removeEventListener("resize", update);
      cancelAnimationFrame(frame);
    };
  }, []);
}
