// Payload schemas (client -> server) and the shared query-string validators.
import { z } from "zod";

export const SERVER_RE = /^he\d{4}$/; // game server id, e.g. he4000
export const ID_RE = /^\d{1,20}$/; // character / area id as the log prints it

const server = z.string().regex(SERVER_RE);
const id = z
  .string()
  .regex(ID_RE)
  .refine((value) => ID_RE.test(value) && BigInt(value) <= 9223372036854775807n)
  .transform((value) => BigInt(value).toString());
export const CharacterIdentity = z.object({ server, characterId: id });
const num = z.number().nullable().optional();

export const Ping = z.object({
  kind: z.enum(["login", "area", "move", "status", "heartbeat", "history"]),
  server,
  characterId: id,
  characterName: z.string().min(1).max(64),
  class: z.string().max(40).nullable().optional(),
  discipline: z.string().max(40).nullable().optional(),
  areaId: id.nullable().optional(),
  areaName: z.string().max(120).nullable().optional(),
  areaMode: z.string().max(60).nullable().optional(),
  x: num,
  y: num,
  h: num,
  heading: num,
  hp: z.number().int().nullable().optional(),
  hpMax: z.number().int().nullable().optional(),
  status: z.enum(["ic", "ooc", "invisible"]).nullable().default(null), // null = history (no RP status known)
  lfrp: z.boolean().default(false),
  instance: z.number().int().min(1).max(20).nullable().optional(),
  logTs: z.number().nullable().optional(), // epoch ms of the log line
  raw: z.string().max(2000).nullable().optional(),
});
export type Ping = z.infer<typeof Ping>;

export const Sighting = z.object({
  server,
  seenBy: id,
  characterId: id,
  characterName: z.string().min(1).max(64),
  areaId: id.nullable().optional(),
  x: num,
  y: num,
  h: num,
  logTs: z.number().nullable().optional(),
  raw: z.string().max(2000).nullable().optional(),
});

export const Batch = z.object({
  installId: z.string().uuid(),
  appVersion: z.string().max(32).optional(),
  historical: z.boolean().default(false), // backfill from old logs: stored, never touches live presence
  pings: z.array(Ping).max(2000).default([]),
  sightings: z.array(Sighting).max(5000).default([]),
});
export type Batch = z.infer<typeof Batch>;

export const FriendOp = z.object({
  installId: z.string().uuid(),
  server,
  characterId: id,
  action: z.enum(["add", "remove"]),
});

export const Feedback = z.object({
  installId: z.string().uuid(),
  appVersion: z.string().max(32).optional(),
  kind: z.enum(["offboarding", "general"]),
  reasons: z.array(z.string().max(40)).max(10).default([]),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  comment: z.string().max(1000).nullable().optional(),
});

/** Trailing-window length in days from a query string, clamped to [1, 3650]. */
export const clampDays = (raw: string | undefined, fallback: number) =>
  Math.min(3650, Math.max(1, Number(raw ?? fallback) || fallback));
