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
const output = await mkdtemp(join(tmpdir(), "hydian-update-"));
for (const dev of [false, true]) {
  await build({
    stdin: { contents: 'export { useApp } from "./src/store";', resolveDir: desktop },
    bundle: true,
    outfile: join(output, `${dev}.mjs`),
    platform: "node",
    format: "esm",
    define: { "import.meta.env": JSON.stringify({ DEV: dev }), "process.env.NODE_ENV": '"production"' },
    plugins: [
      {
        name: "updater-service",
        setup(builder) {
          builder.onResolve({ filter: /^@tauri-apps\/plugin-(updater|process)$/ }, ({ path }) => ({
            path,
            namespace: "test",
          }));
          builder.onLoad({ filter: /.*/, namespace: "test" }, ({ path }) => ({
            contents: path.endsWith("updater")
              ? "export const check = (...args) => globalThis.updaterTest.check(...args);"
              : "export const relaunch = () => globalThis.updaterTest.relaunch();",
          }));
        },
      },
    ],
  });
}
after(() => rm(output, { recursive: true, force: true }));

let moduleNumber = 0;
const client = async (dev = false) =>
  (await import(`${pathToFileURL(join(output, `${dev}.mjs`))}?test=${moduleNumber++}`)).useApp;
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function update(overrides = {}) {
  return {
    version: "1.2.3",
    body: "Release notes",
    download: async () => {},
    install: async () => {},
    close: async () => {},
    ...overrides,
  };
}

beforeEach(() => {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  globalThis.window = { __TAURI_INTERNALS__: {} };
  globalThis.location = { search: "" };
  globalThis.innerWidth = 1280;
  globalThis.updaterTest = {
    check: async () => {
      throw new Error("Unexpected update check");
    },
    relaunch: async () => {
      throw new Error("Unexpected restart");
    },
  };
});

test("manual checks immediately report progress, suppress overlap and report up to date", async () => {
  const store = await client();
  const started = deferred(),
    checked = deferred();
  let checks = 0;
  updaterTest.check = (options) => {
    assert.equal(options.timeout, 30_000);
    checks++;
    started.resolve();
    return checked.promise;
  };
  const first = store.getState().checkUpdate();
  assert.equal(store.getState().update.phase, "checking");
  await started.promise;
  await store.getState().checkUpdate();
  assert.equal(checks, 1);
  checked.resolve(null);
  await first;
  assert.deepEqual(store.getState().update, { phase: "up-to-date" });
  await store.getState().checkUpdate();
  assert.equal(checks, 2, "a completed check can be requested again");
});

test("a download becomes ready only after verification and never installs in the background", async () => {
  const store = await client();
  const started = deferred(),
    downloaded = deferred();
  let progress,
    checks = 0,
    downloads = 0,
    installs = 0;
  updaterTest.check = async () => {
    checks++;
    return update({
      download: (onProgress) => {
        downloads++;
        progress = onProgress;
        started.resolve();
        return downloaded.promise;
      },
      install: async () => {
        installs++;
      },
    });
  };
  const checking = store.getState().checkUpdate();
  await started.promise;
  assert.deepEqual(store.getState().update, { phase: "downloading", version: "1.2.3", progress: 0 });
  progress({ event: "Progress", data: { chunkLength: 10 } });
  assert.equal(store.getState().update.progress, 0, "unknown content length stays indeterminate");
  progress({ event: "Started", data: { contentLength: 100 } });
  progress({ event: "Progress", data: { chunkLength: 150 } });
  assert.equal(store.getState().update.progress, 1, "progress never exceeds 100 percent");
  progress({ event: "Finished" });
  assert.equal(store.getState().update.phase, "downloading", "Finished precedes signature verification");
  await store.getState().checkUpdate();
  downloaded.resolve();
  await checking;
  assert.deepEqual(store.getState().update, { phase: "ready", version: "1.2.3" });
  await store.getState().checkUpdate();
  assert.equal(checks, 1);
  assert.equal(downloads, 1);
  assert.equal(installs, 0);
});

test("failed verification never reports ready, and retry checks fresh metadata and releases the failed update", async () => {
  const store = await client();
  const phases = [];
  const unsubscribe = store.subscribe((state) => phases.push(state.update.phase));
  let checks = 0,
    closed = 0,
    downloads = 0;
  updaterTest.check = async () =>
    ++checks === 1
      ? update({
          download: async (progress) => {
            progress({ event: "Finished" });
            throw new Error("Invalid update signature");
          },
          close: async () => {
            closed++;
          },
        })
      : update({
          version: "1.2.4",
          download: async () => {
            downloads++;
          },
        });
  await store.getState().checkUpdate();
  assert.deepEqual(store.getState().update, {
    phase: "error",
    operation: "download",
    version: "1.2.3",
    message: "Invalid update signature",
  });
  assert.equal(phases.includes("ready"), false);
  await store.getState().checkUpdate();
  assert.deepEqual(store.getState().update, { phase: "ready", version: "1.2.4" });
  assert.equal(closed, 1);
  assert.equal(downloads, 1);
  unsubscribe();
});

test("check failures are shown with a retry that can return up to date", async () => {
  const store = await client();
  updaterTest.check = async () => {
    throw new Error("Network unavailable");
  };
  await store.getState().checkUpdate();
  assert.deepEqual(store.getState().update, { phase: "error", operation: "check", message: "Network unavailable" });
  updaterTest.check = async () => null;
  await store.getState().checkUpdate();
  assert.equal(store.getState().update.phase, "up-to-date");
});

test("install failure keeps the downloaded package for retry and suppresses overlapping actions", async () => {
  const store = await client();
  const installing = deferred();
  let checks = 0,
    downloads = 0,
    installs = 0,
    restarts = 0;
  updaterTest.check = async () => {
    checks++;
    return update({
      download: async () => {
        downloads++;
      },
      install: () => (++installs === 1 ? installing.promise : Promise.resolve()),
    });
  };
  updaterTest.relaunch = async () => {
    restarts++;
  };
  await store.getState().checkUpdate();
  const first = store.getState().restartToUpdate();
  assert.equal(store.getState().update.phase, "installing");
  await store.getState().restartToUpdate();
  await store.getState().checkUpdate();
  assert.equal(installs, 1);
  installing.reject(new Error("App folder is read only"));
  await first;
  assert.deepEqual(store.getState().update, {
    phase: "error",
    operation: "install",
    version: "1.2.3",
    message: "Could not install the update: App folder is read only",
  });
  await store.getState().checkUpdate();
  assert.equal(checks, 1, "automatic checks must not discard the package awaiting an installation retry");
  await store.getState().restartToUpdate();
  assert.equal(installs, 2);
  assert.equal(downloads, 1);
  assert.equal(restarts, 1);
});

test("a relaunch failure retries restarting without installing the consumed package again", async () => {
  const store = await client();
  let installs = 0,
    restarts = 0;
  updaterTest.check = async () =>
    update({
      install: async () => {
        installs++;
      },
    });
  updaterTest.relaunch = async () => {
    if (++restarts === 1) throw new Error("Restart unavailable");
  };
  await store.getState().checkUpdate();
  await store.getState().restartToUpdate();
  assert.equal(store.getState().update.operation, "install");
  assert.equal(store.getState().update.message, "Could not restart Hydian: Restart unavailable");
  await store.getState().restartToUpdate();
  assert.equal(installs, 1);
  assert.equal(restarts, 2);
});

test("browser previews and development builds report updater unavailability without checking the feed", async () => {
  const browser = await client();
  delete window.__TAURI_INTERNALS__;
  await browser.getState().checkUpdate();
  assert.equal(browser.getState().update.phase, "unavailable");
  window.__TAURI_INTERNALS__ = {};
  const development = await client(true);
  await development.getState().checkUpdate();
  assert.equal(development.getState().update.phase, "unavailable");
});
