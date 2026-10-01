/**
 * Portfolio Explorer: browser entry point for the Google Apps Script build
 * (becomes the <script> inside Index.html).
 *
 * The pages, charts and maths are exactly the same files as the Next.js site.
 * Only navigation (hash routes) and the API transport (google.script.run) differ.
 */
import "@/app/globals.css";
import "./shims/fetch-bridge";
import { options } from "preact";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Shell } from "@/components/layout/Shell";
import { Providers } from "@/components/providers";
import { PageHeader } from "@/components/pattern/Stages";
import ApiDocs from "@/app/api-docs/page";
import DataPage from "@/app/data/page";
import ExplorePage from "@/app/explore/page";
import Glossary from "@/app/glossary/page";
import LagrangePage from "@/app/lagrange/page";
import LimitationsPage from "@/app/limitations/page";
import MatricesPage from "@/app/matrices/page";
import Home from "@/app/page";
import ReturnsPage from "@/app/returns/page";
import RiskPage from "@/app/risk/page";
import SolvingPage from "@/app/solving/page";
import WriteUpPage from "@/app/write-up/page";
import { BUILD_TARGET } from "@/lib/target";
import { scriptRun } from "./shims/fetch-bridge";
import { interceptLinks, scrollAfterRender, useRoute } from "./shims/router";

const ROUTES: Record<string, () => React.ReactNode> = {
  "/": Home,
  "/data": DataPage,
  "/returns": ReturnsPage,
  "/risk": RiskPage,
  "/matrices": MatricesPage,
  "/lagrange": LagrangePage,
  "/solving": SolvingPage,
  "/explore": ExplorePage,
  "/limitations": LimitationsPage,
  "/write-up": WriteUpPage,
  "/glossary": Glossary,
  "/api-docs": ApiDocsWithUrl,
  "/api-view": ApiView,
};

const TITLES: Record<string, string> = {
  "/data": "Data & provenance", "/returns": "Returns", "/risk": "Risk & correlation", "/matrices": "Why matrices",
  "/lagrange": "Lagrange multipliers", "/solving": "Solving it", "/explore": "Exploring the solution",
  "/limitations": "Limitations", "/write-up": "For my write-up", "/glossary": "Glossary", "/api-docs": "API docs",
};

function useServiceUrl() {
  const [url, setUrl] = useState("");
  useEffect(() => {
    try {
      scriptRun().withSuccessHandler((u) => setUrl(String(u ?? ""))).serviceUrl();
    } catch {
      // not running inside Apps Script
    }
  }, []);
  return url;
}

/** The API docs page, plus how to call the API on this Apps Script deployment. */
function ApiDocsWithUrl() {
  const url = useServiceUrl() || "<your web app URL>";
  if (BUILD_TARGET === "static") {
    return (
      <>
        <div className="banner" style={{ marginTop: 0 }}>
          <strong>Hosted version.</strong> There is no server behind this page, so the “Try it” links below run the same API code inside your browser, using the IA snapshot.
          The full site (Next.js or Google Apps Script) serves the API over HTTP with live data.
        </div>
        <ApiDocs />
      </>
    );
  }
  return (
    <>
      <div className="banner" style={{ marginTop: 0 }}>
        <strong>Apps Script version.</strong> The API lives at the web app&apos;s own address with an <code>api</code> parameter, for example{" "}
        <code style={{ wordBreak: "break-all" }}>{url}?api=stats&amp;source=snapshot</code>. POST to <code>?api=optimize</code> with a JSON body.
        Errors come back as HTTP 200 with <code>{"{ status, error }"}</code> in the body (Apps Script can&apos;t set status codes).
        The “Try it” links below open the result inside this page.
      </div>
      <ApiDocs />
    </>
  );
}

/** Shows the JSON for a “Try it” link (e.g. /api/stats?source=snapshot). */
function ApiView() {
  const { query } = useRoute();
  const u = new URLSearchParams(query).get("u") ?? "/api/docs";
  const [text, setText] = useState("Loading…");
  useEffect(() => {
    setText("Loading…");
    fetch(u)
      .then((r) => r.json())
      .then((b) => setText(JSON.stringify(b, null, 2)))
      .catch((e) => setText(`Error: ${(e as Error).message}`));
  }, [u]);
  return (
    <>
      <PageHeader n="·" title="API response" lead={<code>{u}</code>} />
      <p><a href="/api-docs">← Back to the API docs</a></p>
      <pre style={{ overflowX: "auto", background: "var(--surface-2)", padding: 12, borderRadius: 8, fontSize: "0.8rem" }}>{text}</pre>
    </>
  );
}

function NotFound() {
  return <PageHeader n="·" title="Page not found" lead={<a href="/">Go to the home page</a>} />;
}

function App() {
  const { path } = useRoute();
  const Page = ROUTES[path] ?? NotFound;
  useEffect(() => {
    document.title = TITLES[path] ? `${TITLES[path]} · Portfolio Explorer` : "Portfolio Explorer";
    scrollAfterRender();
  }, [path]);
  return (
    <Providers>
      <Shell>
        <Page key={path} />
      </Shell>
    </Providers>
  );
}

/**
 * Preact writes props on SVG elements as attributes with the same name, but
 * browsers only recognise "tabindex" (lower case) on SVG. React translates it;
 * here we do the same, so draggable chart handles stay keyboard-focusable.
 */
const SVG_TAGS = new Set(["svg", "g", "circle", "rect", "path", "line", "polygon", "text"]);
const previousVnodeHook = options.vnode;
options.vnode = (vnode) => {
  const props = vnode.props as Record<string, unknown> | null;
  if (typeof vnode.type === "string" && SVG_TAGS.has(vnode.type) && props && "tabIndex" in props) {
    props.tabindex = props.tabIndex;
    delete props.tabIndex;
  }
  previousVnodeHook?.(vnode);
};

interceptLinks();
createRoot(document.getElementById("root")!).render(<App />);
