// Delete my data, keyed by the install id - the only credential there is. It comes in the x-install-id header
// (or the body), not the query string, so it stays out of request logs.
//
// Whole-install erasure retains anonymous positions. Individual removal retracts that installation's
// character records and blocks delayed uploads until the user explicitly resumes sharing.
import type { FastifyInstance } from "fastify";
import { randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import { clearCaches } from "../cache.ts";
import { leaveInstall } from "../presence.ts";
import { characterDigest, withInstallLock } from "../installs.ts";
import { CharacterIdentity } from "../schemas.ts";

const installSchema = z.string().uuid();
const anonId = () => String(-randomInt(1, 2 ** 48 - 1)); // game ids are positive

export default async function me(app: FastifyInstance) {
  app.delete<{ Params: { server: string; characterId: string } }>(
    "/v1/me/characters/:server/:characterId",
    async (req, reply) => {
      const installId = String(req.headers["x-install-id"] ?? "");
      const parsed = CharacterIdentity.safeParse(req.params);
      if (!installSchema.safeParse(installId).success || !parsed.success)
        return reply.code(400).send({ error: "installation and character required" });
      const { server, characterId } = parsed.data;
      return withInstallLock(
        installId,
        async (client, { digest, erased }) => {
          if (erased) return reply.code(410).send({ error: "installation erased" });
          const character = characterDigest(server, characterId);
          try {
            await client.query("BEGIN");
            await client.query(
              "INSERT INTO removed_characters (install_digest, character_digest) VALUES ($1, $2) ON CONFLICT DO NOTHING",
              [digest, character],
            );
            const args = [installId, server, characterId];
            const pings = await client.query(
              "DELETE FROM pings WHERE install_id = $1 AND server = $2 AND character_id = $3",
              args,
            );
            const sightings = await client.query(
              "DELETE FROM sightings WHERE install_id = $1 AND server = $2 AND (character_id = $3 OR seen_by = $3)",
              args,
            );
            const characters = await client.query(
              "DELETE FROM characters WHERE install_id = $1 AND server = $2 AND id = $3",
              args,
            );
            await client.query(
              "UPDATE characters SET claimed_by = NULL WHERE claimed_by = $1 AND server = $2 AND id = $3",
              args,
            );
            await client.query("DELETE FROM friends WHERE install_id = $1 AND server = $2 AND character_id = $3", args);
            await client.query("COMMIT");
            leaveInstall(installId, `${server}:${characterId}`);
            clearCaches();
            return { ok: true, characters: characters.rowCount, pings: pings.rowCount, sightings: sightings.rowCount };
          } catch (error) {
            await client.query("ROLLBACK");
            throw error;
          }
        },
        [parsed.data],
      );
    },
  );

  app.post<{ Params: { server: string; characterId: string } }>(
    "/v1/me/characters/:server/:characterId/restore",
    async (req, reply) => {
      const installId = String(req.headers["x-install-id"] ?? "");
      const parsed = CharacterIdentity.safeParse(req.params);
      if (!installSchema.safeParse(installId).success || !parsed.success)
        return reply.code(400).send({ error: "installation and character required" });
      return withInstallLock(
        installId,
        async (client, { digest, erased }) => {
          if (erased) return reply.code(410).send({ error: "installation erased" });
          await client.query("DELETE FROM removed_characters WHERE install_digest = $1 AND character_digest = $2", [
            digest,
            characterDigest(parsed.data.server, parsed.data.characterId),
          ]);
          return { ok: true };
        },
        [parsed.data],
      );
    },
  );

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
        await client.query("DELETE FROM removed_characters WHERE install_digest = $1", [digest]);
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
