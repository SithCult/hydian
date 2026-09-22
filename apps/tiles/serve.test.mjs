import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { indexArtwork, lookup } from "./serve.mjs";

// a synthetic image layout: artwork in maps/ and icons/, other files next to and inside them
const root = fs.mkdtempSync(path.join(os.tmpdir(), "hydian-tiles-"));
const put = (rel, body = "x") => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), body);
};
put("maps/137438953622/floor01.webp", "webp!");
put("icons/planets/korriban.PNG");
put("maps/notes.txt");
put("maps-extra/x.webp");
put("serve.mjs");
put("secret.webp");
const index = indexArtwork(root);
test.after(() => fs.rmSync(root, { recursive: true, force: true }));

test("serves every artwork file under maps/ and icons/, with its type and size", () => {
  const floor = lookup(index, "/maps/137438953622/floor01.webp");
  assert.equal(floor.path, path.join(root, "maps", "137438953622", "floor01.webp"));
  assert.equal(floor.type, "image/webp");
  assert.equal(floor.size, 5);
  assert.equal(lookup(index, "/icons/planets/korriban.PNG?v=2").type, "image/png");
  assert.equal(index.size, 2);
});

test("a request can only name an indexed file", () => {
  for (const url of [
    "/maps/..%5C..%5Csecret.webp",
    "/maps/../secret.webp",
    "/maps/%2e%2e/secret.webp",
    "/icons/..%2f..%2fserve.mjs",
    "/maps/notes.txt",
    "/maps-extra/x.webp",
    "/secret.webp",
    "/maps",
    "/maps//137438953622/floor01.webp",
  ])
    assert.equal(lookup(index, url), null, url);
});

test("a malformed escape is a miss, not a crash", () => {
  assert.equal(lookup(index, "/maps/%E0%A4%A.webp"), null);
});

test("an image without artwork folders serves nothing", () => {
  assert.equal(indexArtwork(path.join(root, "missing")).size, 0);
});
