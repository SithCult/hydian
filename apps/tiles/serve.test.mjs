import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { artworkPath } from "./serve.mjs";

const ROOT = fileURLToPath(new URL("./", import.meta.url));

test("serves artwork inside maps/ and icons/", () => {
  assert.equal(artworkPath("/maps/137438953622/floor01.webp"), resolve(ROOT, "maps", "137438953622", "floor01.webp"));
  assert.equal(artworkPath("/icons/planets/korriban.PNG?v=2"), resolve(ROOT, "icons", "planets", "korriban.PNG"));
});

test("refuses every path that leaves the artwork folders", () => {
  for (const url of [
    "/maps/..%5C..%5Cetc%5Calpine-release",
    "/maps/..%5C..%5Cetc%5Clogo.png",
    "/maps/../../etc/logo.png",
    "/maps/%2e%2e/%2e%2e/etc/logo.png",
    "/icons/..%2f..%2fserve.webp",
    "/maps/a%00.webp",
    "/serve.mjs",
    "/maps",
  ])
    assert.equal(artworkPath(url), null, url);
});

test("refuses files that are not artwork, even inside the folders", () => {
  assert.equal(artworkPath("/maps/notes.txt"), null);
  assert.equal(artworkPath("/icons/run.sh"), null);
});

test("a malformed escape is a miss, not a crash", () => {
  assert.equal(artworkPath("/maps/%E0%A4%A.webp"), null);
});

test("a sibling folder that starts with the same name is not served", () => {
  assert.equal(artworkPath("/maps-extra/x.webp"), null);
});
