// Bump the app version everywhere it lives: package.json, tauri.conf.json, Cargo.toml and the hydian entry in
// Cargo.lock. `node scripts/bump.mjs patch|minor|major` prints the new version.
import fs from "node:fs";
import path from "node:path";

const kind = process.argv[2] ?? "patch";
if (!["patch", "minor", "major"].includes(kind)) throw new Error(`bump kind: ${kind}`);
const root = path.resolve(import.meta.dirname, "..", "apps", "desktop");
const pkgPath = path.join(root, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const [maj, min, pat] = pkg.version.split(".").map(Number);
const next =
  kind === "major" ? `${maj + 1}.0.0` : kind === "minor" ? `${maj}.${min + 1}.0` : `${maj}.${min}.${pat + 1}`;

const replace = (file, from, to) => {
  const s = fs.readFileSync(file, "utf8");
  if (!s.includes(from)) throw new Error(`${file}: ${from} not found`);
  fs.writeFileSync(file, s.replace(from, to));
};
replace(pkgPath, `"version": "${pkg.version}"`, `"version": "${next}"`);
replace(path.join(root, "src-tauri", "tauri.conf.json"), `"version": "${pkg.version}"`, `"version": "${next}"`);
replace(path.join(root, "src-tauri", "Cargo.toml"), `version = "${pkg.version}"`, `version = "${next}"`);
replace(
  path.join(root, "src-tauri", "Cargo.lock"),
  `name = "hydian"\nversion = "${pkg.version}"`,
  `name = "hydian"\nversion = "${next}"`,
);
process.stdout.write(next);
