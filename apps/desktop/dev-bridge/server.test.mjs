import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createBridge } from "./server.mjs";

async function fixture(t, redirectRoot = false) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hydian-bridge-"));
  let server;
  t.after(async () => {
    if (server?.listening)
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await fs.rm(dir, { recursive: true, force: true });
  });
  const documents = path.join(dir, "documents");
  const localData = path.join(dir, "settings");
  await fs.mkdir(documents);
  await fs.mkdir(localData);
  const log = path.join(documents, "combat_test.txt");
  await fs.writeFile(log, "synthetic combat log");
  await fs.writeFile(path.join(localData, "PlayerGUIState.ini"), "synthetic settings");
  let root = documents;
  if (redirectRoot) {
    root = path.join(dir, "redirected-documents");
    await fs.symlink(documents, root, "junction");
  }
  server = createBridge({ documents: root, localData });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  const request = (endpoint, query = {}, headers = {}, method = "GET") =>
    new Promise((resolve, reject) => {
      const req = http.request(
        { hostname: "127.0.0.1", port, path: `/bridge/${endpoint}?${new URLSearchParams(query)}`, headers, method },
        (res) => {
          const chunks = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () =>
            resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }),
          );
        },
      );
      req.on("error", reject);
      req.end();
    });
  return { dir, documents, localData, log, root, request };
}

test("the local preview reads game files and bounded byte ranges", async (t) => {
  const { request, documents, localData, log } = await fixture(t);
  const roots = await request("roots", {}, { Origin: "http://localhost:1420" });
  assert.equal(roots.status, 200);
  assert.deepEqual(JSON.parse(roots.body), { documents, localData });
  assert.equal(roots.headers["access-control-allow-origin"], undefined);
  assert.equal(roots.headers["cache-control"], "no-store");
  const list = await request("readDir", { path: documents });
  assert.equal(list.status, 200);
  assert.equal(JSON.parse(list.body)[0].name, "combat_test.txt");
  const read = await request("read", { path: log, offset: "10", length: "6" });
  assert.equal(read.status, 200);
  assert.equal(read.body, "combat");
  assert.equal((await request("stat", { path: path.join(localData, "PlayerGUIState.ini") })).status, 200);
});

test("remote origins, DNS rebinding hosts and cross-site requests are denied before listing roots", async (t) => {
  const { request } = await fixture(t);
  for (const headers of [
    { Origin: "https://untrusted.example" },
    { Origin: "null" },
    { Host: "untrusted.example:8790" },
    { "Sec-Fetch-Site": "cross-site" },
  ]) {
    const response = await request("roots", {}, headers);
    assert.equal(response.status, 403);
    assert.equal(response.headers["access-control-allow-origin"], undefined);
  }
  assert.equal((await request("roots", {}, {}, "POST")).status, 405);
});

test("paths outside game roots, disallowed files and directories cannot be read", async (t) => {
  const { request, dir, documents } = await fixture(t);
  const outside = path.join(dir, "combat_private.txt");
  const text = path.join(documents, "private.txt");
  const directory = path.join(documents, "combat_directory.txt");
  await fs.writeFile(outside, "synthetic private data");
  await fs.writeFile(text, "synthetic private data");
  await fs.mkdir(directory);
  for (const file of [outside, text, directory, path.join(documents, "..", "combat_private.txt")]) {
    assert.equal((await request("read", { path: file })).status, 403);
    assert.equal((await request("stat", { path: file })).status, 403);
  }
  assert.equal((await request("readDir", { path: dir })).status, 403);
  assert.equal((await request("read", { path: "combat_test.txt" })).status, 403);
});

test(
  "symlinks cannot escape the allowed roots or disguise a different file type",
  { skip: process.platform === "win32" },
  async (t) => {
    const { request, dir, documents } = await fixture(t);
    const outside = path.join(dir, "combat_private.txt");
    const disguised = path.join(documents, "private.txt");
    await fs.writeFile(outside, "synthetic private data");
    await fs.writeFile(disguised, "synthetic private data");
    const escape = path.join(documents, "combat_escape.txt");
    const alias = path.join(documents, "combat_alias.txt");
    await fs.symlink(outside, escape);
    await fs.symlink(disguised, alias);
    assert.equal((await request("read", { path: escape })).status, 403);
    assert.equal((await request("read", { path: alias })).status, 403);
    const list = JSON.parse((await request("readDir", { path: documents })).body);
    assert.equal(
      list.some((entry) => entry.name === "combat_escape.txt"),
      false,
    );
  },
);

test("a redirected game root remains readable", async (t) => {
  const { request, root } = await fixture(t, true);
  const result = await request("read", { path: path.join(root, "combat_test.txt") });
  assert.equal(result.status, 200);
  assert.equal(result.body, "synthetic combat log");
});

test("negative, fractional, unsafe and oversized reads are rejected", async (t) => {
  const { request, log } = await fixture(t);
  for (const range of [
    { length: "-1" },
    { length: "8388609" },
    { length: "NaN" },
    { length: "Infinity" },
    { length: "1.5" },
    { offset: "-1" },
    { offset: "1.5" },
    { offset: "9007199254740992" },
  ])
    assert.equal((await request("read", { path: log, ...range })).status, 400);
  assert.equal((await request("read", { path: log, length: "0" })).body, "");
  assert.equal((await request("read", { path: log, offset: "1000", length: "1" })).body, "");
});

test("missing directories and a file selected as a folder expose distinct stable codes", async (t) => {
  const { request, documents, log } = await fixture(t);
  const missing = await request("readDir", { path: path.join(documents, "CombatLogs") });
  assert.equal(missing.status, 404);
  assert.equal(JSON.parse(missing.body).code, "not-found");
  const notDirectory = await request("readDir", { path: log });
  assert.equal(JSON.parse(notDirectory.body).code, "not-directory");
});
