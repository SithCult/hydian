// Ingest: everything the client sends lands here, in one transaction, then updates live presence.
//
// A character belongs to the install currently sharing it. Nothing stops a modified client from sending pings
// under someone else's character id (there are no accounts), so while the holding install is active, pings for
// that character from any other install are dropped and reported back as conflicts. The holder's silence for
// CLAIM_TIMEOUT hands the character over (a reinstall, a second computer), and the install that shared the
// character first can always take it back at once.
import type { FastifyInstance } from "fastify";
import { pool } from "../db.ts";
import { Batch, type Ping } from "../schemas.ts";
import { applyBatch } from "../presence.ts";

const CLAIM_TIMEOUT = "24 hours";
const LIVE_MAX = { pings: 200, sightings: 500 }; // a live batch; history batches keep the schema's caps

export default async function pings(app: FastifyInstance) {
  app.post("/v1/pings", async (req, reply) => {
    const parsed = Batch.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues.slice(0, 5) });
    const b = parsed.data;
    if (!b.historical && (b.pings.length > LIVE_MAX.pings || b.sightings.length > LIVE_MAX.sightings))
      return reply.code(413).send({ error: "batch too large" });
    const accepted: Ping[] = [];
    const conflicts = new Set<string>();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO installs (id, app_version) VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET last_seen = now(), app_version = COALESCE(EXCLUDED.app_version, installs.app_version)`,
        [b.installId, b.appVersion ?? null],
      );
      for (const p of b.pings) {
        const historical = b.historical || p.kind === "history";
        // whose character is this? (a row locked for the transaction, so two batches cannot both claim it)
        const owner = await client.query(
          `SELECT install_id, claimed_by, last_seen > now() - $3::interval AS active
           FROM characters WHERE server = $1 AND id = $2 FOR UPDATE`,
          [p.server, p.characterId, CLAIM_TIMEOUT],
        );
        const o = owner.rows[0];
        const mine = !o || o.install_id === b.installId || o.claimed_by === b.installId || !o.install_id;
        if (!mine && o.active) {
          conflicts.add(p.characterId);
          continue;
        }
        await client.query(
          `INSERT INTO pings (install_id, app_version, kind, server, character_id, character_name, class, discipline, area_id, area_name, area_mode,
                              x, y, h, heading, hp, hp_max, status, lfrp, log_ts, raw, instance)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,to_timestamp($20::double precision / 1000.0),$21,$22)`,
          [
            b.installId,
            b.appVersion ?? null,
            p.kind,
            p.server,
            p.characterId,
            p.characterName,
            p.class ?? null,
            p.discipline ?? null,
            p.areaId ?? null,
            p.areaName ?? null,
            p.areaMode ?? null,
            p.x ?? null,
            p.y ?? null,
            p.h ?? null,
            p.heading ?? null,
            p.hp ?? null,
            p.hpMax ?? null,
            p.status,
            p.lfrp,
            p.logTs ?? null,
            p.raw ?? null,
            p.instance ?? null,
          ],
        );
        // history never overwrites a live name or bumps last_seen: old logs may carry a name since changed
        await client.query(
          `INSERT INTO characters (server, id, name, class, discipline, install_id, claimed_by) VALUES ($1,$2,$3,$4,$5,$6,$6)
           ON CONFLICT (server, id) DO UPDATE SET name = CASE WHEN $7 THEN characters.name ELSE EXCLUDED.name END,
             class = COALESCE(EXCLUDED.class, characters.class), discipline = COALESCE(EXCLUDED.discipline, characters.discipline),
             last_seen = CASE WHEN $7 THEN characters.last_seen ELSE now() END, install_id = EXCLUDED.install_id,
             claimed_by = COALESCE(characters.claimed_by, EXCLUDED.claimed_by)`,
          [p.server, p.characterId, p.characterName, p.class ?? null, p.discipline ?? null, b.installId, historical],
        );
        accepted.push(p);
      }
      for (const s of b.sightings) {
        await client.query(
          `INSERT INTO sightings (install_id, server, seen_by, character_id, character_name, area_id, x, y, h, log_ts, raw)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,to_timestamp($10::double precision / 1000.0),$11)`,
          [
            b.installId,
            s.server,
            s.seenBy,
            s.characterId,
            s.characterName,
            s.areaId ?? null,
            s.x ?? null,
            s.y ?? null,
            s.h ?? null,
            s.logTs ?? null,
            s.raw ?? null,
          ],
        );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    applyBatch({ ...b, pings: accepted });
    return { ok: true, stored: accepted.length + b.sightings.length, conflicts: [...conflicts] };
  });
}
