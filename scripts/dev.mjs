// `pnpm dev`: the Tauri dev loop, with rustup's bin folder on PATH even when the shell that started us has not
// got it (the desktop app's launcher, a fresh terminal on Windows).
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

const cargoBin = join(process.env.CARGO_HOME ?? join(homedir(), ".cargo"), "bin");
const PATH = existsSync(cargoBin) ? `${cargoBin}${delimiter}${process.env.PATH ?? ""}` : process.env.PATH;
const pnpm = process.env.npm_execpath;
if (!pnpm) throw new Error("Start the desktop app with pnpm dev.");
const child = spawn(process.execPath, [pnpm, "-C", "apps/desktop", "tauri", "dev", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, PATH, Path: PATH },
});
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => process.exit(code ?? 1));
