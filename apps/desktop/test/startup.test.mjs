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
const output = await mkdtemp(join(tmpdir(), "hydian-startup-"));
for (const [platform, userAgent] of [
  ["mac", "Macintosh"],
  ["windows", "Windows NT 10.0"],
]) {
  await build({
    stdin: {
      contents:
        'export { useApp } from "./src/store"; export { OverlayHost } from "./src/core/overlay"; export { toast } from "sonner";',
      resolveDir: desktop,
    },
    bundle: true,
    outfile: join(output, `${platform}.mjs`),
    platform: "node",
    format: "esm",
    define: {
      "import.meta.env": JSON.stringify({ DEV: false }),
      "process.env.NODE_ENV": '"production"',
      "navigator.userAgent": JSON.stringify(userAgent),
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
}
after(() => rm(output, { recursive: true, force: true }));

let moduleNumber = 0;
const client = (platform = "mac") => import(`${pathToFileURL(join(output, `${platform}.mjs`))}?test=${moduleNumber++}`);
const preference = "hydian:trayIconVisible";
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

test("the menu-bar icon starts visible and hide/show saves only after native success", async () => {
  const { useApp } = await client();
  assert.equal(useApp.getState().trayIconVisible, true);
  assert.equal(useApp.getState().trayIconChanging, false);
  assert.equal(localStorage.getItem(preference), null);
  const commands = [];
  for (const visible of [false, true]) {
    const started = deferred(),
      changed = deferred();
    const saved = localStorage.getItem(preference);
    window.__TAURI_INTERNALS__.invoke = (command, args) => {
      commands.push({ command, args });
      started.resolve();
      return changed.promise;
    };
    const changing = useApp.getState().setTrayIconVisible(visible);
    assert.equal(useApp.getState().trayIconChanging, true);
    await started.promise;
    assert.equal(useApp.getState().trayIconVisible, !visible);
    assert.equal(localStorage.getItem(preference), saved);
    changed.resolve();
    await changing;
    assert.equal(useApp.getState().trayIconVisible, visible);
    assert.equal(useApp.getState().trayIconChanging, false);
    assert.equal(localStorage.getItem(preference), String(visible));
  }
  assert.deepEqual(commands, [
    { command: "set_tray_visible", args: { visible: false } },
    { command: "set_tray_visible", args: { visible: true } },
  ]);
});

for (const previous of [true, false]) {
  test(`failed ${previous ? "hide" : "show"} preserves the current icon and saved preference, then permits retry`, async () => {
    localStorage.setItem(preference, String(previous));
    const { useApp, toast } = await client();
    useApp.setState({ trayIconVisible: previous });
    window.__TAURI_INTERNALS__.invoke = async () => {
      throw new Error("private native detail");
    };
    await useApp.getState().setTrayIconVisible(!previous);
    assert.equal(useApp.getState().trayIconVisible, previous);
    assert.equal(useApp.getState().trayIconChanging, false);
    assert.equal(localStorage.getItem(preference), String(previous));
    assert.equal(toast.getHistory().at(-1).title, "Could not change the menu-bar icon. Please try again.");
    window.__TAURI_INTERNALS__.invoke = async () => {};
    await useApp.getState().setTrayIconVisible(!previous);
    assert.equal(useApp.getState().trayIconVisible, !previous);
    assert.equal(localStorage.getItem(preference), String(!previous));
  });
}

test("concurrent menu-bar changes issue only one native request", async () => {
  const { useApp } = await client();
  const started = deferred(),
    changed = deferred();
  const commands = [];
  window.__TAURI_INTERNALS__.invoke = (command, args) => {
    commands.push({ command, args });
    started.resolve();
    return changed.promise;
  };
  const hiding = useApp.getState().setTrayIconVisible(false);
  await useApp.getState().setTrayIconVisible(true);
  await useApp.getState().setTrayIconVisible(false);
  await started.promise;
  assert.deepEqual(commands, [{ command: "set_tray_visible", args: { visible: false } }]);
  assert.equal(useApp.getState().trayIconChanging, true);
  assert.equal(localStorage.getItem(preference), null);
  changed.resolve();
  await hiding;
  assert.equal(useApp.getState().trayIconVisible, false);
  assert.equal(useApp.getState().trayIconChanging, false);
  assert.equal(localStorage.getItem(preference), "false");
});

for (const platform of ["browser", "windows"]) {
  test(`${platform} leaves the menu-bar state and preference unchanged`, async () => {
    localStorage.setItem(preference, "false");
    if (platform === "browser") delete window.__TAURI_INTERNALS__;
    const { useApp, toast } = await client(platform === "windows" ? "windows" : "mac");
    let commands = 0;
    if (platform === "windows")
      window.__TAURI_INTERNALS__.invoke = async () => {
        commands++;
      };
    await useApp.getState().setTrayIconVisible(false);
    await useApp.getState().setTrayIconVisible(true);
    assert.equal(commands, 0);
    assert.equal(useApp.getState().trayIconVisible, true);
    assert.equal(useApp.getState().trayIconChanging, false);
    assert.equal(localStorage.getItem(preference), "false");
    assert.equal(toast.getHistory().length, 0);
  });
}

test("boot restores the saved menu-bar choice across app restarts", async (t) => {
  t.mock.method(globalThis, "setTimeout", () => 1);
  t.mock.method(globalThis, "setInterval", () => 1);
  t.mock.method(globalThis, "fetch", async () => Response.json({ characters: [] }));
  localStorage.setItem("hydian:share", "false");
  localStorage.setItem("hydian:autostartInit:v2", "1");
  const commands = [];
  window.__TAURI_INTERNALS__.invoke = async (command, args) => {
    if (command === "set_tray_visible") {
      commands.push(args.visible);
      return;
    }
    if (command === "launched_minimized" || command === "plugin:autostart|is_enabled") return false;
    if (command === "plugin:app|version") return "0.1.7";
    throw new Error(`No game files in this test: ${command}`);
  };
  for (const expected of [true, false, true]) {
    const { useApp, OverlayHost } = await client();
    t.mock.method(OverlayHost.prototype, "init", async () => {});
    t.mock.method(OverlayHost.prototype, "push", async () => {});
    const restored = new Promise((resolve) => {
      const unsubscribe = useApp.subscribe((state, before) => {
        if (before.trayIconChanging && !state.trayIconChanging) {
          unsubscribe();
          resolve();
        }
      });
    });
    const before = commands.length;
    await useApp.getState().boot();
    await restored;
    assert.equal(useApp.getState().trayIconVisible, expected);
    assert.equal(localStorage.getItem(preference), String(expected));
    assert.deepEqual(commands.slice(before), [expected]);
    await useApp.getState().boot();
    assert.equal(commands.length, before + 1, "calling boot twice must not repeat native restoration");
    await useApp.getState().setTrayIconVisible(!expected);
  }
});

test("the menu shows the overlay repeatedly while the keyboard shortcut still toggles it", async () => {
  const { OverlayHost } = await client();
  const callbacks = new Map(),
    events = new Map(),
    shortcuts = new Map();
  const visibility = [];
  let emitted;
  window.__TAURI_INTERNALS__.transformCallback = (callback) => {
    const id = callbacks.size + 1;
    callbacks.set(id, callback);
    return id;
  };
  window.__TAURI_INTERNALS__.invoke = async (command, args) => {
    switch (command) {
      case "plugin:window|get_all_windows":
        return ["overlay"];
      case "is_game_running":
        return true;
      case "plugin:window|available_monitors":
        return [];
      case "plugin:window|primary_monitor":
        return null;
      case "plugin:event|listen":
        events.set(args.event, callbacks.get(args.handler));
        return args.handler;
      case "plugin:global-shortcut|register":
        shortcuts.set(args.shortcuts[0], args.handler.onmessage);
        return;
      case "plugin:global-shortcut|unregister_all":
      case "plugin:window|set_always_on_top":
      case "plugin:window|set_ignore_cursor_events":
      case "plugin:window|set_resizable":
        return;
      case "plugin:window|show":
      case "plugin:window|hide":
        assert.equal(args.label, "overlay");
        visibility.push(command === "plugin:window|show");
        return;
      case "plugin:event|emit_to":
        assert.equal(args.event, "overlay:settings");
        emitted.resolve();
        return;
      default:
        throw new Error(`Unexpected native command: ${command}`);
    }
  };
  const host = new OverlayHost();
  await host.init();
  assert.equal(host.current.on, false);
  const show = () => events.get("overlay:show")({ payload: null });
  const toggle = () => shortcuts.get("CommandOrControl+Shift+O")({ state: "Pressed" });
  for (const [action, expected] of [
    [show, true],
    [show, true],
    [toggle, false],
    [toggle, true],
  ]) {
    emitted = deferred();
    action();
    await emitted.promise;
    assert.equal(host.current.on, expected);
    assert.equal(JSON.parse(localStorage.getItem("hydian:overlay:settings")).on, expected);
  }
  assert.deepEqual(visibility, [false, true, true, false, true]);
});
