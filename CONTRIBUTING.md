# Contributing to Hydian

Three rules shape every change:

1. **The game link reads.** Hydian's native surface is three read-only file commands in
   `apps/desktop/src-tauri/src/lib.rs`, limited to combat logs and `.ini` files. That stays the whole surface.
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
| `apps/tiles`                       | Static server for the map artwork (the hosted tiles service)                                                      |
| `apps/desktop/public/{maps,icons}` | BioWare/EA artwork, git-ignored and not part of the repository; the app loads it from the tiles service        |

## Running

```bash
pnpm install
pnpm preview        # browser preview on :1420 (Node bridge instead of Tauri, no overlay)
pnpm dev            # desktop app (needs Rust)
pnpm api            # backend, needs DATABASE_URL
pnpm web            # website
```

## Before a pull request

```bash
pnpm typecheck && pnpm lint && pnpm format:check
```

CI runs the same, then `cargo fmt --check`, `cargo clippy -D warnings` and a full installer build on Windows,
macOS (Apple Silicon) and macOS (Intel). Rust is formatted with rustfmt (`cargo fmt` in `apps/desktop/src-tauri`),
everything else with Prettier (`pnpm format`).

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
