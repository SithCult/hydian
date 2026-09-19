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
const output = await mkdtemp(join(tmpdir(), "hydian-help-"));
const bundle = join(output, "client.mjs");
await build({
  stdin: {
    contents:
      'export { useApp } from "./src/store"; export { handleHelpAction } from "./src/core/help"; export { toast } from "sonner";',
    resolveDir: desktop,
  },
  bundle: true,
  outfile: bundle,
  platform: "node",
  format: "esm",
  define: { "import.meta.env": JSON.stringify({ DEV: false }), "process.env.NODE_ENV": '"production"' },
});
after(() => rm(output, { recursive: true, force: true }));

let moduleNumber = 0;
const client = () => import(`${pathToFileURL(bundle)}?test=${moduleNumber++}`);
function deferred() {
  let resolve;
  const promise = new Promise((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}

beforeEach(() => {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  globalThis.window = {
    __TAURI_INTERNALS__: {
      invoke: async (command) => {
        throw new Error(`Unexpected native command: ${command}`);
      },
    },
  };
  globalThis.innerWidth = 1280;
});

test("Help always navigates to About after another Settings tab was selected", async () => {
  const { useApp, handleHelpAction } = await client();
  await handleHelpAction("help-about");
  assert.deepEqual(useApp.getState().modal, { kind: "settings", tab: "about" });
  useApp.getState().openModal({ kind: "settings", tab: "game" });
  await handleHelpAction("help-about");
  assert.deepEqual(useApp.getState().modal, { kind: "settings", tab: "about" });
  assert.equal(useApp.getState().update.phase, "idle");
});

test("Help checks for updates through the shared store action and shows About", async () => {
  const { useApp, handleHelpAction } = await client();
  const started = deferred(),
    checked = deferred();
  let checks = 0;
  window.__TAURI_INTERNALS__.invoke = (command) => {
    assert.equal(command, "plugin:updater|check");
    checks++;
    started.resolve();
    return checked.promise;
  };
  useApp.getState().openModal({ kind: "settings", tab: "game" });
  const checking = handleHelpAction("help-update");
  assert.deepEqual(useApp.getState().modal, { kind: "settings", tab: "about" });
  assert.equal(useApp.getState().update.phase, "checking");
  await started.promise;
  await useApp.getState().checkUpdate();
  assert.equal(checks, 1, "Help and Settings must share the same in-progress check");
  checked.resolve(null);
  await checking;
  assert.equal(useApp.getState().update.phase, "up-to-date");
});

test("About and update actions preserve Welcome and explain how to continue", async () => {
  const { useApp, handleHelpAction, toast } = await client();
  useApp.getState().openModal({ kind: "notice" });
  let commands = 0;
  window.__TAURI_INTERNALS__.invoke = async () => {
    commands++;
    return null;
  };
  await handleHelpAction("help-about");
  await handleHelpAction("help-update");
  assert.deepEqual(useApp.getState().modal, { kind: "notice" });
  assert.equal(useApp.getState().update.phase, "idle");
  assert.equal(commands, 0);
  assert.equal(toast.getHistory().at(-1).title, "Complete the welcome steps first.");
  assert.equal(localStorage.getItem("hydian:noticeSeen"), null);
});

test("Privacy remains accessible during Welcome without dismissing it", async () => {
  const { useApp, handleHelpAction } = await client();
  useApp.getState().openModal({ kind: "notice" });
  const commands = [];
  window.__TAURI_INTERNALS__.invoke = async (command, args) => {
    commands.push({ command, args });
  };
  await handleHelpAction("help-privacy");
  assert.deepEqual(commands, [{ command: "open_privacy_policy", args: {} }]);
  assert.deepEqual(useApp.getState().modal, { kind: "notice" });
  await handleHelpAction("unrelated-menu-item");
  assert.equal(commands.length, 1);
  assert.deepEqual(useApp.getState().modal, { kind: "notice" });
});
