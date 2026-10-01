/**
 * The pages call fetch("/api/prices?…") exactly as in the Next.js version.
 * In Apps Script there is no /api/ URL, so those calls are sent to the
 * server-side function handleApi() via google.script.run instead.
 */
interface ScriptRun {
  withSuccessHandler(f: (r: unknown) => void): ScriptRun;
  withFailureHandler(f: (e: Error) => void): ScriptRun;
  handleApi(method: string, url: string, body: string | null): void;
  serviceUrl(): void;
}
declare global {
  interface Window {
    google?: { script: { run: ScriptRun } };
  }
}

export function scriptRun(): ScriptRun {
  const run = window.google?.script?.run;
  if (!run) throw new Error("google.script.run is not available (open the page through the Apps Script web app URL)");
  return run;
}

const realFetch = window.fetch.bind(window);

window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith("/api/")) return realFetch(input, init);
  return new Promise((resolve, reject) => {
    try {
      scriptRun()
        .withSuccessHandler((r) => {
          const { status, body } = r as { status: number; body: string };
          resolve(new Response(body, { status, headers: { "content-type": "application/json" } }));
        })
        .withFailureHandler((e) => reject(e))
        .handleApi(init?.method ?? "GET", url, typeof init?.body === "string" ? init.body : null);
    } catch (e) {
      reject(e);
    }
  });
};

export {};
