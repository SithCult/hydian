// Tiny static server for the map artwork: immutable cache headers, CORS, nothing else.
import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("./", import.meta.url));
const SERVED = ["maps", "icons"].map((dir) => resolve(ROOT, dir) + sep);
const TYPES = { ".webp": "image/webp", ".png": "image/png", ".json": "application/json", ".svg": "image/svg+xml" };

/** The artwork file a request names, or null: only known image/data types inside maps/ or icons/. */
export function artworkPath(rawUrl) {
  let url;
  try {
    url = decodeURIComponent((rawUrl ?? "/").split("?")[0]);
  } catch {
    return null;
  }
  // a backslash is a separator only on Windows; refusing it keeps both platforms to the same paths
  if (url.includes("\\") || url.includes("\0") || !TYPES[extname(url).toLowerCase()]) return null;
  const file = resolve(ROOT, "." + url);
  return SERVED.some((dir) => file.startsWith(dir)) ? file : null;
}

const notFound = (res) => {
  res.writeHead(404);
  res.end();
};

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
  const file = artworkPath(req.url);
  if (!file) return notFound(res);
  let st;
  try {
    st = statSync(file);
  } catch {
    return notFound(res);
  }
  if (!st.isFile()) return notFound(res);
  res.writeHead(200, {
    "content-type": TYPES[extname(file).toLowerCase()],
    "content-length": st.size,
    "cache-control": "public, max-age=31536000, immutable",
    "access-control-allow-origin": "*",
  });
  if (req.method === "HEAD") return res.end();
  createReadStream(file).pipe(res);
});

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  server.listen(Number(process.env.PORT ?? 8080), "0.0.0.0");
