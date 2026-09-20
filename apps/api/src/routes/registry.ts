// The registry and map share the same active, explicitly visible characters.
import type { FastifyInstance } from "fastify";
import { playersOn } from "../presence.ts";
import { SERVER_RE } from "../schemas.ts";

export default async function registry(app: FastifyInstance) {
  app.get<{ Querystring: { server?: string } }>("/v1/registry", async (req, reply) => {
    const server = req.query.server ?? "";
    if (!SERVER_RE.test(server)) return reply.code(400).send({ error: "server required" });
    return { server, characters: playersOn(server) };
  });
}
