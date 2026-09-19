# tiles service

Static server for the map artwork (`apps/desktop/public/maps`, `apps/desktop/public/icons`): the hosted service
**tiles**, referenced by `ASSET_BASE` in `apps/desktop/src/data/maps.ts`. `serve.mjs` serves the two folders with
immutable cache headers and CORS; `Dockerfile` copies them next to it. The artwork is not in git, so the image is
built from a folder that holds it, not from this repository.

`NOTICE.txt` is served at `/` and `/NOTICE.txt`: the artwork is the game's, see `GAME-CONTENT.md` at the repository root.
