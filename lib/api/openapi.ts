/** OpenAPI 3.1 description of the Portfolio Explorer API, served at /api/docs. */

const common = [
  { name: "assets", in: "query", schema: { type: "string", default: "SPX,XAU,SOL" }, description: "Comma-separated asset ids: SPX (S&P 500), XAU (gold), SOL (Solana)." },
  { name: "from", in: "query", schema: { type: "string", pattern: "^\\d{4}-\\d{2}$", example: "2023-08" }, description: "First month (inclusive)." },
  { name: "to", in: "query", schema: { type: "string", pattern: "^\\d{4}-\\d{2}$", example: "2026-08" }, description: "Last month (inclusive)." },
  { name: "method", in: "query", schema: { type: "string", enum: ["average", "close"], default: "average" }, description: "average = mean of the month's closes; close = last close of the month." },
  { name: "source", in: "query", schema: { type: "string", enum: ["live", "snapshot"], default: "live" }, description: "live = FRED/World Bank/Kraken (cached daily, falls back to snapshot); snapshot = the bundled IA data." },
  { name: "solInterval", in: "query", schema: { type: "string", enum: ["weekly", "daily"], default: "weekly" }, description: "Kraken candle size for Solana. Daily only reaches back ~720 days." },
];

const provenance = {
  type: "object",
  description: "Where every number came from.",
  properties: {
    source: { type: "string", enum: ["live", "snapshot"] },
    method: { type: "string" },
    months: { type: "object" },
    fallback: { type: "boolean", description: "true if any asset used cached or snapshot data because the live source failed" },
    warnings: { type: "array", items: { type: "string" } },
    assets: {
      type: "array",
      items: {
        type: "object",
        properties: {
          asset: { type: "string" },
          source: { type: "string" },
          url: { type: "string" },
          retrievedAt: { type: "string", format: "date-time" },
          method: { type: "string" },
          frequency: { type: "string" },
          datingRule: { type: "string" },
          observationsPerMonth: { type: "object", additionalProperties: { type: "integer" } },
          cache: { type: "string", enum: ["hit", "miss", "stale", "none"] },
          fallback: { type: "boolean" },
          warnings: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};

const ok = (description: string) => ({
  "200": { description, content: { "application/json": { schema: { type: "object", properties: { provenance: { $ref: "#/components/schemas/Provenance" } } } } } },
  "400": { description: "Invalid parameters" },
  "422": { description: "Valid parameters, but the maths has no answer (e.g. Σ not positive definite)" },
  "429": { description: "Rate limited (Retry-After header)" },
});

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Portfolio Explorer API",
    version: "1.0.0",
    description:
      "Real monthly data for the S&P 500, gold and Solana, and the Markowitz minimum-variance maths behind an IB Math AA HL IA. Every response carries a provenance block.",
  },
  paths: {
    "/api/prices": { get: { summary: "Monthly prices", parameters: common, responses: ok("Monthly prices per asset") } },
    "/api/returns": { get: { summary: "Monthly simple returns R = P_t/P_{t−1} − 1", parameters: common, responses: ok("Monthly returns") } },
    "/api/stats": {
      get: { summary: "Means, sample variances (n − 1), SDs, covariance & correlation matrices, geometric means, annualised figures", parameters: common, responses: ok("Statistics") },
    },
    "/api/optimize": {
      post: {
        summary: "Minimum-variance weights for a target monthly return (Lagrange multipliers)",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["targetReturn"],
                properties: {
                  assets: { type: "string", example: "SPX,XAU,SOL" },
                  from: { type: "string" },
                  to: { type: "string" },
                  method: { type: "string", enum: ["average", "close"] },
                  source: { type: "string", enum: ["live", "snapshot"] },
                  targetReturn: { type: "number", example: 0.02 },
                  amount: { type: "number", example: 1000 },
                  includeSteps: { type: "boolean", description: "include every Gauss–Jordan row operation" },
                },
              },
            },
          },
        },
        responses: ok("Σ, Σ⁻¹, det Σ, A, B, C, D, λ₁, λ₂, weights, dollars, variance, volatility and checks"),
      },
    },
    "/api/frontier": {
      get: {
        summary: "Efficient-frontier points, minimum-variance portfolio, asymptotes and no-short-selling range",
        parameters: [
          ...common,
          { name: "from_mu", in: "query", schema: { type: "number", default: 0.01 } },
          { name: "to_mu", in: "query", schema: { type: "number", default: 0.034 } },
          { name: "step", in: "query", schema: { type: "number", default: 0.001 } },
        ],
        responses: ok("Frontier"),
      },
    },
    "/api/explore/sensitivity": {
      get: {
        summary: "Recompute the minimum-variance portfolio after replacing one correlation (checks Σ stays positive definite)",
        parameters: [
          ...common,
          { name: "pair", in: "query", schema: { type: "string", default: "SPX,XAU" } },
          { name: "rho", in: "query", schema: { type: "string", default: "-0.5,0,0.5" } },
        ],
        responses: ok("One result per ρ; invalid ρ values carry an error message"),
      },
    },
    "/api/snapshot": { get: { summary: "The bundled IA dataset (works offline)", responses: ok("Snapshot") } },
    "/api/docs": { get: { summary: "This OpenAPI document", responses: { "200": { description: "OpenAPI JSON" } } } },
  },
  components: { schemas: { Provenance: provenance } },
};
