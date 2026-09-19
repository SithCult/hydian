// Hydian backend: raw ping ingest + live presence + anonymous statistics. One process, Fastify + Postgres.
import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import rateLimit from "@fastify/rate-limit";
import { pool, migrate, ensurePartitions } from "./db.ts";
import { onlineCount } from "./presence.ts";
import pings from "./routes/pings.ts";
import presence from "./routes/presence.ts";
import heat from "./routes/heat.ts";
import registry from "./routes/registry.ts";
import social from "./routes/social.ts";
import me from "./routes/me.ts";
import { ADMIN_KEY } from "./config.ts";

const PORT = Number(process.env.PORT ?? 8080);

// Browsers that may call the API: the website and the desktop app's webview. Other clients are not subject
// to CORS anyway; this only keeps random web pages from driving a visitor's browser against the API.
const ORIGINS = new Set([
  "https://hydian.org",
  "https://www.hydian.org",
  "tauri://localhost",
  "http://tauri.localhost",
  "https://tauri.localhost",
  ...(process.env.NODE_ENV === "production" ? [] : ["http://localhost:1420", "http://localhost:4321"]),
]);

const app = Fastify({
  logger: true,
  bodyLimit: 4 * 1024 * 1024,
  trustProxy: true, // behind Railway's edge: the client's address is in x-forwarded-for, which the rate limit keys on
});
await app.register(cors, { origin: (origin, cb) => cb(null, !origin || ORIGINS.has(origin)) });
await app.register(websocket);
// No auth exists (by design: no accounts), so this is the only brake on abuse. A client sends at most a
// handful of requests a minute; the backfill sends bigger, rarer batches. Reads are cached anyway.
await app.register(rateLimit, { max: 120, timeWindow: "1 minute", allowList: (req) => req.url === "/healthz" });

app.get("/healthz", async () => {
  await pool.query("select 1");
  return { ok: true };
});

// Operator numbers, not public ones: the site shows no counts, and a 404 keeps the route quiet.
app.get("/v1/stats", async (req, reply) => {
  if (!ADMIN_KEY || req.headers["x-admin-key"] !== ADMIN_KEY) return reply.code(404).send();
  const r = await pool.query(
    `SELECT (SELECT count(*) FROM pings) AS pings, (SELECT count(*) FROM sightings) AS sightings,
            (SELECT count(*) FROM characters) AS characters, (SELECT count(*) FROM installs) AS installs`,
  );
  return { ...r.rows[0], online: onlineCount() };
});

for (const routes of [pings, presence, heat, registry, social, me]) await app.register(routes);

await migrate();
setInterval(() => void ensurePartitions().catch((e) => console.error("partitions", e)), 6 * 3600_000);
await app.listen({ port: PORT, host: "0.0.0.0" });
