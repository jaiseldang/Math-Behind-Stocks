/**
 * Which build is running: "next" (the full site), "gas" (Google Apps Script)
 * or "static" (the hosted single page, where downloads and third-party
 * widgets are blocked). Set at build time by scripts/build-apps-script.mjs.
 */
export const BUILD_TARGET: string = process.env.NEXT_PUBLIC_PE_TARGET ?? "next";
export const DOWNLOADS_ALLOWED = BUILD_TARGET !== "static";
