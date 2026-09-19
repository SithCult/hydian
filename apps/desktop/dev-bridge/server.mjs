// Dev-only bridge: gives the browser build the same read-only file primitives
// that Tauri's plugin-fs provides in the packaged app. Nothing here can write.
// Access is jailed to the two folders the game writes to.
import http from "node:http";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";

const HOME = os.homedir();
const ROOTS = crossoverRoots() ?? {
  documents: path.join(HOME, "Documents", "Star Wars - The Old Republic"),
  localData: path.join(process.env.LOCALAPPDATA ?? path.join(HOME, "AppData", "Local"), "SWTOR"),
};

// On a Mac the game runs in a CrossOver / Whisky bottle; mirror src/core/fs.ts and pick the first bottle with logs.
function crossoverRoots() {
  if (process.platform !== "darwin") return null;
  const dirs = (p) => {
    try {
      return fsSync
        .readdirSync(p, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => path.join(p, e.name));
    } catch {
      return [];
    }
  };
  for (const root of [
    "Library/Application Support/CrossOver/Bottles",
    "Library/Containers/com.isaacmarovitz.Whisky/Bottles",
  ])
    for (const bottle of dirs(path.join(HOME, root)))
      for (const user of dirs(path.join(bottle, "drive_c/users"))) {
        const documents = path.join(user, "Documents/Star Wars - The Old Republic");
        if (dirs(documents).some((d) => d.endsWith("CombatLogs")))
          return { documents, localData: path.join(user, "AppData/Local/SWTOR") };
      }
  return null;
}
const PORT = 8790;

function inJail(p) {
  const r = path.resolve(p);
  return Object.values(ROOTS).some((root) => r === root || r.startsWith(root + path.sep));
}

const json = (res, code, body) => {
  res.writeHead(code, { "content-type": "application/json", "access-control-allow-origin": "*" });
  res.end(JSON.stringify(body));
};

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    const p = url.searchParams.get("path") ?? "";
    try {
      if (url.pathname === "/bridge/roots") return json(res, 200, ROOTS);
      if (!inJail(p)) return json(res, 403, { error: "outside SWTOR folders" });

      if (url.pathname === "/bridge/readDir") {
        const entries = await fs.readdir(p, { withFileTypes: true });
        const filter = url.searchParams.get("filter") ? new RegExp(url.searchParams.get("filter"), "i") : null;
        const out = [];
        for (const e of entries) {
          if (!e.isFile()) {
            out.push({ name: e.name, isDir: true, size: 0, mtime: 0 });
            continue;
          }
          if (filter && !filter.test(e.name)) {
            out.push({ name: e.name, isDir: false, size: 0, mtime: 0 });
            continue;
          }
          const st = await fs.stat(path.join(p, e.name));
          out.push({ name: e.name, isDir: false, size: st.size, mtime: st.mtimeMs });
        }
        return json(res, 200, out);
      }
      if (url.pathname === "/bridge/stat") {
        const st = await fs.stat(p);
        return json(res, 200, { size: st.size, mtime: st.mtimeMs });
      }
      if (url.pathname === "/bridge/read") {
        const offset = Number(url.searchParams.get("offset") ?? 0);
        const length = Number(url.searchParams.get("length") ?? 4 * 1024 * 1024);
        const fh = await fs.open(p, "r"); // 'r' = read-only, share-read on Windows
        try {
          const buf = Buffer.alloc(length);
          const { bytesRead } = await fh.read(buf, 0, length, offset);
          res.writeHead(200, { "content-type": "application/octet-stream", "access-control-allow-origin": "*" });
          res.end(buf.subarray(0, bytesRead));
        } finally {
          await fh.close();
        }
        return;
      }
      json(res, 404, { error: "unknown" });
    } catch (e) {
      json(res, 500, { error: String(e.message ?? e) });
    }
  })
  .listen(PORT, "127.0.0.1", () => console.log(`[bridge] read-only on http://127.0.0.1:${PORT}  roots=`, ROOTS));
