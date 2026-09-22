# Contributing to Hydian

Three rules shape every change:

1. **The game link reads.** Native game-file access is limited to reading combat logs and `.ini` files.
   Hydian never writes into game folders.
2. **Profiles are a name, a status and a place.** Notes and the journal are the place for text, and they stay
   on the device.
3. **No slop.** Use whatever tools you like, AI included; we do. What you open a pull request with has to be
   code you understand, have run, and can defend line by line. Generated changes you have not read, padding,
   drive-by rewrites and "improvements" nobody asked for are closed without review.

## Layout

| Path                               | What                                                                                                             |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `apps/desktop/src`                 | React + TypeScript client. `core/` = parser, game link, uplink, backfill, notes; `data/` = planets, maps; `ui/`   |
| `apps/desktop/src-tauri`           | Tauri 2 shell (Rust): file commands, tray, autostart, overlay window                                              |
| `apps/desktop/branding`            | The mark, the icon master and the macOS Icon Composer bundle                                                     |
| `apps/api`                         | Fastify + Postgres backend. `routes/` one file per concern, `schemas.ts` the payloads, `presence.ts` the live map |
| `apps/web`                         | hydian.org: Next.js (App Router, static export), motion, CSS modules                                            |
| `apps/desktop/public/{maps,icons}` | BioWare/EA artwork, git-ignored and not part of the repository; the app loads it from the tiles service        |

Optional artwork-hosting tools live in [`apps/tiles`](apps/tiles/README.md). They require separately supplied
images and are not needed for local app, API or website development.

## Running

Use Node.js 24 and the pnpm version pinned in `package.json`. See [local development](docs/LOCAL-DEVELOPMENT.md)
for platform prerequisites, environment files, a local PostgreSQL backend and synthetic demo data.

```bash
pnpm install
pnpm preview        # browser preview on :1420 (Node bridge instead of Tauri, no overlay)
pnpm dev            # desktop app (needs Rust)
pnpm api            # backend, needs DATABASE_URL
pnpm web            # website
```

## Before a pull request

Use a branch and pull request for changes, including maintainer changes. Keep each PR focused and wait for review
and green CI before merging. Releases are built from `main` after merge.

```bash
pnpm typecheck && pnpm lint && pnpm format:check
TEST_DATABASE_URL=postgresql://localhost:5432/hydian_test pnpm test
```

CI runs the same. When a change touches the app, it also runs `cargo fmt --check`, `cargo clippy -D warnings`
and a full installer build on Windows, macOS (Apple Silicon) and macOS (Intel). Rust is formatted with rustfmt (`cargo fmt` in `apps/desktop/src-tauri`),
everything else with Prettier (`pnpm format`).

Fill in the [PR template](.github/PULL_REQUEST_TEMPLATE.md) with the behavior change and actual check results.
For UI or workflow changes, exercise the affected flow with the Playwright CLI and attach clear screenshots with
short scenario captions. Use synthetic demo data and include the command you ran. Native-only behavior also needs
native app verification. Explain any unavailable check; for non-visual changes, mark visual proof not applicable.

## Style

- Small files, one concern each. Comments say _why_.
- UI wording is plain: "device", not "installation"; no ids or status keys on screen. Anything the user can lose
  asks first, unless it is empty.
- Menus and popovers close on outside click and Escape.
- zustand selectors that build arrays or objects are memoised (`selectors.ts`): a fresh value on every call makes
  `useSyncExternalStore` loop.
- Keep character names, positions and logs out of the repository: tests, fixtures and screenshots included.

## Assets

Maps, planet icons and faction emblems are BioWare/EA/Lucasfilm artwork from the game client. The repository holds
neither the artwork nor the conversion; see [GAME-CONTENT.md](GAME-CONTENT.md). Do not commit images from the game,
and keep the tiles service's `NOTICE.txt` current.
