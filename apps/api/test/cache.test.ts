import assert from "node:assert/strict";
import { test } from "node:test";
import { TtlCache } from "../src/cache.ts";

test("an invalidated query cannot refill the cache after deletion", () => {
  const cache = new TtlCache<string>(60_000);
  const generation = cache.generation;
  cache.set("server", "old profile");
  cache.clear();
  assert.equal(cache.set("server", "old profile", generation), "old profile");
  assert.equal(cache.get("server"), undefined);
  cache.set("server", "current profile", cache.generation);
  assert.equal(cache.get("server"), "current profile");
});

test("expired entries cannot be served and inserts evict stale entries before fresh ones", (t) => {
  let now = 0;
  t.mock.method(Date, "now", () => now);
  const cache = new TtlCache<number>(100);
  for (let i = 0; i < 512; i++) cache.set(String(i), i);
  now = 50;
  cache.set("0", 999);
  now = 100;
  assert.equal(cache.get("1"), undefined);
  cache.set("new", 42);
  assert.equal(cache.get("0"), 999);
  assert.equal(cache.get("new"), 42);
  now = 200;
  assert.equal(cache.get("new"), undefined);
});

test("distinct request keys cannot grow a cache beyond 512 fresh entries", () => {
  const cache = new TtlCache<number>(60_000);
  for (let i = 0; i < 1024; i++) cache.set(String(i), i);
  for (let i = 0; i < 512; i++) assert.equal(cache.get(String(i)), undefined);
  for (let i = 512; i < 1024; i++) assert.equal(cache.get(String(i)), i);
});
