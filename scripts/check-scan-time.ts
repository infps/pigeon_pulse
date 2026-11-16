// Self-check for scan-time parsing + Vincenty distance. Run: npx tsx scripts/check-scan-time.ts
import assert from "node:assert/strict";
import { parseScanTime } from "../src/lib/scan-time";
import { haversine } from "../src/lib/geo";

const iso = "2026-11-15T10:20:30.456Z";
assert.equal(parseScanTime(iso)?.toISOString(), iso);
assert.equal(parseScanTime(Date.parse(iso))?.toISOString(), iso);
assert.equal(parseScanTime(String(Date.parse(iso)))?.toISOString(), iso);
assert.equal(parseScanTime("20261115102030456")?.toISOString(), iso); // compact 17, UTC
assert.equal(parseScanTime("20261115102030")?.toISOString(), "2026-11-15T10:20:30.000Z"); // compact 14
assert.equal(parseScanTime(""), null);
assert.equal(parseScanTime(undefined), null);
assert.equal(parseScanTime("garbage"), null);

// Vincenty's own test case: Flinders Peak → Buninyong = 54,972.271 m.
const d = haversine(-37.95103341666667, 144.42486788888888, -37.65282113888889, 143.92649552777777);
assert.ok(Math.abs(d.km - 54.972) <= 0.001, `km ${d.km}`);
assert.ok(Math.abs(d.miles - 54.972271 / 1.609344) <= 0.001, `miles ${d.miles}`);
assert.deepEqual(haversine(10, 20, 10, 20), { km: 0, miles: 0 });
assert.ok(haversine(0, 0, 0.5, 179.7).km > 19000); // near-antipodal falls back, no crash

console.log("check-scan-time: ok", d);
