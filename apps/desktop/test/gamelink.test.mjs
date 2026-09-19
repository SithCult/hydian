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
const output = await mkdtemp(join(tmpdir(), "hydian-gamelink-"));
const bundle = join(output, "client.mjs");
await build({
  stdin: {
    contents: 'export * from "./src/core/gamelink"; export { useApp } from "./src/store";',
    resolveDir: desktop,
  },
  bundle: true,
  outfile: bundle,
  platform: "node",
  format: "esm",
  define: {
    "import.meta.env": JSON.stringify({ DEV: false }),
    "process.env.NODE_ENV": '"production"',
    "navigator.userAgent": '"Macintosh"',
  },
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
const paths = { logsDir: "/synthetic/CombatLogs", settingsDir: "/synthetic/settings" };
const log = { name: "combat_2026-09-19_12_00_00_000.txt", isDir: false, size: 0, mtime: 1 };
const failure = (code) => Response.json({ code, error: "Private/localized OS details" }, { status: 500 });
let poll;

beforeEach((t) => {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  globalThis.window = {
    setTimeout: () => 1,
    clearTimeout: () => {},
    setInterval: (callback) => {
      poll = callback;
      return 123;
    },
  };
  globalThis.innerWidth = 1280;
  t.mock.method(globalThis, "clearInterval", () => {});
  t.mock.method(globalThis, "fetch", async (url) => {
    throw new Error(`Unexpected request: ${url}`);
  });
});

function nextLink(store, predicate) {
  if (predicate(store.getState().link, store.getState())) return Promise.resolve(store.getState().link);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error("Game link did not reach the expected state"));
    }, 1000);
    const unsubscribe = store.subscribe((state) => {
      const { link } = state;
      if (predicate(link, state)) {
        clearTimeout(timer);
        unsubscribe();
        resolve(link);
      }
    });
  });
}

test("missing folders, denied permissions, wrong paths and unknown failures stay distinct", async () => {
  const { scanHistory, gameLinkFailure } = await client();
  for (const [code, status, issue] of [
    ["not-found", "nolog", "missing-folder"],
    ["permission-denied", "error", "permission-denied"],
    ["not-directory", "error", "unavailable"],
    ["unavailable", "error", "unavailable"],
  ]) {
    globalThis.fetch = async () => failure(code);
    await assert.rejects(scanHistory(paths.logsDir), (error) => {
      const state = gameLinkFailure(error);
      assert.equal(state.status, status);
      assert.equal(state.issue, issue);
      assert.doesNotMatch(state.error, /synthetic|Private|readDir|os error|disabled/i);
      return true;
    });
  }
  assert.equal(
    gameLinkFailure({ code: "permission-denied", message: "Zugriff verweigert" }).issue,
    "permission-denied",
  );
  assert.equal(gameLinkFailure(new TypeError("Failed to fetch")).issue, "unavailable");
});

test("an unreadable custom folder stays selected for correction instead of silently falling back", async () => {
  const { resolveLogsDir } = await client();
  globalThis.fetch = async (url) =>
    url === "/bridge/roots"
      ? Response.json({ documents: "/default", localData: "/settings" })
      : failure("permission-denied");
  assert.deepEqual(await resolveLogsDir("/custom/game"), { dir: "/custom/game", note: null });
});

test("missing-folder setup keeps polling and recovers through empty-folder and live states", async () => {
  const { useApp } = await client();
  let mode = "missing";
  globalThis.fetch = async (url) => {
    const parsed = new URL(url, "https://preview.test");
    if (parsed.pathname === "/bridge/readDir") {
      if (parsed.searchParams.get("path") === paths.settingsDir) return Response.json([]);
      return mode === "missing" ? failure("not-found") : Response.json(mode === "empty" ? [] : [log]);
    }
    if (parsed.pathname === "/bridge/stat") return Response.json({ size: 0, mtime: 1 });
    throw new Error(`Unexpected request: ${url}`);
  };
  useApp.setState({ paths, pathsCustom: paths });
  await useApp.getState().rescan();
  await nextLink(useApp, (link) => link.issue === "missing-folder");
  assert.equal(typeof poll, "function", "a missing folder must not stop the log watcher");
  mode = "empty";
  poll();
  await nextLink(useApp, (link) => link.status === "nolog" && !link.issue);
  assert.equal(useApp.getState().link.error, undefined);
  mode = "live";
  poll();
  await nextLink(useApp, (link) => link.status === "live");
  assert.equal(useApp.getState().link.file, log.name);
  assert.equal(useApp.getState().link.error, undefined);
  assert.equal(useApp.getState().link.issue, undefined);
});

test("permission failures while reading logs surface and clear after access is restored", async () => {
  const { useApp } = await client();
  let denied = true;
  globalThis.fetch = async (url) => {
    const parsed = new URL(url, "https://preview.test");
    if (parsed.pathname === "/bridge/readDir")
      return Response.json(parsed.searchParams.get("path") === paths.settingsDir ? [] : [log]);
    if (parsed.pathname === "/bridge/stat") return Response.json({ size: 1, mtime: 1 });
    if (parsed.pathname === "/bridge/read")
      return denied ? failure("permission-denied") : new Response(new Uint8Array([10]));
    throw new Error(`Unexpected request: ${url}`);
  };
  useApp.setState({ paths, pathsCustom: paths });
  await useApp.getState().rescan();
  await nextLink(useApp, (link) => link.issue === "permission-denied");
  denied = false;
  poll();
  await nextLink(useApp, (link) => link.status === "live" && !link.issue);
  assert.equal(useApp.getState().link.error, undefined);
});

test("file-stat permission errors are not mistaken for an empty history", async () => {
  const { scanHistory, gameLinkFailure } = await client();
  globalThis.fetch = async (url) =>
    url.startsWith("/bridge/readDir") ? Response.json([log]) : failure("permission-denied");
  await assert.rejects(scanHistory(paths.logsDir), (error) => gameLinkFailure(error).issue === "permission-denied");
});

test("Rescan redetects default folders after logging starts while preserving custom folders", async () => {
  const { useApp } = await client();
  let rootCalls = 0;
  const reads = [];
  globalThis.fetch = async (url) => {
    if (url === "/bridge/roots") {
      rootCalls++;
      return Response.json({ documents: "/bottle/Documents/SWTOR", localData: "/bottle/AppData/SWTOR" });
    }
    const parsed = new URL(url, "https://preview.test");
    if (parsed.pathname === "/bridge/readDir") {
      reads.push(parsed.searchParams.get("path"));
      return Response.json([]);
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  useApp.setState({ paths, pathsCustom: { settingsDir: "/custom/settings" } });
  await useApp.getState().rescan();
  await nextLink(useApp, (link) => link.status === "nolog");
  assert.equal(rootCalls, 1);
  assert.equal(useApp.getState().paths.logsDir, "/bottle/Documents/SWTOR/CombatLogs");
  assert.equal(useApp.getState().paths.settingsDir, "/custom/settings");
  assert.ok(reads.includes("/bottle/Documents/SWTOR/CombatLogs"));
  assert.ok(reads.includes("/custom/settings"));
  reads.length = 0;
  useApp.setState({ paths, pathsCustom: paths });
  await useApp.getState().rescan();
  await nextLink(useApp, (link) => link.status === "nolog");
  assert.equal(rootCalls, 1, "explicit folders need no default-path discovery");
  assert.deepEqual(useApp.getState().paths, paths);
  assert.ok(reads.includes(paths.logsDir));
});

test("restoring read permission restores the live character when the log has no new bytes", async () => {
  const { useApp } = await client();
  const bytes = new TextEncoder().encode(
    "[12:00:00.000] [@Test Pilot#42|(0,0,0,0)|(100/100)] [=] [] [AreaEntered {1}: Test Area {137438987989}] (he4000)\n",
  );
  let denied = false;
  let reads = 0;
  globalThis.fetch = async (url) => {
    const parsed = new URL(url, "https://preview.test");
    if (parsed.pathname === "/bridge/readDir")
      return Response.json(parsed.searchParams.get("path") === paths.settingsDir ? [] : [log]);
    if (parsed.pathname === "/bridge/stat")
      return denied ? failure("permission-denied") : Response.json({ size: bytes.length, mtime: 1 });
    if (parsed.pathname === "/bridge/read") {
      reads++;
      return new Response(bytes);
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  useApp.setState({ paths, pathsCustom: paths });
  await useApp.getState().rescan();
  await nextLink(useApp, (link, state) => link.status === "live" && state.live?.ownerName === "Test Pilot");
  const original = useApp.getState().live;
  const originalReads = reads;
  denied = true;
  poll();
  await nextLink(useApp, (link) => link.issue === "permission-denied");
  assert.equal(useApp.getState().live, null);
  denied = false;
  poll();
  await nextLink(useApp, (link) => link.status === "live" && !link.issue);
  assert.deepEqual(useApp.getState().live, original);
  assert.equal(reads, originalReads, "an unchanged log needs no replay to restore its session");
});

test("a failed history rescan preserves known characters and encounters while accepting a readable roster", async () => {
  const { useApp } = await client();
  const bytes = new TextEncoder().encode(
    "[12:00:00.000] [@Test Pilot#42|(0,0,0,0)|(100/100)] [=] [] [AreaEntered {1}: Test Area {137438987989}] (he4000)\n" +
      "[12:00:01.000] [@Test Pilot#42|(0,0,0,0)|(100/100)] [@Other#99|(30,1,0,0)|(100/100)] [] [Event]\n",
  );
  let historyDenied = false;
  let settingsDenied = false;
  let rosterName = "Old Pilot";
  globalThis.fetch = async (url) => {
    const parsed = new URL(url, "https://preview.test");
    if (parsed.pathname === "/bridge/readDir") {
      if (parsed.searchParams.get("path") === paths.settingsDir)
        return settingsDenied
          ? failure("permission-denied")
          : Response.json([{ name: `he4000_${rosterName}_PlayerGUIState.ini`, isDir: false }]);
      return historyDenied ? failure("permission-denied") : Response.json([log]);
    }
    if (parsed.pathname === "/bridge/stat") return Response.json({ size: bytes.length, mtime: 1 });
    if (parsed.pathname === "/bridge/read") return new Response(bytes);
    throw new Error(`Unexpected request: ${url}`);
  };
  useApp.setState({ paths, pathsCustom: paths });
  await useApp.getState().rescan();
  await nextLink(useApp, (link, state) => link.status === "live" && state.live?.ownerName === "Test Pilot");
  const characters = useApp.getState().myChars;
  const encounters = useApp.getState().encounters;
  assert.equal(characters[0].name, "Test Pilot");
  assert.equal(encounters[0].name, "Other");
  historyDenied = true;
  rosterName = "New Pilot";
  await useApp.getState().rescan();
  await nextLink(useApp, (link) => link.issue === "permission-denied");
  assert.deepEqual(useApp.getState().myChars, characters);
  assert.deepEqual(useApp.getState().encounters, encounters);
  assert.deepEqual(useApp.getState().rosterList, [{ server: "he4000", name: "New Pilot" }]);
  settingsDenied = true;
  await useApp.getState().rescan();
  assert.deepEqual(useApp.getState().rosterList, [{ server: "he4000", name: "New Pilot" }]);
  historyDenied = false;
  settingsDenied = false;
  poll();
  await nextLink(useApp, (link, state) => link.status === "live" && state.live?.ownerName === "Test Pilot");
  assert.deepEqual(useApp.getState().myChars, characters);
  assert.deepEqual(useApp.getState().encounters, encounters);
  assert.equal(useApp.getState().link.error, undefined);
});
