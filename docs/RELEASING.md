# Releases

Hydian ships a Windows installer and macOS disk images for Apple Silicon and Intel. Installed copies update
themselves from signed update files.

## Cutting a release

1. On a pull-request branch, run `node scripts/bump.mjs patch` (or `minor` / `major`) and commit the four
   version files it changes: `apps/desktop/package.json`, `tauri.conf.json`, `Cargo.toml` and `Cargo.lock`.
2. Merge the reviewed PR once CI passes. A change to those files on `main` starts the **Release** workflow.
3. The workflow runs the shared checks, tags the merged commit and compiles all three platforms without any
   signing credentials.
4. After a maintainer approves, each platform is signed and verified (Apple notarization, Windows Authenticode,
   the updater signatures) and uploaded to a draft GitHub release.
5. After a second approval, the manifest and every updater signature are checked against the public key in
   `tauri.conf.json`, the GitHub release is published, and the files go to `dl.hydian.org`, where the download page
   and the in-app updater find them.

Release automation never commits to `main`. A push that changes dependencies without a new version does not
release. If a run fails, fix the cause and rerun the failed jobs in the same run; a fix that needs new code needs
a new version.

## Signing

The updater key signs every update; its public half is in `apps/desktop/src-tauri/tauri.conf.json`. Replacing
the key would stop installed copies from accepting updates, so it never changes without a migration.

Forks and local builds are unsigned or ad-hoc signed. Signing identifies the publisher to Windows and macOS; it
does not give an app SmartScreen reputation on day one.

## Before calling a release verified

CI does not replace a real installation. Download the final files through a browser onto clean Windows, Apple
Silicon and Intel machines, keep macOS quarantine intact, and test installation, first launch, offline launch, an
update from the previous version, restart and uninstall.

Installed Hydian checks for updates about 15 seconds after start and every six hours, downloads an available
update and offers a restart. Manual checking is under **Settings → About**. The browser preview and development
builds skip update checks.
