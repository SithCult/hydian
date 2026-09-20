# Hydian

**Where roleplay is happening in _Star Wars: The Old Republic_.**

A desktop companion for roleplayers. Pick a server and a planet and see who is In Character where, on the game's
own maps, down to the floor of the building. Set your status, flag that you are looking for RP, keep friends, notes
and a journal. Hydian reads the combat log the game writes and needs no account.

[hydian.org](https://hydian.org) · [Download](https://hydian.org/download) ·
[Discussions](https://github.com/SithCult/hydian/discussions)

## Features

- **Live map**: you and everyone who shares their position, on the in-game artwork: planet maps, regions and
  every interior floor, with the game's names. Floors come from the log's height ("Nar Shaddaa › Lower
  Promenade"); stacked floors show one level at a time, or all of them in the 3D view.
- **Status**: _In Character_, _Out of Character_ or _Invisible_, a _Looking for RP_ beacon and the server
  instance you are in. Sharing is per character and starts Invisible.
- **Registry**: everyone sharing a character on your server, where they are and when they were last active.
  Players your log mentions who are not on Hydian show as a name and a last-seen.
- **Friends, notes, journal**: friend the people you play with; names on your in-game friends lists come across
  on their own (read only, the game's lists are never written). Notes on characters (your in-game notes are
  imported) and a rich-text journal of your character's story, both stored on your device.
- **Heat map & activity**: where and when roleplay happens on a server, as counts per area and hour, shown
  once ten different players have contributed.
- **In-game overlay**: a transparent, click-through card over the game: who is on Hydian near you, LFRP
  beacons, instance numbers, your floor. `Ctrl+Shift+O` toggles it, `Ctrl+Shift+L` locks it.
- **Always on**: starts at login, lives in the tray, follows the log while you play.

Others see a name, a faction, a status and a place. Profiles have no free text and no class.

## Roadmap

**Now:** Windows and macOS (Apple Silicon and Intel), live map, registry, overlay, friends, notes, journal, heat
map and activity, automatic updates.

**Next:** more planets and interiors, localisation.

**With enough support:** verified characters and optional accounts, a guild registry, guild tools (rosters, events,
recruitment) and a Discord integration that posts who is in character to your server. All in this repository.

## How it is made

<a href="https://madebyhuman.iamjarl.com/"><img src=".github/badges/co-created-with-ai.svg" alt="Co-created with AI" height="40"></a>
<a href="https://madebyhuman.iamjarl.com/"><img src=".github/badges/human-in-the-loop.svg" alt="Human in the Loop" height="40"></a>

Made by humans, crafted with AI. We were developers before the AI boom and still hold our work to that standard.
AI tools help us build faster; the design, the decisions and the final word are ours. Every feature was planned,
reviewed and tested by a person. We firmly stand against soulless AI slop, and that applies to contributions too:
a pull request is welcome when it is understood, tested and written with care, whatever tool helped write it.
See [CONTRIBUTING.md](CONTRIBUTING.md).

The badges are from [Made by Human](https://github.com/JarlLyng/madebyhuman) (MIT).

## Repository

One monorepo, MIT licensed:

```
apps/desktop   Tauri 2 (Rust) + React: the app
apps/api       Fastify 5 + Postgres (Node 24)
apps/web       hydian.org (Next.js)
apps/tiles     artwork-serving tools (map images are supplied separately)
```

The map artwork, planet icons and emblems are BioWare/EA assets and are not part of this repository or its licence:
see [GAME-CONTENT.md](GAME-CONTENT.md). The app loads artwork from `https://tiles.hydian.org/`, configurable with
`VITE_ASSET_BASE`. `apps/desktop/src/data/maps.json` and `apps/desktop/src/data/planet-icons.json` carry only the
metadata (names, ids, bounds, file names). Local development uses the hosted artwork without starting a separate
artwork server. The tools in `apps/tiles` need artwork supplied outside Git; see [their README](apps/tiles/README.md).

### Running

Use Node.js 24 (see `.nvmrc`) and the pinned pnpm version. The native app also needs Rust and the
[platform prerequisites](https://v2.tauri.app/start/prerequisites/).

```bash
pnpm install --frozen-lockfile
pnpm dev            # desktop app (needs Rust: https://rustup.rs)
pnpm preview        # browser preview on :1420, log access through a small Node bridge
pnpm api            # backend on :8080 (needs DATABASE_URL)
pnpm web            # website on :4321
pnpm -C apps/desktop tauri build --config '{"bundle":{"createUpdaterArtifacts":false}}'  # local installer
```

Run the website at <http://localhost:4321> and the app preview at <http://localhost:1420> in separate terminals.
`pnpm dev` and `pnpm preview` share port 1420, so choose one. The browser demo at
<http://localhost:1420/?demo=1> uses synthetic characters and skips reading game logs. Tray, overlay, autostart and
update features require the native app.

CI runs types, lint, formatting, JavaScript regressions against an isolated Postgres database, native Rust tests,
and frontend builds, then builds the installers for Windows, macOS
(Apple Silicon) and macOS (Intel) on every pull request and push to `main`. To release, run
`node scripts/bump.mjs patch` (or `minor` / `major`) on a PR branch and commit the version files.
After that PR is merged, CI tags and builds the reviewed commit. Publication requires
maintainer approval and successful signing, notarization and updater-signature checks for every platform.

The app defaults to the hosted Hydian backend and artwork. For a local API, create a PostgreSQL database, copy
`apps/api/.env.example` to `apps/api/.env`, and set `DATABASE_URL` before starting `pnpm api`. Then copy
`apps/desktop/.env.example` to `apps/desktop/.env` and restart the app to use `http://localhost:8080`.
`VITE_ASSET_BASE=/` uses artwork you provide in `apps/desktop/public/` and includes it in builds.

See [local development](docs/LOCAL-DEVELOPMENT.md) for a full local setup and a synthetic demo, and
[release signing](docs/RELEASING.md) for Apple notarization and Windows signing.

### Game folders

Windows: logs in `%USERPROFILE%\Documents\Star Wars - The Old Republic\CombatLogs`, characters from
`%LOCALAPPDATA%\SWTOR\swtor\settings`. On macOS, Hydian looks for the same folders inside CrossOver or Whisky
bottles. If detection misses your installation, use Settings › Game link › _advanced…_ to choose them.
In SWTOR, turn on _Preferences → Combat Logging → Enable Combat Logging to File_, enter combat to create a log,
then choose _Rescan logs_ in Hydian.

### Releases and updates

Releases are cut by CI from `main` (`release.yml`) and land on [hydian.org/download](https://hydian.org/download).
Installed copies check for a new version on start and every six hours, download it in the background and offer a
restart. You can also check in Settings › About or the native Help menu. Updates are signed; the public key is in
`apps/desktop/src-tauri/tauri.conf.json`. macOS gets native traffic lights, an optional menu-bar icon, autostart and
the `⌘⇧O` / `⌘⇧L` shortcuts.

### Branding

`apps/desktop/branding/` holds the mark (`hydian.svg`), the 1024 px icon master and the Icon Composer bundle
(`hydian.icon`, layered for macOS 26). `pnpm -C apps/desktop tauri icon branding/hydian-icon.png -o src-tauri/icons`
regenerates the platform icons; the menu-bar template PNGs are rendered from the SVG. Type: Inter for text, Space
Grotesk for titles, both bundled.

## How it works

**Log format (7.x).** Every line carries `[@Name#id|(x,z,height,heading)|(hp/max)]` for source and target;
`AreaEntered … {areaId} (serverId)` gives the area and server. `core/parser.ts` turns lines into positions, area
changes and sightings; `core/gamelink.ts` scans recent logs on start and tails the newest one. The game logs a
position only when something happens, so a pin can lag while people stand and talk; the map shows the age.

**Coordinates.** Log tuple = `(x, z, height)`, map units = log units / 10. Map images are uniform-scaled to the
longer side of their bounds, centred, min z at the top. A tile drawn over another (room over region, region over
planet) gets an opaque backing so only one artwork shows.

**Uplink** (`core/uplink.ts`). While a character is shared: a ping on login, zone change, movement ≥ 5 m, status
change and every 30 s; players the log mentions go up as sightings. On first start `core/backfill.ts` uploads the
movement history from the logs on disk for shared characters, so the maps have history from day one.

**What the server serves.** Presence and the registry: name, id, server, faction, planet, position while on the map,
status.
Heat and activity: counts from live In-Character pings once ten distinct characters contribute. History uploads
and sightings are stored separately from these public results. `DELETE /v1/me` removes installation links and
replaces identifiers in retained gameplay records (Settings › Privacy); see the privacy page for details.

**Story phases.** Class-story rooms and personal hangars are instanced and hidden by default (Settings › Map).
Classic planets are classified from the game's map notes; expansion planets from a hand-kept override list. Both
end up as the `phase` flags in `src/data/maps.json`.

**Factions.** Planets one side cannot visit (the fleets, Dromund Kaas and Coruscant, the origin worlds) carry a
faction badge in the planet list, and Balmorra and Taris exist as two worlds with separate area ids, listed once per
faction. A character's own faction comes from its class. The server instance is set by hand; the log does not carry
it.

## Artwork

The maps are the game's own map textures (`<map>_r.dds`, 1024², one per floor), the planet icons and faction emblems
its galaxy-map art, converted to WebP once per game patch and served by the tiles service with immutable cache
headers. Each map's world bounds (x/z) and height range come from the game's map table and sit next to the file name
in `src/data/maps.json`; that is what turns a combat-log position into a dot on the right floor. The conversion
happens on our side and is not part of this repository; the app never touches the game's files for it.

You do not need any of it to work on Hydian: a clone loads the artwork from the hosted tiles service, in development
too. To add a planet or an interior that has no map yet, open an issue with the area id from the log and we add the
tile and its entry in `maps.json`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md). Code: [MIT](LICENSE). Game artwork:
[GAME-CONTENT.md](GAME-CONTENT.md).

Hydian is a fan project by [SithCult](https://github.com/SithCult), not affiliated with Electronic Arts, BioWare,
Broadsword or Lucasfilm. Star Wars: The Old Republic and related marks belong to their owners.
