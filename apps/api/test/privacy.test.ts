import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, test } from "node:test";
import Fastify from "fastify";
import { Client, Pool } from "pg";

if (!process.env.TEST_DATABASE_URL) throw new Error("Set TEST_DATABASE_URL to a local test PostgreSQL database.");
const databaseUrl = new URL(process.env.TEST_DATABASE_URL);
const schema = `hydian_test_${randomUUID().replaceAll("-", "")}`;
const admin = new Pool({ connectionString: databaseUrl.toString() });
databaseUrl.searchParams.set("options", `-c search_path=${schema}`);
process.env.DATABASE_URL = databaseUrl.toString();
process.env.PGSSLMODE = "disable";

const { pool, migrate } = await import("../src/db.ts");
const { clearCaches } = await import("../src/cache.ts");
const { playersOn, leave } = await import("../src/presence.ts");
const { default: pings } = await import("../src/routes/pings.ts");
const { default: registry } = await import("../src/routes/registry.ts");
const { default: me } = await import("../src/routes/me.ts");
const { default: social } = await import("../src/routes/social.ts");
const app = Fastify();
const installA = "00000000-0000-4000-8000-000000000001";
const installB = "00000000-0000-4000-8000-000000000002";
const server = "he4000";
const ping = (overrides = {}) => ({
  kind: "move",
  server,
  characterId: "123",
  characterName: "Test player",
  areaId: "456",
  areaName: "Test area",
  x: 100,
  y: 200,
  h: 300,
  class: "Jedi Knight",
  status: "ic",
  logTs: Date.now(),
  raw: "private raw log",
  ...overrides,
});
const send = (installId = installA, overrides = {}) =>
  app.inject({
    method: "POST",
    url: "/v1/pings",
    payload: { installId, pings: [ping()], ...overrides },
  });
const erase = (installId = installA) =>
  app.inject({ method: "DELETE", url: "/v1/me", headers: { "x-install-id": installId } });
const getRegistry = () => app.inject({ method: "GET", url: `/v1/registry?server=${server}` });
const gate = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

before(async () => {
  await admin.query(`CREATE SCHEMA ${schema}`);
  await migrate();
  for (const route of [pings, registry, me, social]) await app.register(route);
  await app.ready();
});
beforeEach(async () => {
  await pool.query(
    "TRUNCATE pings, sightings, characters, installs, friends, feedback, erased_installs RESTART IDENTITY",
  );
  clearCaches();
  for (const player of playersOn()) leave(player.key);
});
after(async () => {
  await app.close();
  await pool.end();
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
});

test("Invisible removes identity and cached coordinates from the public registry", async () => {
  assert.equal((await send()).statusCode, 200);
  assert.equal((await getRegistry()).json().characters[0].x, 100);
  assert.equal((await send(installA, { pings: [ping({ status: "invisible" })] })).statusCode, 200);
  assert.deepEqual((await getRegistry()).json().characters, []);
  assert.deepEqual(playersOn(server), []);
});

test("same-batch final visibility wins when received timestamps tie", async () => {
  assert.equal((await send(installA, { pings: [ping(), ping({ status: "invisible" })] })).statusCode, 200);
  assert.deepEqual((await getRegistry()).json().characters, []);
});

test("deletion removes submitted identities and original install links while retaining anonymous positions", async () => {
  assert.equal(
    (
      await send(installA, {
        sightings: [
          {
            server,
            seenBy: "123",
            characterId: "789",
            characterName: "Nearby player",
            areaId: "456",
            x: 100,
            y: 200,
            raw: "nearby raw log",
          },
        ],
      })
    ).statusCode,
    200,
  );
  await app.inject({
    method: "POST",
    url: "/v1/friends",
    payload: { installId: installA, server, characterId: "789", action: "add" },
  });
  await app.inject({
    method: "POST",
    url: "/v1/feedback",
    payload: { installId: installA, kind: "offboarding", comment: "Testing" },
  });
  assert.equal((await getRegistry()).json().characters.length, 1);
  const result = await erase();
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.json(), { ok: true, characters: 1, pings: 1, sightings: 1 });
  for (const table of ["pings", "sightings"]) {
    const rows = (await pool.query(`SELECT * FROM ${table}`)).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].character_name, "deleted");
    assert.ok(BigInt(rows[0].character_id) < 0);
    assert.notEqual(rows[0].install_id, installA);
    assert.equal(rows[0].raw, null);
    assert.equal(rows[0].x, 100);
  }
  assert.equal((await pool.query("SELECT seen_by FROM sightings")).rows[0].seen_by, "0");
  for (const table of ["characters", "installs", "friends"])
    assert.equal((await pool.query(`SELECT * FROM ${table}`)).rowCount, 0);
  assert.equal((await pool.query("SELECT install_id FROM feedback")).rows[0].install_id, null);
  assert.deepEqual((await getRegistry()).json().characters, []);
  assert.deepEqual(playersOn(server), []);
  assert.equal((await erase()).statusCode, 200);
});

test("deleting a previous owner's data preserves the current owner's registry and presence", async () => {
  await send();
  await pool.query("UPDATE characters SET last_seen = now() - interval '2 days'");
  assert.equal((await send(installB, { pings: [ping({ characterName: "Current owner" })] })).json().stored, 1);
  assert.equal((await erase()).statusCode, 200);
  assert.equal(playersOn(server)[0].name, "Current owner");
  assert.equal((await getRegistry()).json().characters[0].name, "Current owner");
  assert.equal((await pool.query("SELECT claimed_by FROM characters")).rows[0].claimed_by, null);
});

test("concurrent first claims accept exactly one install", async () => {
  await pool.query(`CREATE FUNCTION slow_claim() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN PERFORM pg_sleep(0.1); RETURN NEW; END $$;
    CREATE TRIGGER slow_claim BEFORE INSERT ON characters FOR EACH ROW EXECUTE FUNCTION slow_claim()`);
  try {
    const results = await Promise.all([send(installA), send(installB)]);
    assert.deepEqual(
      results.map((r) => r.statusCode),
      [200, 200],
    );
    assert.deepEqual(results.map((r) => r.json().stored).sort(), [0, 1]);
    assert.equal(results.flatMap((r) => r.json().conflicts).length, 1);
    assert.equal((await pool.query("SELECT * FROM pings")).rowCount, 1);
    const owner = (await pool.query("SELECT install_id FROM characters")).rows[0].install_id;
    assert.equal((await pool.query("SELECT install_id FROM pings")).rows[0].install_id, owner);
  } finally {
    await pool.query("DROP TRIGGER slow_claim ON characters; DROP FUNCTION slow_claim()");
  }
});

test("failed deletion rolls back database and leaves live presence intact", async () => {
  await send();
  await pool.query(`CREATE FUNCTION fail_delete() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'test failure'; END $$;
    CREATE TRIGGER fail_delete BEFORE DELETE ON installs FOR EACH ROW EXECUTE FUNCTION fail_delete()`);
  try {
    assert.equal((await erase()).statusCode, 500);
    assert.equal(playersOn(server)[0].name, "Test player");
    assert.equal((await pool.query("SELECT character_name FROM pings")).rows[0].character_name, "Test player");
  } finally {
    await pool.query("DROP TRIGGER fail_delete ON installs; DROP FUNCTION fail_delete()");
  }
});

test("malformed UUID is rejected before querying PostgreSQL", async () => {
  assert.equal((await erase("------------------------------------")).statusCode, 400);
});

test("erasure permanently rejects delayed writes while allowing a new install and repeated deletion", async () => {
  await send();
  await erase();
  for (const url of ["/v1/pings", "/v1/friends", "/v1/feedback"]) {
    const payload =
      url === "/v1/pings"
        ? { pings: [ping()] }
        : url === "/v1/friends"
          ? { server, characterId: "123", action: "add" }
          : { kind: "general", comment: "Late request" };
    assert.equal(
      (await app.inject({ method: "POST", url, payload: { installId: installA, ...payload } })).statusCode,
      410,
    );
  }
  assert.equal((await erase()).statusCode, 200);
  assert.equal((await send(installB)).statusCode, 200);
  assert.equal((await pool.query("SELECT count(*) FROM erased_installs")).rows[0].count, "1");
});

test("UUID letter case cannot bypass erasure", async () => {
  const mixedInstall = "aabbccdd-aabb-4000-8000-000000000001";
  await send(mixedInstall);
  await erase(mixedInstall.toUpperCase());
  assert.deepEqual(playersOn(server), []);
  assert.equal((await send(mixedInstall)).statusCode, 410);
  const uppercaseInstall = "BBCCDDEE-AABB-4000-8000-000000000002";
  await send(uppercaseInstall);
  await erase(uppercaseInstall.toLowerCase());
  assert.deepEqual(playersOn(server), []);
});

test("a write waiting behind erasure cannot restore the installation", async () => {
  await send();
  const blocker = await pool.connect();
  try {
    await blocker.query("BEGIN");
    await blocker.query("SELECT id FROM installs WHERE id = $1 FOR UPDATE", [installA]);
    const deletion = erase();
    // Wait for DELETE to own the install advisory lock and block on its final installs row deletion.
    const deadline = Date.now() + 5000;
    while (true) {
      const waiting = await pool.query(`SELECT 1 FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE 'DELETE FROM installs%'`);
      if (waiting.rowCount) break;
      assert.ok(Date.now() < deadline, "DELETE did not reach the blocked row");
      await new Promise((resolve) => setImmediate(resolve));
    }
    const delayedUpload = send();
    await blocker.query("COMMIT");
    assert.equal((await deletion).statusCode, 200);
    assert.equal((await delayedUpload).statusCode, 410);
    assert.equal((await pool.query("SELECT * FROM installs")).rowCount, 0);
    assert.deepEqual(playersOn(server), []);
  } finally {
    await blocker.query("ROLLBACK");
    blocker.release();
  }
});

test("deletion waits for committed uploads to update presence before removing it", async (t) => {
  const committed = gate();
  const resume = gate();
  const writing = new WeakSet<object>();
  const query = Client.prototype.query;
  let commitDelivered = false;
  let deletingBackend = 0;
  t.mock.method(Client.prototype, "query", function (this: Client, ...args: unknown[]) {
    const sql = String(args[0]);
    if (sql.includes("INSERT INTO installs")) writing.add(this);
    if (sql.startsWith("SELECT pg_advisory_lock") && commitDelivered) deletingBackend = Reflect.get(this, "processID");
    const result = Reflect.apply(query, this, args);
    if (sql === "COMMIT" && writing.has(this)) {
      writing.delete(this);
      return result.then(async (value: unknown) => {
        commitDelivered = true;
        committed.resolve();
        await resume.promise;
        return value;
      });
    }
    return result;
  } as typeof query);
  const upload = send();
  await committed.promise;
  let deletionSettled = false;
  const deletion = erase().then((result) => {
    deletionSettled = true;
    return result;
  });
  try {
    const deadline = Date.now() + 5000;
    while (true) {
      assert.equal(deletionSettled, false, "DELETE must wait for the upload's public-presence update");
      const waiting = await pool.query("SELECT 1 FROM pg_stat_activity WHERE pid = $1 AND wait_event_type = 'Lock'", [
        deletingBackend,
      ]);
      if (waiting.rowCount) break;
      assert.ok(Date.now() < deadline, "DELETE did not wait for the installation lock");
      await new Promise((resolve) => setImmediate(resolve));
    }
  } finally {
    resume.resolve();
    await Promise.all([upload, deletion]);
  }
  assert.equal((await upload).statusCode, 200);
  assert.equal((await deletion).statusCode, 200);
  assert.deepEqual(playersOn(server), []);
  assert.equal((await pool.query("SELECT * FROM pings WHERE character_name <> 'deleted'")).rowCount, 0);
});

test("a registry read started before deletion cannot restore the deleted profile in cache", async (t) => {
  await send();
  clearCaches();
  const selected = gate();
  const resume = gate();
  const query = pool.query;
  let intercept = true;
  t.mock.method(pool, "query", function (this: Pool, ...args: unknown[]) {
    const result = Reflect.apply(query, this, args);
    if (intercept && String(args[0]).includes("SELECT c.id::text")) {
      intercept = false;
      return result.then(async (value: unknown) => {
        selected.resolve();
        await resume.promise;
        return value;
      });
    }
    return result;
  } as typeof query);
  const earlierRead = getRegistry();
  await selected.promise;
  try {
    assert.equal((await erase()).statusCode, 200);
  } finally {
    resume.resolve();
    await earlierRead;
  }
  assert.equal((await earlierRead).json().characters.length, 1, "the earlier request observed the old snapshot");
  assert.deepEqual((await getRegistry()).json().characters, []);
});

test("a failed advisory unlock discards its connection instead of returning a held lock to the pool", async (t) => {
  const { withInstallLock } = await import("../src/installs.ts");
  const query = Client.prototype.query;
  let discardPid = 0;
  t.mock.method(Client.prototype, "query", function (this: Client, ...args: unknown[]) {
    if (String(args[0]).startsWith("SELECT pg_advisory_unlock")) {
      discardPid = Reflect.get(this, "processID");
      return Promise.reject(new Error("synthetic unlock failure"));
    }
    return Reflect.apply(query, this, args);
  } as typeof query);
  await withInstallLock(installA, async () => "committed");
  assert.ok(discardPid);
  const next = await pool.connect();
  try {
    assert.notEqual((await next.query("SELECT pg_backend_pid() AS pid")).rows[0].pid, discardPid);
    assert.equal(
      (await next.query("SELECT 1 FROM pg_locks WHERE pid = $1 AND locktype = 'advisory'", [discardPid])).rowCount,
      0,
    );
  } finally {
    next.release();
  }
});

test("a delayed takeover cannot restore presence after the original owner changes to Invisible", async (t) => {
  await send(installA);
  await pool.query("UPDATE characters SET last_seen = now() - interval '2 days'");
  const committed = gate();
  const resume = gate();
  const takingOver = new WeakSet<object>();
  const query = Client.prototype.query;
  let takeoverCommitted = false;
  let reclaimBackend = 0;
  t.mock.method(Client.prototype, "query", function (this: Client, ...args: unknown[]) {
    const sql = String(args[0]);
    if (sql.includes("INSERT INTO installs") && Array.isArray(args[1]) && args[1][0] === installB) takingOver.add(this);
    if (sql.startsWith("SELECT pg_advisory_lock") && takeoverCommitted) reclaimBackend = Reflect.get(this, "processID");
    const result = Reflect.apply(query, this, args);
    if (sql === "COMMIT" && takingOver.has(this)) {
      takingOver.delete(this);
      return result.then(async (value: unknown) => {
        takeoverCommitted = true;
        committed.resolve();
        await resume.promise;
        return value;
      });
    }
    return result;
  } as typeof query);
  const takeover = send(installB);
  await committed.promise;
  let reclaimSettled = false;
  const reclaim = send(installA, { pings: [ping({ status: "invisible" })] }).then((result) => {
    reclaimSettled = true;
    return result;
  });
  try {
    const deadline = Date.now() + 5000;
    while (true) {
      assert.equal(reclaimSettled, false, "the character's earlier public update must finish first");
      const waiting = await pool.query("SELECT 1 FROM pg_stat_activity WHERE pid = $1 AND wait_event_type = 'Lock'", [
        reclaimBackend,
      ]);
      if (waiting.rowCount) break;
      assert.ok(Date.now() < deadline, "the reclaim did not wait for the character lock");
      await new Promise((resolve) => setImmediate(resolve));
    }
  } finally {
    resume.resolve();
    await Promise.all([takeover, reclaim]);
  }
  assert.equal((await takeover).statusCode, 200);
  assert.equal((await reclaim).statusCode, 200);
  assert.deepEqual(playersOn(server), []);
  assert.deepEqual((await getRegistry()).json().characters, []);
});

test("oppositely ordered character batches acquire their locks without a deadlock", async () => {
  const results = await Promise.all([
    send(installA, { pings: [ping({ characterId: "123" }), ping({ characterId: "124" })] }),
    send(installB, { pings: [ping({ characterId: "124" }), ping({ characterId: "123" })] }),
  ]);
  assert.deepEqual(
    results.map((r) => r.statusCode),
    [200, 200],
  );
  assert.deepEqual(results.map((r) => r.json().stored).sort(), [0, 2]);
  assert.equal((await pool.query("SELECT * FROM pings")).rowCount, 2);
});
