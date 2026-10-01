"use client";
/**
 * Which build is running: "next" (the full site), "gas" (Google Apps Script)
 * or "static" (the hosted single page). Set at build time by
 * scripts/build-apps-script.mjs.
 */
import { useEffect, useState } from "react";
import { hostDownloads } from "./export";

export const BUILD_TARGET: string = process.env.NEXT_PUBLIC_PE_TARGET ?? "next";

/**
 * Can this page save files? Always on the full site and Apps Script; on the
 * hosted page only when the host offers its downloads capability.
 */
export function useDownloadsAllowed(): boolean {
  const [allowed, setAllowed] = useState(BUILD_TARGET !== "static");
  useEffect(() => {
    if (BUILD_TARGET !== "static") return;
    let live = true;
    hostDownloads().then((ns) => live && setAllowed(ns !== null));
    return () => {
      live = false;
    };
  }, []);
  return allowed;
}
