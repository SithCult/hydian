import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const script = path.join(import.meta.dirname, "release-version.mjs");

function repository(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "hydian-release-"));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  const write = (file, content) => fs.writeFileSync(path.join(cwd, "apps/desktop", file), content);
  fs.mkdirSync(path.join(cwd, "apps/desktop/src-tauri"), { recursive: true });
  write("package.json", '{"version":"0.2.0"}');
  write("src-tauri/tauri.conf.json", '{"version":"0.2.0"}');
  write("src-tauri/Cargo.toml", '[package]\nname = "hydian"\nversion = "0.2.0"\n');
  write("src-tauri/Cargo.lock", 'version = 4\n\n[[package]]\nname = "hydian"\nversion = "0.2.0"\n');
  git("init", "--initial-branch=main");
  git("config", "user.name", "Release test");
  git("config", "user.email", "release@example.invalid");
  const commit = () => {
    git("add", ".");
    git("commit", "--quiet", "--allow-empty", "-m", "Reviewed release");
    const sha = git("rev-parse", "HEAD");
    git("update-ref", "refs/remotes/origin/main", sha);
    return sha;
  };
  commit();
  const run = (env = {}) => {
    const output = path.join(cwd, "outputs");
    fs.writeFileSync(output, "");
    const result = spawnSync(process.execPath, [script], {
      cwd,
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_REF: "refs/heads/main",
        GITHUB_SHA: git("rev-parse", "HEAD"),
        GITHUB_EVENT_NAME: "push",
        GITHUB_OUTPUT: output,
        ...env,
      },
    });
    return { ...result, output: fs.readFileSync(output, "utf8") };
  };
  return { git, write, commit, run };
}

test("tags the selected main commit without creating or modifying commits, and permits retries", (t) => {
  const repo = repository(t);
  const sha = repo.git("rev-parse", "HEAD");
  for (const event of ["push", "workflow_dispatch"]) {
    const result = repo.run({ GITHUB_EVENT_NAME: event });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.output, "release=true\ntag=v0.2.0\n");
    assert.equal(repo.git("rev-parse", "v0.2.0^{commit}"), sha);
    assert.equal(repo.git("rev-parse", "HEAD"), sha);
    assert.equal(repo.git("rev-list", "--count", "HEAD"), "1");
  }
});

test("unchanged versions on subsequent pushes skip, but manual reuse of a version fails", (t) => {
  const repo = repository(t);
  const tagged = repo.git("rev-parse", "HEAD");
  repo.git("tag", "v0.2.0");
  repo.commit();
  const automatic = repo.run();
  assert.equal(automatic.status, 0, automatic.stderr);
  assert.equal(automatic.output, "release=false\n");
  const manual = repo.run({ GITHUB_EVENT_NAME: "workflow_dispatch" });
  assert.notEqual(manual.status, 0);
  assert.match(manual.stderr, /already belongs to another commit/);
  assert.equal(repo.git("rev-parse", "v0.2.0^{commit}"), tagged);
});

test("rejects inconsistent versions in every secondary version file before tagging", (t) => {
  for (const [file, content] of [
    ["src-tauri/tauri.conf.json", '{"version":"0.1.9"}'],
    ["src-tauri/Cargo.toml", '[package]\nversion = "0.1.9"\n'],
    ["src-tauri/Cargo.lock", 'version = 4\n[[package]]\nname = "hydian"\nversion = "0.1.9"\n'],
  ]) {
    const repo = repository(t);
    repo.write(file, content);
    repo.commit();
    const result = repo.run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must agree on a release version/);
    assert.equal(repo.git("tag", "--list"), "");
  }
});

test("rejects non-release versions and an unapproved branch or commit", (t) => {
  const repo = repository(t);
  for (const env of [{ GITHUB_REF: "refs/heads/feature" }, { GITHUB_SHA: "0".repeat(40) }]) {
    assert.match(repo.run(env).stderr, /exact main commit/);
  }
  repo.write("package.json", '{"version":"0.2.0-beta"}');
  repo.commit();
  assert.match(repo.run().stderr, /must agree on a release version/);
  assert.equal(repo.git("tag", "--list"), "");
});

test("rejects a commit outside main even if its checkout and supplied SHA agree", (t) => {
  const repo = repository(t);
  repo.git("checkout", "--quiet", "-b", "feature");
  repo.git("commit", "--quiet", "--allow-empty", "-m", "Unreviewed change");
  const result = repo.run();
  assert.notEqual(result.status, 0);
  assert.equal(result.output, "");
  assert.equal(repo.git("tag", "--list"), "");
});
