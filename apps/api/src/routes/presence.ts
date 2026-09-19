// Who is on the map right now: one-shot snapshot and the live socket.
import type { FastifyInstance } from "fastify";
import { join, playersOn } from "../presence.ts";
import { SERVER_RE } from "../schemas.ts";

export default async function presence(app: FastifyInstance) {
  app.get<{ Querystring: { server?: string } }>("/v1/presence", async (req, reply) => {
    const server = req.query.server ?? "";
    if (!SERVER_RE.test(server)) return reply.code(400).send({ error: "server required" });
    return { players: playersOn(server) };
  });

  app.get<{ Querystring: { server?: string } }>("/v1/live", { websocket: true }, (socket, req) => {
    const server = req.query.server ?? "";
    if (!SERVER_RE.test(server)) return socket.close(1008, "server required");
    join(server, socket);
  });
}
