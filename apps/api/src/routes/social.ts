// Friends (edges only; the list itself stays on the client) and the optional feedback survey.
import type { FastifyInstance } from "fastify";
import { FriendOp, Feedback } from "../schemas.ts";
import { characterDigest, withInstallLock } from "../installs.ts";

async function write(
  installId: string,
  sql: string,
  args: unknown[],
  character?: { server: string; characterId: string },
) {
  return withInstallLock(installId, async (client, { digest, erased }) => {
    if (erased) return false;
    if (character) {
      const removed = await client.query(
        "SELECT 1 FROM removed_characters WHERE install_digest = $1 AND character_digest = $2",
        [digest, characterDigest(character.server, character.characterId)],
      );
      if (removed.rowCount) return true;
    }
    try {
      await client.query("BEGIN");
      await client.query(sql, args);
      await client.query("COMMIT");
      return true;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  });
}

export default async function social(app: FastifyInstance) {
  app.post("/v1/friends", async (req, reply) => {
    const parsed = FriendOp.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues.slice(0, 5) });
    const f = parsed.data;
    const args = [f.installId, f.server, f.characterId];
    const sql =
      f.action === "add"
        ? `INSERT INTO friends (install_id, server, character_id) VALUES ($1,$2,$3)
         ON CONFLICT (install_id, server, character_id) DO UPDATE SET added_at = now(), removed_at = NULL`
        : `UPDATE friends SET removed_at = now() WHERE install_id = $1 AND server = $2 AND character_id = $3`;
    if (!(await write(f.installId, sql, args, f))) return reply.code(410).send({ error: "installation erased" });
    return { ok: true };
  });

  app.post("/v1/feedback", async (req, reply) => {
    const parsed = Feedback.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues.slice(0, 5) });
    const f = parsed.data;
    const stored = await write(
      f.installId,
      `INSERT INTO feedback (install_id, kind, reasons, rating, comment, app_version) VALUES ($1,$2,$3,$4,$5,$6)`,
      [f.installId, f.kind, f.reasons, f.rating ?? null, f.comment?.trim() || null, f.appVersion ?? null],
    );
    if (!stored) return reply.code(410).send({ error: "installation erased" });
    return { ok: true };
  });
}
