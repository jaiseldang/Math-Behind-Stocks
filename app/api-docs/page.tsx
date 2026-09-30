import { PageHeader } from "@/components/pattern/Stages";
import { openApiSpec } from "@/lib/api/openapi";

export const metadata = { title: "API documentation" };

const EXAMPLES: Record<string, string> = {
  "/api/prices": "/api/prices?assets=SPX,XAU,SOL&from=2023-08&to=2026-08&method=average",
  "/api/returns": "/api/returns?source=snapshot",
  "/api/stats": "/api/stats?source=snapshot",
  "/api/frontier": "/api/frontier?source=snapshot&from_mu=0.01&to_mu=0.034&step=0.001",
  "/api/explore/sensitivity": "/api/explore/sensitivity?source=snapshot&pair=SPX,XAU&rho=-0.5,0,0.5",
  "/api/snapshot": "/api/snapshot",
  "/api/docs": "/api/docs",
};

export default function ApiDocs() {
  return (
    <>
      <PageHeader n="·" title="API documentation" lead={<>The machine-readable OpenAPI 3.1 spec is at <a href="/api/docs">/api/docs</a>. Every response includes a <code>provenance</code> block.</>} />
      {Object.entries(openApiSpec.paths).map(([path, ops]) =>
        Object.entries(ops).map(([method, op]) => {
          const o = op as { summary: string; parameters?: { name: string; description?: string; schema: { default?: unknown } }[] };
          return (
            <section className="stage" key={path + method}>
              <h3><code>{method.toUpperCase()} {path}</code></h3>
              <p>{o.summary}</p>
              {o.parameters && (
                <div className="table-wrap">
                  <table className="data">
                    <thead><tr><th>Parameter</th><th>Default</th><th style={{ textAlign: "left" }}>Meaning</th></tr></thead>
                    <tbody>
                      {o.parameters.map((p) => (
                        <tr key={p.name}><td><code>{p.name}</code></td><td>{p.schema.default !== undefined ? String(p.schema.default) : ""}</td><td style={{ textAlign: "left" }}>{p.description ?? ""}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {method === "post" ? (
                <pre style={{ overflowX: "auto", background: "var(--surface-2)", padding: 10, borderRadius: 8 }}>{`curl -X POST /api/optimize -H 'content-type: application/json' \\
  -d '{"source":"snapshot","targetReturn":0.02,"amount":1000}'`}</pre>
              ) : (
                EXAMPLES[path] && <p className="note">Try it: <a href={EXAMPLES[path]}>{EXAMPLES[path]}</a></p>
              )}
            </section>
          );
        }),
      )}
    </>
  );
}
