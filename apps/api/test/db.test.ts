import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

test("public database connections verify certificates even when credentials contain localhost", async () => {
  const previousUrl = process.env.DATABASE_URL;
  const previousMode = process.env.PGSSLMODE;
  try {
    delete process.env.PGSSLMODE;
    for (const databaseUrl of [
      "postgresql://test:password@db.example.com/hydian",
      "postgresql://localhost:password@db.example.com/hydian",
      "postgresql://test:password@notlocalhost.example.com/hydian",
      "postgresql://test:password@db.railway.internal.example.com/hydian",
    ]) {
      process.env.DATABASE_URL = databaseUrl;
      const { pool } = await import(`../src/db.ts?case=${randomUUID()}`);
      assert.deepEqual(pool.options.ssl, { rejectUnauthorized: true });
      await pool.end();
    }
    for (const hostname of ["localhost", "127.0.0.1", "[::1]", "postgres.railway.internal"]) {
      process.env.DATABASE_URL = `postgresql://test:password@${hostname}/hydian`;
      const { pool } = await import(`../src/db.ts?case=${randomUUID()}`);
      assert.equal(pool.options.ssl, undefined);
      await pool.end();
    }
    process.env.DATABASE_URL = "postgresql://test:password@db.example.com/hydian";
    process.env.PGSSLMODE = "disable";
    const { pool } = await import(`../src/db.ts?case=${randomUUID()}`);
    assert.equal(pool.options.ssl, undefined);
    await pool.end();
  } finally {
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    if (previousMode === undefined) delete process.env.PGSSLMODE;
    else process.env.PGSSLMODE = previousMode;
  }
});
