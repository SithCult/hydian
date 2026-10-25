// Compiles the Icon Composer source into the Assets.car that macOS 26 renders as a Liquid Glass icon.
// Tauri bundles the committed file, so builds don't need Xcode; rerun this with Xcode 26+ after editing the icon.
import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const desktop = resolve(import.meta.dirname, "../apps/desktop");
const work = mkdtempSync(join(tmpdir(), "hydian-icon-"));
try {
  cpSync(join(desktop, "branding/hydian.icon"), join(work, "Icon.icon"), { recursive: true });
  const result = spawnSync(
    "xcrun",
    [
      "actool",
      join(work, "Icon.icon"),
      "--compile",
      work,
      "--output-format",
      "human-readable-text",
      "--warnings",
      "--errors",
      "--output-partial-info-plist",
      join(work, "partial.plist"),
      "--app-icon",
      "Icon",
      "--include-all-app-icons",
      "--target-device",
      "mac",
      "--minimum-deployment-target",
      "26.0",
      "--platform",
      "macosx",
    ],
    { stdio: "inherit" },
  );
  if (result.status !== 0) throw new Error("actool failed; Xcode 26 or newer is required.");
  copyFileSync(join(work, "Assets.car"), join(desktop, "src-tauri/icons/Assets.car"));
} finally {
  rmSync(work, { recursive: true, force: true });
}
