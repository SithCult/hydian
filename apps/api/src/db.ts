import { readFileSync } from "node:fs";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
const hostname = databaseUrl ? new URL(databaseUrl).hostname : "localhost";
const privateHost = ["localhost", "127.0.0.1", "[::1]"].includes(hostname) || hostname.endsWith(".railway.internal");

export const pool = new Pool({
  connectionString: databaseUrl,
  max: 8,
  ssl: process.env.PGSSLMODE === "disable" || privateHost ? undefined : { rejectUnauthorized: true },
});

/** Creates tables (idempotent) and monthly partitions for this month and the next three. */
export async function migrate() {
  const sql = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
  await pool.query(sql);
  await ensurePartitions();
}

export async function ensurePartitions() {
  const now = new Date();
  for (let i = 0; i < 4; i++) {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i + 1, 1));
    const tag = `${from.getUTCFullYear()}_${String(from.getUTCMonth() + 1).padStart(2, "0")}`;
    for (const t of ["pings", "sightings"]) {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS ${t}_${tag} PARTITION OF ${t} FOR VALUES FROM ('${from.toISOString()}') TO ('${to.toISOString()}')`,
      );
    }
  }
}
