// Friends (edges only; the list itself stays on the client) and the optional feedback survey.
import type { FastifyInstance } from "fastify";
import { pool } from "../db.ts";
import { FriendOp, Feedback } from "../schemas.ts";

export default async function social(app: FastifyInstance) {
  app.post("/v1/friends", async (req, reply) => {
    const parsed = FriendOp.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues.slice(0, 5) });
    const f = parsed.data;
    const args = [f.installId, f.server, f.characterId];
    if (f.action === "add")
      await pool.query(
        `INSERT INTO friends (install_id, server, character_id) VALUES ($1,$2,$3)
         ON CONFLICT (install_id, server, character_id) DO UPDATE SET added_at = now(), removed_at = NULL`,
        args,
      );
    else
      await pool.query(
        `UPDATE friends SET removed_at = now() WHERE install_id = $1 AND server = $2 AND character_id = $3`,
        args,
      );
    return { ok: true };
  });

  app.post("/v1/feedback", async (req, reply) => {
    const parsed = Feedback.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues.slice(0, 5) });
    const f = parsed.data;
    await pool.query(
      `INSERT INTO feedback (install_id, kind, reasons, rating, comment, app_version) VALUES ($1,$2,$3,$4,$5,$6)`,
      [f.installId, f.kind, f.reasons, f.rating ?? null, f.comment?.trim() || null, f.appVersion ?? null],
    );
    return { ok: true };
  });
}
