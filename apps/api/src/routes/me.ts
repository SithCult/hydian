// Delete my data, keyed by the install id - the only credential there is. It comes in the x-install-id header
// (or the body), not the query string, so it stays out of request logs.
//
// Anonymise rather than drop: every row this install ever sent keeps its place and time (so heat maps and
// activity statistics stay honest) but loses the character: id re-keyed to a random one per character,
// name/raw line/class wiped. Characters, friends and live presence are removed outright. Not reversible.
import type { FastifyInstance } from "fastify";
import { pool } from "../db.ts";
import { clearCaches } from "../cache.ts";
import { leave } from "../presence.ts";

const UUID_RE = /^[0-9a-f-]{36}$/i;
const anonId = () => String(900000000000000 + Math.floor(Math.random() * 99999999999999)); // outside the game's id range

export default async function me(app: FastifyInstance) {
  app.delete<{ Body?: { installId?: string } }>("/v1/me", async (req, reply) => {
    const installId = String(req.headers["x-install-id"] ?? req.body?.installId ?? "");
    if (!UUID_RE.test(installId)) return reply.code(400).send({ error: "installId required" });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const chars = await client.query(`SELECT DISTINCT server, character_id FROM pings WHERE install_id = $1`, [
        installId,
      ]);
      let pings = 0;
      for (const c of chars.rows) {
        const r = await client.query(
          `UPDATE pings SET character_id = $3, character_name = 'deleted', class = NULL, discipline = NULL, raw = NULL
           WHERE install_id = $1 AND server = $2 AND character_id = $4`,
          [installId, c.server, anonId(), c.character_id],
        );
        pings += r.rowCount ?? 0;
        await client.query(`DELETE FROM characters WHERE server = $1 AND id = $2 AND install_id = $3`, [
          c.server,
          c.character_id,
          installId,
        ]);
        leave(`${c.server}:${c.character_id}`);
      }
      const sg = await client.query(`UPDATE sightings SET seen_by = 0, raw = NULL WHERE install_id = $1`, [installId]);
      await client.query(`DELETE FROM friends WHERE install_id = $1`, [installId]);
      await client.query(`DELETE FROM installs WHERE id = $1`, [installId]);
      await client.query("COMMIT");
      clearCaches();
      return { ok: true, characters: chars.rowCount, pings, sightings: sg.rowCount ?? 0 };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  });
}
