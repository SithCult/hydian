import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "./db.ts";

export const characterDigest = (server: string, characterId: string) =>
  createHash("sha256")
    .update(`${server}:${BigInt(characterId)}`)
    .digest("hex");

/** Keep database writes and their public-presence updates ordered with erasure. */
export async function withInstallLock<T>(
  installId: string,
  action: (client: PoolClient, state: { digest: string; erased: boolean }) => Promise<T>,
  characters: readonly { server: string; characterId: string }[] = [],
): Promise<T> {
  const digest = createHash("sha256").update(installId.toLowerCase()).digest("hex");
  const characterKeys = [...new Set(characters.map((p) => `character:${p.server}:${BigInt(p.characterId)}`))].sort();
  const keys = [digest, ...characterKeys];
  const client = await pool.connect();
  let acquired = false;
  try {
    // unnest follows array order: all batches acquire their distinct character locks in the same order.
    await client.query("SELECT pg_advisory_lock(hashtextextended(key, 0)) FROM unnest($1::text[]) AS keys(key)", [
      keys,
    ]);
    acquired = true;
    const result = await client.query("SELECT 1 FROM erased_installs WHERE digest = $1", [digest]);
    return await action(client, { digest, erased: !!result.rowCount });
  } finally {
    let discard = !acquired;
    if (acquired) {
      try {
        await client.query("SELECT pg_advisory_unlock(hashtextextended(key, 0)) FROM unnest($1::text[]) AS keys(key)", [
          keys.slice().reverse(),
        ]);
      } catch {
        // A pooled connection must never keep an installation's session lock.
        discard = true;
      }
    }
    client.release(discard);
  }
}
