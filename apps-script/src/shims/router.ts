/**
 * A tiny hash router for the Apps Script build. Pages live at #/data,
 * #/returns, … because an Apps Script web app is a single page.
 */
import { useEffect, useState } from "react";

let pendingAnchor: string | null = null;

/** "#/explore?u=x" → { path: "/explore", query: "u=x" } */
export function currentRoute(): { path: string; query: string } {
  const h = window.location.hash.replace(/^#/, "");
  if (!h.startsWith("/")) return { path: "/", query: "" };
  const [path, query = ""] = h.split("?");
  return { path: path || "/", query };
}

export function navigate(path: string, anchor?: string) {
  pendingAnchor = anchor ?? null;
  const target = `#${path}`;
  if (window.location.hash === target) scrollAfterRender();
  else window.location.hash = target;
}

/** After a route renders: jump to a pending #anchor, or to the top. */
export function scrollAfterRender() {
  const anchor = pendingAnchor;
  pendingAnchor = null;
  setTimeout(() => {
    if (anchor) document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth" });
    else window.scrollTo(0, 0);
  }, 50);
}

export function useRoute() {
  const [route, setRoute] = useState(currentRoute);
  useEffect(() => {
    const on = () => setRoute(currentRoute());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

/**
 * Pages contain ordinary links such as <a href="/limitations"> or
 * <a href="#investigation-5">. Turn them into router navigation.
 */
export function interceptLinks() {
  document.addEventListener("click", (e) => {
    const a = (e.target as Element | null)?.closest?.("a");
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
    const href = a.getAttribute("href");
    if (!href || a.target === "_blank" || a.hasAttribute("download") || /^[a-z]+:/i.test(href) || href.startsWith("#/")) return;
    e.preventDefault();
    if (href.startsWith("#")) {
      document.getElementById(href.slice(1))?.scrollIntoView({ behavior: "smooth" });
    } else if (href.startsWith("/api/")) {
      navigate(`/api-view?u=${encodeURIComponent(href)}`);
    } else if (href.startsWith("/")) {
      const [path, anchor] = href.split("#");
      navigate(path, anchor);
    }
  });
}
