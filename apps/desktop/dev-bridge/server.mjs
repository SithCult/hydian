// Read-only game-file access for the local browser preview.
import http from "node:http";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const userHome = os.homedir();
function defaultRoots() {
  return (
    crossoverRoots() ?? {
      documents: path.join(userHome, "Documents", "Star Wars - The Old Republic"),
      localData: path.join(process.env.LOCALAPPDATA ?? path.join(userHome, "AppData", "Local"), "SWTOR"),
    }
  );
}

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
    for (const bottle of dirs(path.join(userHome, root)))
      for (const user of dirs(path.join(bottle, "drive_c/users"))) {
        const documents = path.join(user, "Documents/Star Wars - The Old Republic");
        if (dirs(documents).some((d) => d.endsWith("CombatLogs")))
          return { documents, localData: path.join(user, "AppData/Local/SWTOR") };
      }
  return null;
}
const PORT = 8790;
const MAX_READ = 8 * 1024 * 1024;
const PREVIEW_ORIGINS = new Set(["http://localhost:1420", "http://127.0.0.1:1420", "http://[::1]:1420"]);
const ENDPOINTS = new Set(["/bridge/roots", "/bridge/readDir", "/bridge/stat", "/bridge/read"]);

function within(file, root) {
  const relative = path.relative(root, file);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

const json = (res, code, body) => {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

const fail = (status, message) => Object.assign(new Error(message), { status });
const allowedName = (file) =>
  /^(?:combat_.*\.txt|.*(?:PlayerGUIState|LocalSocialSettings)\.ini)$/i.test(path.basename(file));

export function createBridge(roots = defaultRoots()) {
  async function checkedPath(requested, file = false) {
    if (!requested || !path.isAbsolute(requested)) throw fail(403, "outside SWTOR folders");
    const resolved = await fs.realpath(requested);
    // Resolve roots too: CrossOver and redirected Documents folders may themselves be symlinks.
    const canonicalRoots = await Promise.all(Object.values(roots).map((root) => fs.realpath(root).catch(() => null)));
    if (!canonicalRoots.some((root) => root && within(resolved, root))) throw fail(403, "outside SWTOR folders");
    if (file && (!allowedName(requested) || !allowedName(resolved))) throw fail(403, "not a combat log or character settings file");
    if (file && !(await fs.stat(resolved)).isFile()) throw fail(403, "not a regular file");
    return resolved;
  }

  const server = http.createServer(async (req, res) => {
    try {
      const port = server.address().port;
      if (!["localhost", "127.0.0.1", "[::1]"].some((host) => req.headers.host === `${host}:${port}`))
        return json(res, 403, { error: "untrusted host" });
      if (
        (req.headers.origin && !PREVIEW_ORIGINS.has(req.headers.origin)) ||
        req.headers["sec-fetch-site"] === "cross-site"
      )
        return json(res, 403, { error: "untrusted origin" });
      if (req.method !== "GET") return json(res, 405, { error: "GET required" });
      const url = new URL(req.url, "http://localhost");
      if (!ENDPOINTS.has(url.pathname)) return json(res, 404, { error: "unknown" });
      res.setHeader("cache-control", "no-store");
      if (url.pathname === "/bridge/roots") return json(res, 200, roots);
      const p = await checkedPath(url.searchParams.get("path"), url.pathname !== "/bridge/readDir");

      if (url.pathname === "/bridge/readDir") {
        // The client only uses ^$ to request names without file metadata.
        const filter = url.searchParams.get("filter");
        if (filter && filter !== "^$") throw fail(400, "unsupported directory filter");
        const entries = await fs.readdir(p, { withFileTypes: true });
        const out = [];
        for (const e of entries) {
          if (e.isSymbolicLink()) {
            try {
              const target = await checkedPath(path.join(p, e.name));
              const st = await fs.stat(target);
              out.push({ name: e.name, isDir: st.isDirectory(), size: 0, mtime: 0 });
            } catch {
              // A link outside the game folders is not part of the preview's file access.
            }
            continue;
          }
          if (!e.isFile()) {
            out.push({ name: e.name, isDir: true, size: 0, mtime: 0 });
            continue;
          }
          if (filter) {
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
        if (!st.isFile()) throw fail(403, "not a regular file");
        return json(res, 200, { size: st.size, mtime: st.mtimeMs });
      }
      if (url.pathname === "/bridge/read") {
        const offset = Number(url.searchParams.get("offset") ?? 0);
        const length = Number(url.searchParams.get("length") ?? 4 * 1024 * 1024);
        if (
          !Number.isSafeInteger(offset) ||
          offset < 0 ||
          !Number.isSafeInteger(length) ||
          length < 0 ||
          length > MAX_READ
        )
          throw fail(400, "invalid byte range (maximum 8 MiB)");
        const fh = await fs.open(p, "r"); // 'r' = read-only, share-read on Windows
        try {
          if (!(await fh.stat()).isFile()) throw fail(403, "not a regular file");
          const buf = Buffer.alloc(length);
          const { bytesRead } = await fh.read(buf, 0, length, offset);
          res.writeHead(200, { "content-type": "application/octet-stream" });
          res.end(buf.subarray(0, bytesRead));
        } finally {
          await fh.close();
        }
        return;
      }
      json(res, 404, { error: "unknown" });
    } catch (e) {
      const code =
        e.code === "ENOENT"
          ? "not-found"
          : e.code === "EACCES" || e.code === "EPERM"
            ? "permission-denied"
            : e.code === "ENOTDIR"
              ? "not-directory"
              : "unavailable";
      const error =
        code === "not-found"
          ? "Folder or file not found."
          : code === "permission-denied" || e.status === 403
            ? "Access denied."
            : code === "not-directory"
              ? "Choose a folder, not a file."
              : e.status === 400
                ? "Invalid request."
                : "Unable to read game files.";
      json(res, e.status ?? (e.code === "ENOENT" ? 404 : 500), { error, code });
    }
  });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  createBridge().listen(PORT, "127.0.0.1", () => console.log(`[bridge] read-only on http://127.0.0.1:${PORT}`));
