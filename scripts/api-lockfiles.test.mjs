// The API image installs from apps/api/package-lock.json (npm), while CI tests the API against pnpm-lock.yaml.
// Both must resolve the API's production dependencies to the same versions, or production runs code CI never ran.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.join(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

/** Resolved versions of one workspace package's production dependencies, from the pnpm lockfile's importers. */
function pnpmVersions(lock, importer) {
  const block = lock.split(/\r?\n/);
  const start = block.indexOf(`  ${importer}:`);
  assert.notEqual(start, -1, `${importer} is missing from pnpm-lock.yaml`);
  const versions = {};
  let section = "";
  let name = "";
  for (const line of block.slice(start + 1)) {
    if (/^ {2}\S/.test(line) || /^\S/.test(line)) break; // next importer or top-level key
    const heading = /^ {4}(\w+):$/.exec(line);
    if (heading) {
      section = heading[1];
      continue;
    }
    const dep = /^ {6}'?([^':]+)'?:$/.exec(line);
    if (dep) name = dep[1];
    const version = /^ {8}version: (\S+)$/.exec(line);
    if (version && section === "dependencies") versions[name] = version[1].replace(/\(.*$/, "");
  }
  return versions;
}

test("the API image and CI resolve the API's dependencies to the same versions", () => {
  const manifest = JSON.parse(read("apps/api/package.json"));
  const npmLock = JSON.parse(read("apps/api/package-lock.json"));
  const tested = pnpmVersions(read("pnpm-lock.yaml"), "apps/api");
  for (const name of Object.keys(manifest.dependencies)) {
    const shipped = npmLock.packages[`node_modules/${name}`]?.version;
    assert.ok(shipped, `${name} is missing from apps/api/package-lock.json`);
    assert.equal(shipped, tested[name], `${name}: the image installs ${shipped}, CI tests ${tested[name]}`);
  }
});
