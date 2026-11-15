/**
 * Self-check for src/lib/ttl-cache.ts. No DB, no server.
 *
 *   bun scripts/verify-ttl-cache.ts
 */
import assert from "node:assert/strict";
import { cached, invalidate, raceKey } from "../src/lib/ttl-cache";

async function main() {
  let calls = 0;
  const load = () => { calls++; return Promise.resolve(calls); };

  // Hit within TTL; concurrent misses share one call.
  const [a, b] = await Promise.all([cached("race:1:items", 1000, load), cached("race:1:items", 1000, load)]);
  assert.equal(a, 1); assert.equal(b, 1); assert.equal(calls, 1);
  assert.equal(await cached("race:1:items", 1000, load), 1);

  // Expiry.
  await cached("race:2:items", 20, load);
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(await cached("race:2:items", 20, load), 3);

  // Prefix invalidation: race 1 cleared, race 12 kept.
  await cached(`${raceKey(12)}items`, 1000, load); // calls = 4
  invalidate(raceKey(1));
  assert.equal(await cached("race:1:items", 1000, load), 5);
  assert.equal(await cached(`${raceKey(12)}items`, 1000, load), 4);

  // Failures are not cached.
  await assert.rejects(cached("race:3:x", 1000, () => Promise.reject(new Error("boom"))));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(await cached("race:3:x", 1000, () => Promise.resolve("ok")), "ok");

  console.log("ttl-cache OK");
}
main();
