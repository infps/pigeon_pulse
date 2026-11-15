/**
 * Hot-query timings straight from Postgres (EXPLAIN ANALYZE, median of 5) and
 * whether each uses an index. Read-only.
 *
 *   node scripts/bench-db.mjs <endedRaceId> <liveRaceId> <seasonId>
 *
 * Uses DATABASE_URL. On the EC2 host run it inside the app container so it
 * reaches RDS:  sudo docker compose cp scripts/bench-db.mjs app:/tmp/ &&
 *   sudo docker compose exec -T app node /tmp/bench-db.mjs 834 10000 15
 */
import { createRequire } from "node:module";

const require = createRequire(process.cwd() + "/");
const pg = require("pg");
const [ended, live, season] = process.argv.slice(2).map(Number);
if (!ended || !live || !season) {
  console.error("usage: node scripts/bench-db.mjs <endedRaceId> <liveRaceId> <seasonId>");
  process.exit(1);
}

const QUERIES = {
  "race items (ended race)": `select * from "RaceItem" where "ID_RACE" = ${ended}`,
  "race items live + status": `select * from "RaceItem" where "ID_RACE" = ${live} and status = 'ARRIVED'`,
  "bird entry -> race items": `select * from "RaceItem" where "ID_INVENTORY_ITEM" = (select "ID_INVENTORY_ITEM" from "RaceItem" where "ID_RACE" = ${ended} limit 1)`,
  "season registrations": `select * from "EventInventory" where "SEASON_ID" = ${season}`,
  "breeder birds": `select * from "Birds" where "breederId" = (select "breederId" from "Birds" where "breederId" is not null limit 1)`,
  "payments by registration": `select * from "Payments" where "ID_EVENT_INVENTORY" = (select "ID_EVENT_INVENTORY" from "EventInventory" where "SEASON_ID" = ${season} limit 1)`,
};

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
for (const [name, sql] of Object.entries(QUERIES)) {
  const times = [];
  let scans = "";
  for (let i = 0; i < 5; i++) {
    const plan = (await c.query(`explain (analyze, format json) ${sql}`)).rows[0]["QUERY PLAN"][0];
    times.push(plan["Execution Time"]);
    scans = [...JSON.stringify(plan.Plan).matchAll(/"Node Type":"([^"]*Scan)"/g)].map((m) => m[1]).join(" + ");
  }
  times.sort((a, b) => a - b);
  console.log(`${name.padEnd(28)} ${times[2].toFixed(2).padStart(8)} ms  ${scans}`);
}
await c.end();
