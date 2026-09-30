import { openApiSpec } from "@/lib/api/openapi";

/** GET /api/docs: OpenAPI 3.1 description of this API. */
export function GET(req: Request) {
  const origin = new URL(req.url).origin;
  return Response.json({ ...openApiSpec, servers: [{ url: origin }] });
}
