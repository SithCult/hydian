# Run Hydian locally

Use Node.js 24, pnpm 11.25.0 (the version in `package.json`), and `pnpm install --frozen-lockfile`.
With nvm, `nvm install` selects the version in `.nvmrc`. Native builds also need Rust 1.95 or later and
[Tauri's platform prerequisites](https://v2.tauri.app/start/prerequisites/): Xcode Command Line Tools
on macOS; the C++ build tools and WebView2 on Windows. Browser previews only need Node and pnpm.

## Website

```sh
pnpm web
```

Open <http://localhost:4321>. `pnpm -F @hydian/web build` exports the website to `apps/web/out` for a static
host with clean URL support. After building, `pnpm -F @hydian/web start` serves that export on port 4321.
Stop `pnpm web` first because it uses the same port.

The hosted download metadata permits browser requests from `https://www.hydian.org` and `https://hydian.org`, but not
localhost.
Local download buttons still work; version and file-size labels are omitted when that request is unavailable.

## Desktop app

```sh
pnpm dev
```

This starts the native Tauri window and its Vite development server. It respects `CARGO_HOME` when Rust is
installed outside the usual location. Development startup does not register the app for launch at login or
download release updates.

For a browser preview instead:

```sh
pnpm preview
```

Open <http://localhost:1420>. Native and browser development both use port 1420; run one at a time. The browser
preview starts a read-only bridge on `127.0.0.1:8790` for the detected game folders. Native features such as
the tray, overlay, autostart and updater require the desktop app.

The existing <http://localhost:1420/?demo=1> demo uses synthetic characters and skips reading game logs.
Use it for screenshots and UI work. Game artwork loads from the hosted tiles service in both development
and release builds. To use your own artwork, set `VITE_ASSET_BASE=/` and populate `apps/desktop/public`.
See `GAME-CONTENT.md` for the artwork's separate rights.

## Local API and database

The desktop defaults to the hosted API. For a completely separate backend, create a local PostgreSQL 17
database named `hydian`, copy `apps/api/.env.example` to `apps/api/.env`, and set `DATABASE_URL` for that database.
Then run:

```sh
pnpm api
```

The API applies its schema and listens on port 8080. <http://localhost:8080/healthz> checks the database connection.
For a remote database, certificate validation is enabled; supply your provider's trusted CA as needed.
`PGSSLMODE=disable` is intended for a trusted local/private connection.
Use a direct PostgreSQL connection or a pooler in session mode. Upload and deletion ordering uses session
advisory locks, which require the same database session throughout each operation.

Copy `apps/desktop/.env.example` to `apps/desktop/.env.development.local` so `VITE_SERVER_URL=http://localhost:8080`,
then restart `pnpm dev` or `pnpm preview`. Installer builds ignore that file and always use the hosted API, which is
the only one their content security policy allows. Website environment overrides live in `apps/web/.env.example`. Values prefixed
with `VITE_` or `NEXT_PUBLIC_` are public client configuration; keep credentials in the API environment.

## Checks

Create a separate test database and set `TEST_DATABASE_URL` before running the suite. API tests create and
drop a unique schema in that database. Use synthetic data throughout.

```sh
pnpm typecheck
pnpm lint
pnpm format:check
TEST_DATABASE_URL=postgresql://localhost:5432/hydian_test pnpm test
pnpm build
cd apps/desktop/src-tauri
cargo fmt --check
cargo test --locked
cargo clippy --locked --all-targets -- -D warnings
```

`pnpm test:bridge` and `pnpm test:desktop` run without PostgreSQL. CI provisions PostgreSQL for the API tests
and, when a change touches the app, builds Windows x64, macOS Apple Silicon and Intel installers. Building an installer is separate from
operating-system signing and clean-machine install/update validation; see `RELEASING.md`.
