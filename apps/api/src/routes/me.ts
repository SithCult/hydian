// Delete my data, keyed by the install id - the only credential there is. It comes in the x-install-id header
// (or the body), not the query string, so it stays out of request logs.
//
// Anonymise rather than drop: every row this install ever sent keeps its place and time (so heat maps and
// activity statistics stay honest) but loses the character: id re-keyed to a random one per character,
// name/raw line/class wiped. Characters, friends and live presence are removed outright. Not reversible.
import type { FastifyInstance } from "fastify";
import { randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import { clearCaches } from "../cache.ts";
import { leaveInstall } from "../presence.ts";
import { withInstallLock } from "../installs.ts";

const installSchema = z.string().uuid();
const anonId = () => String(-randomInt(1, 2 ** 48 - 1)); // game ids are positive

export default async function me(app: FastifyInstance) {
  app.delete<{ Body?: { installId?: string } }>("/v1/me", async (req, reply) => {
    const installId = String(req.headers["x-install-id"] ?? req.body?.installId ?? "");
    if (!installSchema.safeParse(installId).success) return reply.code(400).send({ error: "installId required" });
    return withInstallLock(installId, async (client, { digest }) => {
      try {
        await client.query("BEGIN");
        await client.query("INSERT INTO erased_installs (digest) VALUES ($1) ON CONFLICT DO NOTHING", [digest]);
        const identities = await client.query(
          `SELECT server, character_id FROM pings WHERE install_id = $1
         UNION SELECT server, character_id FROM sightings WHERE install_id = $1`,
          [installId],
        );
        const anonymousInstall = randomUUID();
        let pings = 0;
        let sightings = 0;
        for (const c of identities.rows) {
          const anonymousCharacter = anonId();
          const args = [installId, c.server, anonymousCharacter, c.character_id, anonymousInstall];
          const p = await client.query(
            `UPDATE pings SET character_id = $3, character_name = 'deleted', class = NULL, discipline = NULL,
             raw = NULL, install_id = $5
           WHERE install_id = $1 AND server = $2 AND character_id = $4`,
            args,
          );
          pings += p.rowCount ?? 0;
          const s = await client.query(
            `UPDATE sightings SET character_id = $3, character_name = 'deleted', seen_by = 0, raw = NULL, install_id = $5
           WHERE install_id = $1 AND server = $2 AND character_id = $4`,
            args,
          );
          sightings += s.rowCount ?? 0;
        }
        const chars = await client.query(`DELETE FROM characters WHERE install_id = $1`, [installId]);
        await client.query(`UPDATE characters SET claimed_by = NULL WHERE claimed_by = $1`, [installId]);
        await client.query(`DELETE FROM friends WHERE install_id = $1`, [installId]);
        await client.query(`UPDATE feedback SET install_id = NULL WHERE install_id = $1`, [installId]);
        await client.query(`DELETE FROM installs WHERE id = $1`, [installId]);
        await client.query("COMMIT");
        leaveInstall(installId);
        clearCaches();
        return { ok: true, characters: chars.rowCount, pings, sightings };
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      }
    });
  });
}
