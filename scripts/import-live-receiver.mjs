#!/usr/bin/env node
/**
 * import-live-receiver.mjs
 *
 * Loads a HayLoft live-receiver race feed (https://pigeonpulse.com/live-receiver/)
 * into a NEW event: event → season → race, breeders (matched by name, else
 * created), birds, registrations, race entries and arrival results.
 *
 * Runs in one transaction and ROLLS BACK unless --commit is passed, so the
 * default is a dry run that prints what would be created.
 *
 * Usage:
 *   node scripts/import-live-receiver.mjs [--file feed.json] [--utc-offset -7] [--commit]
 *
 * Feed quirk: the result columns are shifted by one versus their names —
 * `eid` holds the colour, `distance` the arrival timestamp, `arrival` the
 * time behind the winner. Times are local; --utc-offset converts them (PDT = -7).
 */

import fs from "node:fs";
import dns from "node:dns/promises";
import { parseArgs } from "node:util";
import pg from "pg";

const { values: args } = parseArgs({
  options: {
    file: { type: "string" },
    url: { type: "string", default: "https://pigeonpulse.com/live-receiver/" },
    "utc-offset": { type: "string", default: "-7" },
    commit: { type: "boolean", default: false },
  },
});
const OFFSET_H = Number(args["utc-offset"]);

// ---------- feed ----------
const feed = args.file
  ? JSON.parse(fs.readFileSync(args.file, "utf8"))
  : await (await fetch(args.url)).json();

/** "10/05/2026 08:21:56.995" (local) → Date in UTC */
function localToUtc(s) {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/);
  if (!m) return null;
  const [, mo, d, y, h, mi, se, ms = "0"] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, +h - OFFSET_H, +mi, +se, +ms.padEnd(3, "0")));
}
const [, , day, monName, year] = feed.date.match(/^((\d{1,2}) (\w+) (\d{4}))$/) ?? [];
const monthIdx = new Date(`${monName} 1, 2000`).getMonth();
const libMatch = feed.lib_time.match(/^(\d{1,2}):(\d{2}) ?(am|pm)$/i);
let libH = +libMatch[1] % 12;
if (libMatch[3].toLowerCase() === "pm") libH += 12;
const startTime = new Date(Date.UTC(+year, monthIdx, +day, libH - OFFSET_H, +libMatch[2]));
const yy = String(year).slice(2);

const birds = feed.results.map((r) => {
  const m = r.band.trim().toUpperCase().match(/^(\d+)-([A-Z]+)(\d{2})-(.+)$/);
  if (!m) throw new Error(`Unparseable band: ${r.band}`);
  const [last, ...firstParts] = r.breeder.split(".");
  return {
    band: r.band.trim().toUpperCase(),
    band1: m[2], band2: m[3], band3: m[4].trim(), band4: m[1],
    color: r.eid || null,
    brNo: r.br_no,
    last: last.trim(),
    first: firstParts.join(".").trim(),
    loft: r.loft?.trim() || null,
    position: /^\d+$/.test(r.pos) ? parseInt(r.pos, 10) : null,
    stray: r.pos?.trim().toUpperCase() === "STRAY",
    arrival: r.distance ? localToUtc(r.distance) : null,
  };
});
const dupBands = birds.map((b) => b.band).filter((b, i, a) => a.indexOf(b) !== i);
if (dupBands.length) throw new Error(`Duplicate bands in feed: ${dupBands.join(", ")}`);

const breeders = [...new Map(birds.map((b) => [b.brNo, b])).values()];

// ---------- db ----------
// Some resolvers fail on Neon hostnames; resolve via 1.1.1.1 and keep the name for TLS/SNI.
const env = fs.readFileSync(new URL("../.env", import.meta.url), "utf8");
const dbUrl = new URL(env.match(/^DATABASE_URL=['"]?([^'"\n]+)/m)[1]);
const resolver = new dns.Resolver();
resolver.setServers(["1.1.1.1"]);
const [ip] = await resolver.resolve4(dbUrl.hostname);
const client = new pg.Client({
  host: ip,
  port: Number(dbUrl.port || 5432),
  user: decodeURIComponent(dbUrl.username),
  password: decodeURIComponent(dbUrl.password),
  database: dbUrl.pathname.slice(1),
  ssl: { servername: dbUrl.hostname },
});
await client.connect();

const one = async (sql, params) => (await client.query(sql, params)).rows[0];
const many = async (sql, params) => (await client.query(sql, params)).rows;

try {
  await client.query("BEGIN");

  const event = await one(
    `INSERT INTO "Events" ("EVENT_NAME","EVENT_SHORT_NAME","EVENT_DATE","EVENT_TYPE","IS_OPEN","CREATOR_ID","DESCRIPTION")
     VALUES ($1,$2,$3,5,1,1,$4) RETURNING "ID_EVENT" id`,
    [`${feed.event} ${year}`, `AGN${yy}`, startTime, `Imported from live-receiver feed (toss ${feed.toss}, ${feed.date}).`]
  );
  const season = await one(
    `INSERT INTO "Seasons" (name,"startDate","endDate","isActive","EVENT_ID")
     VALUES ($1,$2,$3,true,$4) RETURNING id`,
    [`${year} YB`, new Date(Date.UTC(+year, 7, 1)), new Date(Date.UTC(+year, 11, 31)), event.id]
  );
  const race = await one(
    `INSERT INTO "Race" (name,"RACE_NUMBER","ID_RACE_TYPE","SEASON_ID","SEASON","DESCRIPTION","LOCATION","DISTANCE","START_TIME",
       "WEATHER","WIND","TEMPERATURE","ARRIVAL_WEATHER","ARRIVAL_WIND","ARRIVAL_TEMPERATURE","STATUS")
     VALUES ($1,$2,1,$3,$4,$5,$6,0,$7,$8,$9,$10,$11,$12,$13,'STARTED') RETURNING "ID_RACE" id`,
    [`Toss ${feed.toss} – ${feed.liberation}`, parseInt(feed.toss, 10) || null, season.id, `YB${yy}`,
     feed.description || `${feed.race_type} toss ${feed.toss}`, feed.liberation, startTime,
     feed.weather_release, feed.wind_release, feed.temp_release, feed.weather_arrival, feed.wind_arrival, feed.temp_arrival]
  );

  // Breeders: reuse an existing record with the same first + last name, else create one.
  const matched = await many(
    `SELECT f.br_no, min(b."ID_BREEDER") id
       FROM unnest($1::text[], $2::text[], $3::text[]) f(br_no, last, first)
       JOIN "Breeders" b ON upper(trim(b."LAST_NAME")) = upper(f.last) AND upper(trim(b."FIRST_NAME")) = upper(f.first)
      GROUP BY f.br_no`,
    [breeders.map((b) => b.brNo), breeders.map((b) => b.last), breeders.map((b) => b.first)]
  );
  const breederIdByBrNo = new Map(matched.map((r) => [r.br_no, r.id]));
  const toCreate = breeders.filter((b) => !breederIdByBrNo.has(b.brNo));
  const created = await many(
    `INSERT INTO "Breeders" ("FIRST_NAME","LAST_NAME","NOTE")
     SELECT first, last, 'live-receiver br_no ' || br_no FROM unnest($1::text[], $2::text[], $3::text[]) f(first, last, br_no)
     RETURNING "ID_BREEDER" id, "NOTE" note`,
    [toCreate.map((b) => b.first), toCreate.map((b) => b.last), toCreate.map((b) => b.brNo)]
  );
  for (const r of created) breederIdByBrNo.set(r.note.replace("live-receiver br_no ", ""), r.id);

  // One registration per breeder (two feed numbers can resolve to the same person).
  const loftByBreeder = new Map();
  for (const b of birds) {
    const id = breederIdByBrNo.get(b.brNo);
    if (!loftByBreeder.has(id)) loftByBreeder.set(id, b.loft);
  }
  const inventories = await many(
    `INSERT INTO "EventInventory" ("SEASON_ID","ID_BREEDER","LOFT","SIGN_IN_DATE")
     SELECT $1, breeder, loft, now() FROM unnest($2::int[], $3::text[]) f(breeder, loft)
     RETURNING "ID_EVENT_INVENTORY" id, "ID_BREEDER" breeder`,
    [season.id, [...loftByBreeder.keys()], [...loftByBreeder.values()]]
  );
  const inventoryByBreeder = new Map(inventories.map((r) => [r.breeder, r.id]));

  const birdRows = await many(
    `INSERT INTO "Birds" ("BAND","BAND_1","BAND_2","BAND_3","BAND_4","COLOR","breederId","IS_ACTIVE","IS_LOST")
     SELECT band, b1, b2, b3, b4, color, breeder, 1, 0
       FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::int[]) f(band, b1, b2, b3, b4, color, breeder)
     RETURNING "ID_BIRD" id, "BAND" band`,
    [birds.map((b) => b.band), birds.map((b) => b.band1), birds.map((b) => b.band2), birds.map((b) => b.band3),
     birds.map((b) => b.band4), birds.map((b) => b.color), birds.map((b) => breederIdByBrNo.get(b.brNo))]
  );
  const birdIdByBand = new Map(birdRows.map((r) => [r.band, r.id]));

  const items = await many(
    `INSERT INTO "EventInventoryItem" ("ID_BIRD","ID_EVENT_INVENTORY")
     SELECT bird, inv FROM unnest($1::int[], $2::int[]) f(bird, inv)
     RETURNING "ID_EVENT_INVENTORY_ITEM" id, "ID_BIRD" bird`,
    [birds.map((b) => birdIdByBand.get(b.band)), birds.map((b) => inventoryByBreeder.get(breederIdByBrNo.get(b.brNo)))]
  );
  const itemByBird = new Map(items.map((r) => [r.bird, r.id]));

  const raceItems = await many(
    `INSERT INTO "RaceItem" ("ID_RACE","ID_INVENTORY_ITEM",status)
     SELECT $1, item, st::"RaceItemStatus" FROM unnest($2::int[], $3::text[]) f(item, st)
     RETURNING "ID_RACE_ITEM" id, "ID_INVENTORY_ITEM" item`,
    [race.id, birds.map((b) => itemByBird.get(birdIdByBand.get(b.band))), birds.map((b) => (b.stray ? "STRAY" : b.arrival ? "ARRIVED" : "RELEASED"))]
  );
  const raceItemByItem = new Map(raceItems.map((r) => [r.item, r.id]));

  const arrived = birds.filter((b) => b.arrival);
  await client.query(
    `INSERT INTO "RaceItemResult" ("ID_RACE_ITEM","ARRIVAL_TIME","BIRD_POSITION")
     SELECT ri, t, pos FROM unnest($1::int[], $2::timestamptz[], $3::int[]) f(ri, t, pos)`,
    [arrived.map((b) => raceItemByItem.get(itemByBird.get(birdIdByBand.get(b.band)))),
     arrived.map((b) => b.arrival), arrived.map((b) => b.position)]
  );

  const summary = {
    mode: args.commit ? "COMMIT" : "DRY RUN (rolled back)",
    feed: { event: feed.event, toss: feed.toss, date: feed.date, receivedAt: feed.received_at, inRace: feed.in_race, arrived: feed.arrived },
    eventId: event.id, seasonId: season.id, raceId: race.id,
    startTimeUtc: startTime.toISOString(),
    breeders: { inFeed: breeders.length, matchedExisting: matched.length, created: created.length, registrations: inventories.length },
    birdsCreated: birdRows.length, raceEntries: raceItems.length, results: arrived.length,
    strays: birds.filter((b) => b.stray).length, notArrived: birds.filter((b) => !b.arrival).length,
    firstArrivalUtc: arrived[0]?.arrival.toISOString(),
  };
  await client.query(args.commit ? "COMMIT" : "ROLLBACK");
  console.log(JSON.stringify(summary, null, 2));
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("Import failed, rolled back:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
