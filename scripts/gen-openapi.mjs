// Generates public/openapi.json (Swagger/OpenAPI 3) from src/app/api/**/route.ts.
// Run: node scripts/gen-openapi.mjs
// ponytail: route list only (paths, methods, path/query params, permission). Bodies/responses
// are generic objects; add per-route zod → schema mapping if typed docs are ever needed.
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const apiDir = join(root, "src/app/api");
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

const walk = (d) =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : f === "route.ts" ? [p] : [];
  });

const paths = {};
for (const file of walk(apiDir).sort()) {
  const segs = relative(apiDir, file).split(sep).slice(0, -1);
  const pathParams = [];
  const urlSegs = segs
    .filter((s) => !/^\(.*\)$/.test(s)) // route groups don't appear in the URL
    .map((s) => {
      const m = s.match(/^\[(?:\.\.\.)?(\w+)\]$/) || s.match(/^\[\[\.\.\.(\w+)\]\]$/);
      if (!m) return s;
      pathParams.push(m[1]);
      return `{${m[1]}}`;
    });
  const url = "/api/" + urlSegs.join("/");
  const src = readFileSync(file, "utf8");
  const tag = urlSegs[0] === "admin" || urlSegs[0] === "breeder" ? `${urlSegs[0]}/${urlSegs[1] ?? ""}` : urlSegs[0];

  // Split source into per-handler chunks so query params/permissions attach to the right method.
  const handlers = [...src.matchAll(/^export (?:async function|const) (GET|POST|PUT|PATCH|DELETE)\b/gm)];
  const reexport = src.match(/^export const \{([^}]+)\}/m);
  const methods = handlers.length
    ? handlers.map((h, i) => ({ m: h[1], body: src.slice(h.index, handlers[i + 1]?.index) }))
    : (reexport?.[1].split(",").map((s) => s.trim()).filter((m) => METHODS.includes(m)) ?? []).map((m) => ({ m, body: src }));

  paths[url] = {};
  for (const { m, body } of methods) {
    const query = [...new Set([...body.matchAll(/searchParams\.get\(\s*["'`](\w+)["'`]/g)].map((x) => x[1]))];
    const perms = [...new Set([...body.matchAll(/requirePermission\(\s*["'`]([\w.]+)["'`]/g)].map((x) => x[1]))];
    const op = {
      tags: [tag],
      summary: `${m} ${url}`,
      ...(perms.length && { description: `Permission: ${perms.join(", ")}` }),
      parameters: [
        ...pathParams.map((name) => ({ name, in: "path", required: true, schema: { type: "string" } })),
        ...query.map((name) => ({ name, in: "query", schema: { type: "string" } })),
      ],
      responses: { 200: { description: "OK" }, 401: { description: "Unauthorized" } },
    };
    if (["POST", "PUT", "PATCH"].includes(m) && /request\.json\(\)|req\.json\(\)/.test(body))
      op.requestBody = { content: { "application/json": { schema: { type: "object" } } } };
    paths[url][m.toLowerCase()] = op;
  }
}

const spec = {
  openapi: "3.0.3",
  info: { title: "Pigeon Pulse API", version: "1.0.0", description: "Auto-generated route list (scripts/gen-openapi.mjs)." },
  // Vercel = production until AWS cutover; then swap AWS to https domain and put it first.
  servers: [
    { url: "https://pigeon-pulse.vercel.app", description: "Vercel production" },
    { url: "http://52.35.79.242", description: "AWS (pre-cutover)" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", description: "Mobile: token from set-auth-token header" },
      cookieAuth: { type: "apiKey", in: "cookie", name: "better-auth.session_token" },
    },
  },
  security: [{ bearerAuth: [] }, { cookieAuth: [] }],
  paths,
};
writeFileSync(join(root, "public/openapi.json"), JSON.stringify(spec, null, 2) + "\n");
const ops = Object.values(paths).reduce((n, p) => n + Object.keys(p).length, 0);
console.log(`openapi.json: ${Object.keys(paths).length} paths, ${ops} operations`);
