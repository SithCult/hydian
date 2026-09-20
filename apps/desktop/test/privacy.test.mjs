import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const desktop = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(join(desktop, "package.json"));
const { build } = createRequire(require.resolve("vite"))("esbuild");
const output = await mkdtemp(join(tmpdir(), "hydian-privacy-"));
const bundle = join(output, "client.mjs");
await build({
  stdin: {
    contents:
      'export { Uplink } from "./src/core/uplink"; export { Backfill } from "./src/core/backfill"; export { useApp } from "./src/store"; export { selectRegistered, selectLive, selectCounts, selectPlayersOn } from "./src/selectors"; export { snapshot as overlaySnapshot } from "./src/core/overlay";',
    resolveDir: desktop,
  },
  bundle: true,
  outfile: bundle,
  platform: "node",
  format: "esm",
  define: { "import.meta.env": JSON.stringify({ DEV: false }), "process.env.NODE_ENV": '"production"' },
  plugins: [
    {
      name: "local-database",
      setup(builder) {
        builder.onLoad({ filter: /\/core\/db\.ts$/ }, () => ({
          contents:
            "export const dbList = async () => []; export const dbGet = async () => undefined; export const dbSet = async () => {}; export const dbDel = async () => {};",
        }));
      },
    },
  ],
});
after(() => rm(output, { recursive: true, force: true }));

let moduleNumber = 0;
const client = () => import(`${pathToFileURL(bundle)}?test=${moduleNumber++}`);
const ping = (characterId = "42") => ({
  kind: "move",
  server: "he4000",
  characterId,
  characterName: "Test Pilot",
  status: "ic",
  lfrp: false,
});
const response = (body = {}, status = 200) => Response.json(body, { status });
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function historyFile(rows) {
  const name = "combat_2026-09-19_12_00_00_000.txt";
  const owner = (x) => `@Test Pilot#42|(${x},0,0,0)|(100/100)`;
  const lines = [`[12:00:00.000] [${owner(0)}] [=] [] [AreaEntered {1}: Test Area {137438987989}] (he4000)`];
  for (let i = 1; i <= rows; i++) {
    lines.push(`[12:00:01.000] [${owner(i * 30)}] [@Other#99|(${i * 30},1,0,0)|(100/100)] [] [Event]`);
  }
  return { name, bytes: new TextEncoder().encode(lines.join("\n") + "\n") };
}

beforeEach((t) => {
  const values = new Map();
  t.mock.method(globalThis, "fetch", async (url) => {
    throw new Error(`Unexpected request: ${url}`);
  });
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  globalThis.window = { setTimeout: () => 1, clearTimeout: () => {} };
  globalThis.innerWidth = 1280;
  t.mock.property(
    globalThis,
    "WebSocket",
    class {
      readyState = 0;
      close() {}
    },
  );
});

test("erasure drains all existing writes, discards pending uploads, and rotates identity only after success", async () => {
  const { Uplink } = await client();
  const requests = [];
  const gates = [];
  const deleting = deferred();
  globalThis.fetch = (url, init) => {
    requests.push({ url, ...init });
    const gate = deferred();
    gates.push(gate);
    if (init.method === "DELETE") deleting.resolve();
    return gate.promise;
  };
  const uplink = new Uplink("https://api.example.test", true);
  const oldId = uplink.installId;
  uplink.push(ping());
  const live = uplink.flush();
  assert.equal(uplink.flush(), live, "overlapping flushes must not duplicate an upload");
  const history = uplink.send([ping()], [], true);
  const friend = uplink.friend("he4000", "99", "add");
  const feedback = uplink.feedback("general", [], null, "test");
  const erase = uplink.deleteMyData();
  assert.equal(uplink.deleteMyData(), erase);
  assert.equal(uplink.enabled, false);
  assert.equal(uplink.status, "off");
  assert.equal(uplink.queued, 0);
  uplink.configure(uplink.baseUrl, true);
  uplink.push(ping());
  uplink.pushSighting({ server: "he4000", seenBy: "42", characterId: "99", characterName: "Other" });
  await assert.rejects(uplink.send([ping()], []), /uplink off/);
  await uplink.friend("he4000", "99", "add");
  await uplink.feedback("general", [], null, "too late");
  assert.equal(requests.length, 4);
  assert.equal(uplink.queued, 0);
  assert.equal(uplink.installId, oldId);
  gates[0].resolve(response());
  await live;
  gates[1].resolve(response());
  await history;
  gates[2].resolve(response());
  await friend;
  assert.equal(requests.length, 4, "DELETE must wait for the outstanding feedback write too");
  gates[3].resolve(response());
  await feedback;
  await deleting.promise;
  assert.equal(requests[4].headers["x-install-id"], oldId);
  assert.equal(uplink.installId, oldId);
  gates[4].resolve(response({ characters: 1, pings: 2, sightings: 0 }));
  assert.deepEqual(await erase, { characters: 1, pings: 2, sightings: 0 });
  assert.notEqual(uplink.installId, oldId);
  assert.equal(localStorage.getItem("hydian:installId"), uplink.installId);
  assert.equal(uplink.enabled, false);
  assert.deepEqual(JSON.parse(localStorage.getItem("hydian:uplink:queue")), { pings: [], sightings: [] });
  uplink.configure(uplink.baseUrl, true);
  const resumed = uplink.send([ping()], []);
  assert.equal(JSON.parse(requests[5].body).installId, uplink.installId);
  gates[5].resolve(response());
  await resumed;
});

test("failed erasure keeps the original identity for an idempotent retry and never restores the queue", async () => {
  const { Uplink } = await client();
  const uplink = new Uplink("https://api.example.test", true);
  const oldId = uplink.installId;
  uplink.push(ping());
  globalThis.fetch = async () => response({}, 503);
  await assert.rejects(uplink.deleteMyData(), /HTTP 503/);
  assert.equal(uplink.installId, oldId);
  assert.equal(localStorage.getItem("hydian:installId"), oldId);
  assert.equal(uplink.enabled, false);
  assert.equal(uplink.queued, 0);
  const restarted = new Uplink(uplink.baseUrl, false);
  assert.equal(restarted.installId, oldId);
  assert.equal(restarted.queued, 0);
  globalThis.fetch = async (_url, init) => {
    assert.equal(init.headers["x-install-id"], oldId);
    return response({ characters: 0, pings: 0, sightings: 0 });
  };
  await uplink.deleteMyData();
  assert.notEqual(uplink.installId, oldId);
});

test("a resumed queue is scheduled again when its timer joined an older upload", async () => {
  const { Uplink } = await client();
  const timers = new Map();
  let timerId = 0;
  window.setTimeout = (callback) => {
    timers.set(++timerId, callback);
    return timerId;
  };
  window.clearTimeout = (id) => timers.delete(id);
  const requests = [];
  const old = deferred();
  globalThis.fetch = (url, init) => {
    requests.push({ url, ...init });
    return requests.length === 1 ? old.promise : Promise.resolve(response());
  };
  const uplink = new Uplink("https://api.example.test", true);
  uplink.push(ping("42"));
  const first = uplink.flush();
  uplink.configure(uplink.baseUrl, false);
  uplink.configure(uplink.baseUrl, true);
  uplink.push(ping("84"));
  const [id, callback] = timers.entries().next().value;
  timers.delete(id);
  callback();
  old.resolve(response());
  await first;
  assert.equal(uplink.queued, 1);
  assert.equal(timers.size, 1, "the fresh queue still needs a scheduled flush");
  const [nextId, nextCallback] = timers.entries().next().value;
  timers.delete(nextId);
  nextCallback();
  await uplink.flush();
  assert.equal(requests.length, 2);
  assert.equal(JSON.parse(requests[1].body).pings[0].characterId, "84");
  assert.equal(uplink.queued, 0);
});

test("discarding a hidden character's queue preserves its new Invisible update while an old upload finishes", async () => {
  const { Uplink } = await client();
  const old = deferred();
  const requests = [];
  globalThis.fetch = (_url, init) => {
    requests.push(JSON.parse(init.body));
    return requests.length === 1 ? old.promise : Promise.resolve(response());
  };
  const uplink = new Uplink("https://api.example.test", true);
  uplink.push(ping("42"));
  const first = uplink.flush();
  uplink.push(ping("42"));
  uplink.push(ping("84"));
  uplink.pushSighting({ server: "he4000", seenBy: "42", characterId: "99", characterName: "Other" });
  uplink.discardCharacter("he4000", "42");
  uplink.push({ ...ping("42"), kind: "status", status: "invisible" });
  old.resolve(response());
  await first;
  await uplink.flush();
  assert.deepEqual(
    requests[1].pings.map((p) => [p.characterId, p.status]),
    [
      ["84", "ic"],
      ["42", "invisible"],
    ],
  );
  assert.deepEqual(requests[1].sightings, []);
  assert.equal(uplink.queued, 0);
});

test("history rechecks the owner's sharing choice between upload batches", async () => {
  const { Uplink, Backfill } = await client();
  const { name, bytes } = historyFile(4500);
  let shared = true;
  const batches = [];
  globalThis.fetch = async (url, init) => {
    if (url.startsWith("/bridge/readDir?")) return response([{ name, isDir: false }]);
    if (url.startsWith("/bridge/stat?")) return response({ size: bytes.length });
    if (url.startsWith("/bridge/read?")) return new Response(bytes);
    assert.equal(init.method, "POST");
    batches.push(JSON.parse(init.body));
    shared = false;
    return response();
  };
  const uplink = new Uplink("https://api.example.test", true);
  const backfill = new Backfill(uplink, () => shared);
  await backfill.run("/synthetic/logs");
  assert.equal(batches.length, 1, "remaining historical batches must stop after Invisible");
  assert.equal(batches[0].pings.length, 2000);
  assert.equal(batches[0].historical, true);
  assert.equal(JSON.parse(localStorage.getItem("hydian:backfill:done"))[name], "!he4000:42");
  assert.equal(backfill.state.skipped, 1);
  assert.equal(backfill.state.running, false);
});

test("the latest history cancellation drains its batch and suppresses an earlier queued restart", async () => {
  const { Uplink, Backfill } = await client();
  const { name, bytes } = historyFile(2500);
  const started = deferred();
  const uploaded = deferred();
  let batches = 0;
  globalThis.fetch = async (url) => {
    if (url.startsWith("/bridge/readDir?")) return response([{ name, isDir: false }]);
    if (url.startsWith("/bridge/stat?")) return response({ size: bytes.length });
    if (url.startsWith("/bridge/read?")) return new Response(bytes);
    batches++;
    if (batches === 1) {
      started.resolve();
      return uploaded.promise;
    }
    return response();
  };
  const uplink = new Uplink("https://api.example.test", true);
  const backfill = new Backfill(uplink, () => true);
  const run = backfill.run("/synthetic/logs");
  await started.promise;
  const cancelled = backfill.cancel();
  const queuedRestart = backfill.run("/synthetic/logs");
  backfill.cancel();
  assert.equal(backfill.state.running, true);
  uploaded.resolve(response());
  await cancelled;
  await run;
  await queuedRestart;
  assert.equal(batches, 1);
  assert.equal(backfill.state.running, false);
  assert.equal(backfill.state.error, "");
  assert.equal(localStorage.getItem("hydian:backfill:done"), null);
  backfill.reset();
  await backfill.run("/synthetic/logs");
  assert.equal(batches, 3);
  assert.equal(JSON.parse(localStorage.getItem("hydian:backfill:done"))[name], "he4000:42");
});

test("store disables sharing before deletion, persists it through failure and restart, then allows explicit opt-in", async (t) => {
  localStorage.setItem("hydian:share", "true");
  localStorage.setItem("hydian:charStatus", JSON.stringify({ "he4000:42": { status: "ic", lfrp: false } }));
  localStorage.setItem("hydian:activeKey", JSON.stringify("he4000:42"));
  const { useApp } = await client();
  t.mock.method(globalThis, "setTimeout", () => 1);
  t.mock.method(globalThis, "setInterval", () => 1);
  const requests = [];
  let failDeletion = true;
  globalThis.fetch = async (url, init = {}) => {
    if (url === "/bridge/roots") throw new Error("No game files in this test");
    if (url.includes("/v1/registry?")) return response({ characters: [] });
    requests.push({ url, ...init });
    if (init.method === "DELETE") return response({ characters: 1, pings: 0, sightings: 0 }, failDeletion ? 503 : 200);
    return response();
  };
  await useApp.getState().boot();
  const oldId = useApp.getState().uplink.installId;
  const first = useApp.getState().deleteMyData();
  assert.equal(useApp.getState().share, false);
  assert.deepEqual(useApp.getState().charStatus, {});
  assert.equal(localStorage.getItem("hydian:share"), "false");
  useApp.getState().setShare(true);
  useApp.getState().setStatus("ic");
  assert.equal(useApp.getState().share, false);
  assert.deepEqual(useApp.getState().charStatus, {});
  await assert.rejects(first, /HTTP 503/);
  assert.equal(useApp.getState().share, false);
  assert.equal(useApp.getState().uplink.installId, oldId);
  const restarted = await client();
  assert.equal(restarted.useApp.getState().share, false);
  assert.deepEqual(restarted.useApp.getState().charStatus, {});
  failDeletion = false;
  await useApp.getState().deleteMyData();
  assert.notEqual(useApp.getState().uplink.installId, oldId);
  assert.equal(useApp.getState().share, false);
  assert.deepEqual(JSON.parse(localStorage.getItem("hydian:backfill:done")), {});
  useApp.getState().setStatus("ic");
  assert.equal(useApp.getState().share, true);
  assert.equal(useApp.getState().charStatus["he4000:42"].status, "ic");
  useApp.getState().toggleFriend("he4000:99", "Other", "he4000");
  assert.equal(JSON.parse(requests.at(-1).body).installId, useApp.getState().uplink.installId);
});

test("Invisible informs the server for an inactive shared character without uploading a never-shared one", async (t) => {
  localStorage.setItem(
    "hydian:uplink:queue",
    JSON.stringify({
      pings: [ping("84")],
      sightings: [{ server: "he4000", seenBy: "84", characterId: "99", characterName: "Other" }],
    }),
  );
  const { useApp } = await client();
  t.mock.method(globalThis, "setTimeout", () => 1);
  t.mock.method(globalThis, "setInterval", () => 1);
  globalThis.fetch = async (url) => {
    if (url === "/bridge/roots") throw new Error("No game files in this test");
    if (url.includes("/v1/registry?")) return response({ characters: [] });
    throw new Error(`Unexpected request: ${url}`);
  };
  await useApp.getState().boot();
  const character = {
    id: "84",
    name: "Inactive Pilot",
    server: "he4000",
    cls: null,
    disc: null,
    area: { id: "137438987989", name: "Test Area", mode: null, modeId: null },
    pos: null,
    lastEventMs: 1,
    lastSeen: 1,
    sessions: 1,
  };
  useApp.setState({
    activeKey: "he4000:84",
    live: null,
    myChars: [character, { ...character, id: "85" }],
    charStatus: { "he4000:84": { status: "ic", lfrp: false } },
  });
  useApp.getState().setStatus("invisible");
  const queued = JSON.parse(localStorage.getItem("hydian:uplink:queue")).pings;
  assert.equal(queued.length, 1);
  assert.equal(queued[0].kind, "status");
  assert.equal(queued[0].status, "invisible");
  assert.equal(queued[0].characterId, "84");
  assert.equal(queued[0].characterName, "Inactive Pilot");
  assert.equal(queued[0].areaId, "137438987989");
  assert.deepEqual(JSON.parse(localStorage.getItem("hydian:uplink:queue")).sightings, []);
  useApp.getState().setStatus("invisible");
  useApp.getState().setActive("he4000:85");
  useApp.getState().setStatus("invisible");
  assert.deepEqual(JSON.parse(localStorage.getItem("hydian:uplink:queue")).pings, queued);
  useApp.getState().setStatus("ic");
  assert.equal(useApp.getState().charStatus["he4000:85"].status, "ic");
  assert.deepEqual(
    JSON.parse(localStorage.getItem("hydian:uplink:queue")).pings,
    queued,
    "opting in an offline character must not fabricate live presence",
  );
});

test("character removal drains in-flight uploads, persists suppression, and only explicit restore resumes them", async () => {
  const { Uplink } = await client();
  const uplink = new Uplink("https://api.example.test", true);
  const requests = [];
  const uploading = deferred();
  globalThis.fetch = (url, init) => {
    requests.push({ url, ...init });
    return url.endsWith("/v1/pings") && requests.length === 1 ? uploading.promise : Promise.resolve(response());
  };
  uplink.push(ping());
  const flight = uplink.flush();
  uplink.push(ping("84"));
  uplink.pushSighting({ server: "he4000", seenBy: "42", characterId: "99", characterName: "Nearby" });
  uplink.pushSighting({ server: "he4000", seenBy: "84", characterId: "42", characterName: "Removed" });
  const removal = uplink.deleteCharacter("he4000", "42");
  assert.deepEqual(uplink.removedCharacters, ["he4000:42"]);
  assert.equal(uplink.queued, 1, "the other own character is unaffected");
  await Promise.resolve();
  assert.equal(requests.length, 1, "DELETE waits for the existing upload to finish");
  await uplink.send([ping()], [{ server: "he4000", seenBy: "84", characterId: "42", characterName: "Removed" }], true);
  assert.equal(requests.length, 1, "history cannot bypass suppression");
  uploading.resolve(response());
  await flight;
  await removal;
  assert.equal(requests[1].method, "DELETE");
  assert.ok(requests[1].url.endsWith("/v1/me/characters/he4000/42"));
  assert.equal(requests[1].headers["x-install-id"], uplink.installId);
  const restarted = new Uplink(uplink.baseUrl, true);
  restarted.push(ping());
  restarted.pushSighting({ server: "he4000", seenBy: "42", characterId: "99", characterName: "Nearby" });
  assert.equal(restarted.queued, 1);
  assert.deepEqual(restarted.removedCharacters, ["he4000:42"]);
  globalThis.fetch = async () => response({}, 503);
  await assert.rejects(restarted.restoreCharacter("he4000", "42"), /503/);
  assert.deepEqual(restarted.removedCharacters, ["he4000:42"]);
  globalThis.fetch = async (url, init) => {
    assert.ok(url.endsWith("/restore"));
    assert.equal(init.method, "POST");
    return response();
  };
  await restarted.restoreCharacter("he4000", "42");
  assert.deepEqual(restarted.removedCharacters, []);
  restarted.push(ping());
  assert.equal(restarted.queued, 2);
});

test("failed character removal stays suppressed for retry, including after restart", async () => {
  const { Uplink } = await client();
  const uplink = new Uplink("https://api.example.test", true);
  uplink.push(ping());
  globalThis.fetch = async () => response({}, 503);
  await assert.rejects(uplink.deleteCharacter("he4000", "42"), /503/);
  assert.equal(uplink.queued, 0);
  const restarted = new Uplink(uplink.baseUrl, true);
  restarted.push(ping());
  assert.equal(restarted.queued, 0);
  globalThis.fetch = async () => response({ ok: true, characters: 0, pings: 0, sightings: 0 });
  await restarted.deleteCharacter("he4000", "42");
  assert.deepEqual(restarted.removedCharacters, ["he4000:42"]);
});

const ownCharacter = (id = "42") => ({
  id,
  name: "Test Pilot",
  server: "he4000",
  cls: null,
  disc: null,
  area: { id: "137438987989", name: "Nar Shaddaa", mode: null, modeId: null },
  pos: null,
  lastEventMs: Date.now(),
  lastSeen: Date.now(),
  sessions: 1,
});
const player = (id, status = "ic", lastActive = Date.now()) => ({
  key: `he4000:${id}`,
  id,
  name: `Pilot ${id}`,
  server: "he4000",
  cls: null,
  disc: null,
  planetId: "137438987989",
  areaName: "Nar Shaddaa",
  x: 0,
  y: 0,
  z: 0,
  heading: 0,
  status,
  hue: 0,
  lastActive,
});

test("all public selectors exclude Invisible, expired and own offline snapshots while preserving private characters", async () => {
  const { useApp, selectRegistered, selectLive, selectCounts, selectPlayersOn } = await client();
  const now = Date.now();
  const visible = player("99", "ooc", now);
  const hidden = player("88", "invisible", now);
  const offline = player("77", "ic", now - 46 * 60_000);
  const own = player("42", "ic", now);
  useApp.setState({
    activeKey: "he4000:42",
    myChars: [ownCharacter()],
    live: null,
    clock: now,
    charStatus: { "he4000:42": { status: "invisible", lfrp: false } },
    livePlayers: Object.fromEntries([visible, hidden, offline, own].map((p) => [p.key, p])),
    registry: { he4000: { at: now, error: null, players: [visible, hidden, offline, own] } },
  });
  const assertPublic = () => {
    const s = useApp.getState();
    assert.deepEqual(
      selectRegistered(s, "he4000").map((p) => p.id),
      ["99"],
    );
    assert.deepEqual(
      selectLive(s, "he4000").map((p) => p.id),
      ["99"],
    );
    assert.equal(selectCounts(s).byServer.he4000, 1);
    assert.deepEqual(
      selectPlayersOn(s, "he4000", "nar-shaddaa").map((p) => p.id),
      ["99"],
    );
    assert.equal(s.myChars.length, 1);
  };
  assertPublic();
  useApp.setState({ charStatus: { "he4000:42": { status: "ic", lfrp: false } } });
  assertPublic();
  useApp.setState({
    live: {
      ownerId: "42",
      ownerName: "Test Pilot",
      server: "he4000",
      sightings: new Map([
        ["88", { id: "88", name: "Invisible nearby", x: 0, y: 0, z: 0, atMs: now }],
        ["66", { id: "66", name: "Never opted in", x: 0, y: 0, z: 0, atMs: now }],
      ]),
      area: ownCharacter().area,
      pos: { x: 0, y: 0, z: 0, heading: 0, atMs: now },
    },
    liveAt: now,
  });
  assert.deepEqual(
    selectRegistered(useApp.getState(), "he4000").map((p) => p.id),
    ["99", "42"],
  );
  assert.deepEqual(
    selectPlayersOn(useApp.getState(), "he4000", "nar-shaddaa").map((p) => p.id),
    ["99", "42"],
    "local sightings cannot reveal Invisible or never-opted-in players",
  );
});

test("store removal hides immediately, handles failure, and restores only on explicit visible status", async (t) => {
  const { useApp } = await client();
  t.mock.method(globalThis, "setTimeout", () => 1);
  t.mock.method(globalThis, "setInterval", () => 1);
  let failDelete = true;
  let restoring = null;
  let restoreRequests = 0;
  globalThis.fetch = async (url, init = {}) => {
    if (url === "/bridge/roots") throw new Error("No game files in this test");
    if (url.includes("/v1/registry?")) return response({ characters: [] });
    if (init.method === "DELETE") return response({}, failDelete ? 503 : 200);
    if (url.endsWith("/restore")) {
      restoreRequests++;
      return restoring.promise;
    }
    return response();
  };
  await useApp.getState().boot();
  useApp.setState({
    activeKey: "he4000:42",
    myChars: [ownCharacter()],
    charStatus: { "he4000:42": { status: "ic", lfrp: false } },
    livePlayers: { "he4000:42": player("42") },
    registry: { he4000: { at: Date.now(), error: null, players: [player("42")] } },
  });
  const removing = useApp.getState().removeCharacter("he4000:42");
  assert.equal(useApp.getState().charStatus["he4000:42"].status, "invisible");
  assert.deepEqual(useApp.getState().livePlayers, {});
  assert.deepEqual(useApp.getState().registry.he4000.players, []);
  await assert.rejects(removing, /503/);
  assert.deepEqual(useApp.getState().uplink.removedCharacters, ["he4000:42"]);
  failDelete = false;
  await useApp.getState().removeCharacter("he4000:42");
  useApp.getState().setShare(true);
  await useApp.getState().setStatus("invisible");
  assert.equal(restoreRequests, 0, "background sharing settings cannot restore a removed character");
  restoring = deferred();
  const share = useApp.getState().setStatus("ooc");
  assert.equal(useApp.getState().characterActions["he4000:42"], "sharing");
  assert.equal(useApp.getState().charStatus["he4000:42"].status, "invisible");
  restoring.resolve(response({}, 503));
  await share;
  assert.equal(useApp.getState().charStatus["he4000:42"].status, "invisible");
  restoring = deferred();
  const retry = useApp.getState().setStatus("ic");
  restoring.resolve(response());
  await retry;
  assert.equal(useApp.getState().charStatus["he4000:42"].status, "ic");
  assert.deepEqual(useApp.getState().uplink.removedCharacters, []);
  assert.deepEqual(useApp.getState().characterActions, {});
  assert.equal(useApp.getState().myChars.length, 1, "local character remains manageable after removal");
});

test("old sockets cannot overwrite a newer subscription or its connection status", async () => {
  const { Uplink } = await client();
  const sockets = [];
  globalThis.WebSocket = class {
    readyState = 0;
    constructor() {
      sockets.push(this);
    }
    close() {}
  };
  const uplink = new Uplink("https://api.example.test", true);
  const events = [];
  uplink.onLive = (message) => events.push(message);
  uplink.subscribe("he4000");
  const old = sockets[0];
  uplink.subscribe("he3000");
  old.onmessage({ data: JSON.stringify({ type: "leave", key: "he4000:42" }) });
  old.onopen();
  assert.equal(uplink.status, "off");
  assert.deepEqual(events, []);
  sockets[1].onmessage({ data: JSON.stringify({ type: "snapshot", players: [] }) });
  assert.deepEqual(events, [{ type: "snapshot", players: [] }]);
});

test("a delayed registry response cannot restore a character after a live leave", async (t) => {
  const { useApp } = await client();
  t.mock.method(globalThis, "setTimeout", () => 1);
  t.mock.method(globalThis, "setInterval", () => 1);
  const sockets = [];
  globalThis.WebSocket = class {
    readyState = 0;
    constructor() {
      sockets.push(this);
    }
    close() {}
  };
  const registry = deferred();
  globalThis.fetch = async (url) => {
    if (url === "/bridge/roots") throw new Error("No game files in this test");
    if (url.includes("/v1/registry?")) return registry.promise;
    throw new Error(`Unexpected request ${url}`);
  };
  await useApp.getState().boot();
  sockets[0].onmessage({ data: JSON.stringify({ type: "leave", key: "he4000:99" }) });
  const loading = useApp.getState().loadRegistry("he4000", true);
  sockets[0].onmessage({ data: JSON.stringify({ type: "leave", key: "he4000:99" }) });
  registry.resolve(
    response({
      characters: [
        { key: "he4000:99", server: "he4000", characterId: "99", name: "Hidden", status: "ic", lastActive: Date.now() },
      ],
    }),
  );
  await loading;
  assert.equal(useApp.getState().registry.he4000, undefined);
  assert.deepEqual(useApp.getState().livePlayers, {});
});

test("overlay rejects Invisible and observed-only players, including friends", async () => {
  const { overlaySnapshot } = await client();
  const visible = player("99");
  const hidden = player("88", "invisible");
  const observed = { ...player("66", "ooc"), isSeen: true };
  const snapshot = overlaySnapshot("he4000", "Nar Shaddaa", null, [visible, hidden, observed], () => null, "live", {
    "he4000:66": {},
  });
  assert.deepEqual(
    snapshot.players.map((p) => p.key),
    ["he4000:99"],
  );
  assert.equal("seen" in snapshot, false);
});

for (const oldStatus of [200, 503]) {
  test(`an older registry ${oldStatus === 200 ? "response" : "failure"} cannot undo a newer refresh`, async () => {
    const { useApp, selectRegistered } = await client();
    const old = deferred(),
      latest = deferred();
    let calls = 0;
    globalThis.fetch = () => (++calls === 1 ? old.promise : latest.promise);
    useApp.setState({ registry: { he4000: { at: 0, error: null, players: [player("99")] } } });
    const first = useApp.getState().loadRegistry("he4000", true);
    const second = useApp.getState().loadRegistry("he4000", true);
    latest.resolve(response({ characters: [] }));
    await second;
    old.resolve(
      response(
        {
          characters: [
            {
              key: "he4000:99",
              server: "he4000",
              characterId: "99",
              name: "Now hidden",
              status: "ic",
              lastActive: Date.now(),
            },
          ],
        },
        oldStatus,
      ),
    );
    await first;
    assert.deepEqual(selectRegistered(useApp.getState(), "he4000"), []);
    assert.equal(useApp.getState().registry.he4000.error, null);
  });
}
