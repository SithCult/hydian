import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const [command, ...args] = process.argv.slice(2);
if (command !== "build") throw new Error("Release bundling only accepts tauri-action's build command.");

// tauri-action invokes build; release compilation happens on a separate runner without signing credentials.
const require = createRequire(resolve("package.json"));
const signingFailureFile = resolve(process.env.RUNNER_TEMP ?? tmpdir(), `hydian-signing-${randomUUID()}.failed`);
const config = { build: { beforeBundleCommand: null } };
if (process.platform === "win32") {
  config.bundle = {
    windows: {
      signCommand: {
        cmd: "pwsh",
        args: ["-NoLogo", "-NoProfile", "-NonInteractive", "-File", resolve("../../scripts/sign-windows.ps1"), "%1"],
      },
    },
  };
}
const result = spawnSync(
  process.execPath,
  [require.resolve("@tauri-apps/cli/tauri.js"), "bundle", ...args, "--config", JSON.stringify(config)],
  { stdio: "inherit", env: { ...process.env, HYDIAN_SIGNING_FAILURE_FILE: signingFailureFile } },
);
// NSIS can ignore a failed uninstaller signing command.
const signingFailed = existsSync(signingFailureFile);
rmSync(signingFailureFile, { force: true });
if (result.error) throw result.error;
if (signingFailed) throw new Error("Windows signing failed during bundling.");
process.exit(result.status ?? 1);
