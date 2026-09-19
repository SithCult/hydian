// Everyone who ever shared a character here: one row per character an install reported as its own, with the
// last live ping. Coordinates are only included while the character is still on the map (< STALE_MS); an
// offline character shows its last planet only.
import type { FastifyInstance } from "fastify";
import { pool } from "../db.ts";
import { TtlCache } from "../cache.ts";
import { STALE_MS } from "../presence.ts";
import { SERVER_RE } from "../schemas.ts";
import { factionOf } from "../faction.ts";

export default async function registry(app: FastifyInstance) {
  const cache = new TtlCache<unknown>(60_000);
  app.get<{ Querystring: { server?: string } }>("/v1/registry", async (req, reply) => {
    const server = req.query.server ?? "";
    if (!SERVER_RE.test(server)) return reply.code(400).send({ error: "server required" });
    const hit = cache.get(server);
    if (hit) return hit;
    const r = await pool.query(
      `SELECT c.id::text AS id, c.name, c.class, p.area_id::text AS area_id, p.area_name, p.status, p.lfrp, p.instance, p.x, p.y, p.h,
              (extract(epoch FROM COALESCE(p.log_ts, p.received_at, h.last)) * 1000)::bigint AS last_active
       FROM characters c
       LEFT JOIN LATERAL (
         SELECT area_id, area_name, status, lfrp, instance, x, y, h, log_ts, received_at FROM pings
         WHERE server = c.server AND character_id = c.id AND install_id = c.install_id AND kind <> 'history' AND status IS NOT NULL
         ORDER BY received_at DESC LIMIT 1) p ON true
       LEFT JOIN LATERAL (
         SELECT max(log_ts) AS last FROM pings WHERE server = c.server AND character_id = c.id AND kind = 'history') h ON true
       WHERE c.server = $1 AND c.install_id IS NOT NULL
       ORDER BY last_active DESC NULLS LAST LIMIT 2000`,
      [server],
    );
    const cut = Date.now() - STALE_MS;
    const characters = r.rows.map((x) => {
      const last = x.last_active ? Number(x.last_active) : 0;
      const onMap = x.status && x.status !== "invisible" && last > cut;
      return {
        key: `${server}:${x.id}`,
        server,
        characterId: x.id,
        name: x.name,
        faction: factionOf(x.class),
        areaId: x.area_id,
        areaName: x.area_name,
        status: onMap ? x.status : null,
        lfrp: onMap ? !!x.lfrp : false,
        instance: onMap ? (x.instance ?? null) : null,
        x: onMap ? x.x : null,
        y: onMap ? x.y : null,
        h: onMap ? x.h : null,
        lastActive: last,
      };
    });
    return cache.set(server, { server, characters });
  });
}
