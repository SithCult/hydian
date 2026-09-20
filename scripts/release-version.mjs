import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const { GITHUB_REF, GITHUB_SHA, GITHUB_EVENT_NAME, GITHUB_OUTPUT } = process.env;
if (GITHUB_REF !== "refs/heads/main" || git("rev-parse", "HEAD") !== GITHUB_SHA) {
  throw new Error("Releases must use the exact main commit selected by GitHub.");
}
git("merge-base", "--is-ancestor", GITHUB_SHA, "origin/main");

const read = (file) => fs.readFileSync(`apps/desktop/${file}`, "utf8");
const versions = [
  JSON.parse(read("package.json")).version,
  JSON.parse(read("src-tauri/tauri.conf.json")).version,
  read("src-tauri/Cargo.toml").match(/^version = "([^"]+)"$/m)?.[1],
  read("src-tauri/Cargo.lock").match(/^name = "hydian"\r?\nversion = "([^"]+)"$/m)?.[1],
];
const version = versions[0];
if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version) || versions.some((value) => value !== version)) {
  throw new Error(
    "The desktop package, Tauri configuration, Cargo manifest and lockfile must agree on a release version.",
  );
}

const tag = `v${version}`;
const existing = spawnSync("git", ["rev-parse", "--verify", `refs/tags/${tag}^{commit}`], { encoding: "utf8" });
if (existing.status === 0 && existing.stdout.trim() !== GITHUB_SHA) {
  if (GITHUB_EVENT_NAME !== "push") {
    throw new Error(`${tag} already belongs to another commit. Bump the version in a pull request before releasing.`);
  }
  console.log(`${tag} is already tagged; this push does not introduce a new release.`);
  fs.appendFileSync(GITHUB_OUTPUT, "release=false\n");
} else {
  if (existing.status !== 0) git("tag", "-a", tag, "-m", `Hydian ${version}`, GITHUB_SHA);
  console.log(`Release ${tag} from ${GITHUB_SHA}.`);
  fs.appendFileSync(GITHUB_OUTPUT, `release=true\ntag=${tag}\n`);
}
