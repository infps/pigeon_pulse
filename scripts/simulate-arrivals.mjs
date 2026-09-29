#!/usr/bin/env node
/**
 * simulate-arrivals.mjs
 *
 * Sends bird RFIDs from race 10015 to /api/scanner/push at 200ms intervals,
 * simulating scanner arrivals for testing.
 *
 * Usage:
 *   node scripts/simulate-arrivals.mjs [options]
 *
 * Options:
 *   --url <base>       Base URL of the app (default: http://localhost:3000)
 *   --race <id>        Race ID to pull birds from (default: 10015)
 *   --interval <ms>    Interval between scans in ms (default: 200)
 *   --limit <n>        Max birds to send (default: all)
 *   --dry-run          Print RFIDs without sending
 */

import postgres from "postgres";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    url:      { type: "string", default: "http://localhost:3000" },
    race:     { type: "string", default: "10299" },
    interval: { type: "string", default: "200" },
    limit:    { type: "string", default: "0" },
    "dry-run":{ type: "boolean", default: false },
    cookie:   { type: "string", default: "" },
  },
  strict: false,
});

const BASE_URL  = args.url;
const RACE_ID   = parseInt(args.race);
const INTERVAL  = parseInt(args.interval);
const LIMIT     = parseInt(args.limit);
const DRY_RUN   = args["dry-run"];
const COOKIE    = args.cookie;

const DB_URL =
  "postgresql://neondb_owner:npg_HJhYei78rZCW@ep-nameless-fog-a17fu4q2-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require&connect_timeout=15&pool_timeout=15";

async function fetchRfids(sql) {
  const rows = await sql`
    SELECT b."RF_ID" as rfid, b."BAND" as band, ri.status
    FROM "RaceItem" ri
    JOIN "EventInventoryItem" eii ON eii."ID_EVENT_INVENTORY_ITEM" = ri."ID_INVENTORY_ITEM"
    JOIN "Birds" b ON b."ID_BIRD" = eii."ID_BIRD"
    WHERE ri."ID_RACE" = ${RACE_ID}
      AND b."RF_ID" IS NOT NULL AND b."RF_ID" != ''
    ORDER BY b."RF_ID"
  `;
  return rows;
}

async function sendRfid(rfid, timestamp) {

  const headers = { "Content-Type": "application/json" };
  if (COOKIE) headers["Cookie"] = COOKIE;

  const res = await fetch(`${BASE_URL}/api/admin/race/${RACE_ID}/scan`, {
    method: "POST",
    headers,
    body: JSON.stringify({ ringNo: rfid, timestamp }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const sql = postgres(DB_URL, { ssl: "require" });

  console.log(`Fetching birds for race ${RACE_ID}...`);
  let birds = await fetchRfids(sql);
  await sql.end();

  if (birds.length === 0) {
    console.error("No birds with RFIDs found for that race.");
    process.exit(1);
  }

  if (LIMIT > 0) birds = birds.slice(0, LIMIT);

  console.log(`Found ${birds.length} birds. Sending to ${BASE_URL} at ${INTERVAL}ms intervals.`);
  if (DRY_RUN) {
    console.log("DRY RUN — no requests sent:");
    birds.forEach((b, i) => console.log(`  ${i + 1}. ${b.rfid}  ${b.band}  [${b.status}]`));
    return;
  }

  // Pre-generate timestamps spaced exactly INTERVAL ms apart
  const baseTime = Date.now();
  const timestamps = birds.map((_, i) => {
    const t = new Date(baseTime + i * INTERVAL);
    return t.getUTCFullYear().toString() +
      (t.getUTCMonth() + 1).toString().padStart(2, "0") +
      t.getUTCDate().toString().padStart(2, "0") +
      t.getUTCHours().toString().padStart(2, "0") +
      t.getUTCMinutes().toString().padStart(2, "0") +
      t.getUTCSeconds().toString().padStart(2, "0") +
      t.getUTCMilliseconds().toString().padStart(3, "0");
  });

  let ok = 0, fail = 0;
  for (let i = 0; i < birds.length; i++) {
    const { rfid, band } = birds[i];
    try {
      const result = await sendRfid(rfid, timestamps[i]);
      if (result.ok) {
        ok++;
        console.log(`[${i + 1}/${birds.length}] ✓ ${rfid}  ${band}  → ${JSON.stringify(result.data)}`);
      } else {
        fail++;
        console.log(`[${i + 1}/${birds.length}] ✗ ${rfid}  ${band}  → ${result.status} ${JSON.stringify(result.data)}`);
      }
    } catch (err) {
      fail++;
      console.log(`[${i + 1}/${birds.length}] ✗ ${rfid}  ${band}  → ${err.message}`);
    }
    if (i < birds.length - 1) await sleep(INTERVAL);
  }

  console.log(`\nDone. ${ok} ok, ${fail} failed.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
