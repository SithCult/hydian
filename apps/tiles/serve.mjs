// Tiny static server for the map artwork: immutable cache headers, CORS, nothing else.
import { createServer } from "node:http";
import { createReadStream, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("./", import.meta.url));
const TYPES = { ".webp": "image/webp", ".png": "image/png", ".json": "application/json", ".svg": "image/svg+xml" };

/** Every artwork file under maps/ and icons/, by the URL path it is served at. The server opens nothing else. */
export function indexArtwork(root) {
  const files = new Map();
  for (const dir of ["maps", "icons"]) {
    let entries;
    try {
      entries = readdirSync(join(root, dir), { recursive: true, withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const type = TYPES[extname(entry.name).toLowerCase()];
      if (!entry.isFile() || !type) continue;
      const path = join(entry.parentPath, entry.name);
      files.set("/" + relative(root, path).split(sep).join("/"), { path, type, size: statSync(path).size });
    }
  }
  return files;
}

/** The indexed file a request names, or null. */
export function lookup(index, rawUrl) {
  try {
    return index.get(decodeURIComponent((rawUrl ?? "/").split("?")[0])) ?? null;
  } catch {
    return null; // a malformed escape names nothing
  }
}

const ARTWORK = indexArtwork(ROOT);

export const server = createServer((req, res) => {
  const path = (req.url ?? "/").split("?")[0];
  if (path === "/healthz") {
    res.writeHead(200, { "content-type": "text/plain" });
    return res.end("ok");
  }
  if (path === "/" || path === "/NOTICE.txt") {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" });
    return createReadStream(join(ROOT, "NOTICE.txt")).pipe(res);
  }
  const file = lookup(ARTWORK, req.url);
  if (!file) {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, {
    "content-type": file.type,
    "content-length": file.size,
    "cache-control": "public, max-age=31536000, immutable",
    "access-control-allow-origin": "*",
  });
  if (req.method === "HEAD") return res.end();
  createReadStream(file.path).pipe(res);
});

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  server.listen(Number(process.env.PORT ?? 8080), "0.0.0.0");
