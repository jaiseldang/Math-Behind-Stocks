"use client";
/**
 * TradingView's free embeddable widget, for context only. TradingView has no
 * public data API and we never scrape it: every number on this site comes from
 * FRED, the World Bank and Kraken.
 */
import { useEffect, useRef, useState } from "react";
import { useSettings } from "@/components/providers";
import { BUILD_TARGET } from "@/lib/target";

export function TradingViewMini(props: { symbol: string; title: string }) {
  // The hosted single-page version can't load third-party scripts: show the link only.
  if (BUILD_TARGET === "static") {
    return (
      <div className="tv-box" style={{ minHeight: 0, padding: "10px 12px" }}>
        <a href={`https://www.tradingview.com/symbols/${props.symbol.replace(":", "-")}/`} target="_blank" rel="noopener noreferrer">{props.title} on TradingView ↗</a>
      </div>
    );
  }
  return <TradingViewWidget {...props} />;
}

function TradingViewWidget({ symbol, title }: { symbol: string; title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { theme } = useSettings();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = '<div class="tradingview-widget-container__widget"></div>';
    const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    const s = document.createElement("script");
    s.src = "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";
    s.async = true;
    s.onerror = () => setFailed(true);
    s.innerHTML = JSON.stringify({ symbol, width: "100%", height: 220, locale: "en", dateRange: "60M", colorTheme: dark ? "dark" : "light", isTransparent: true, autosize: true });
    el.appendChild(s);
  }, [symbol, theme]);
  const href = `https://www.tradingview.com/symbols/${symbol.replace(":", "-")}/`;
  return (
    <div className="tv-box">
      <div className="tradingview-widget-container" ref={ref} style={{ height: 220 }} />
      <div className="note" style={{ padding: "4px 8px" }}>
        {failed ? "TradingView could not load. " : ""}
        <a href={href} target="_blank" rel="noopener noreferrer">{title} on TradingView ↗</a>
      </div>
    </div>
  );
}
