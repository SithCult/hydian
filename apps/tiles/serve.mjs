// Tiny static server for the map artwork: immutable cache headers, CORS, nothing else.
import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { join, normalize, extname } from "node:path";
const ROOT = new URL("./", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const TYPES = { ".webp": "image/webp", ".png": "image/png", ".json": "application/json", ".svg": "image/svg+xml" };
createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
  if (url === "/healthz") {
    res.writeHead(200, { "content-type": "text/plain" });
    return res.end("ok");
  }
  if (url === "/" || url === "/NOTICE.txt") {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" });
    return createReadStream(join(ROOT, "NOTICE.txt")).pipe(res);
  }
  const rel = normalize(url)
    .split("\\")
    .join("/")
    .replace(/^(\.\.\/)+/, "");
  if (!/^\/(maps|icons)\//.test(rel)) {
    res.writeHead(404);
    return res.end();
  }
  const file = join(ROOT, rel);
  let st;
  try {
    st = statSync(file);
  } catch {
    res.writeHead(404);
    return res.end();
  }
  if (!st.isFile()) {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, {
    "content-type": TYPES[extname(file)] ?? "application/octet-stream",
    "content-length": st.size,
    "cache-control": "public, max-age=31536000, immutable",
    "access-control-allow-origin": "*",
  });
  if (req.method === "HEAD") return res.end();
  createReadStream(file).pipe(res);
}).listen(Number(process.env.PORT ?? 8080), "0.0.0.0");
