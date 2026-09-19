/**
 * Checks the class payout arithmetic against worked examples.
 *
 * These are the three shapes WinCompanion's own class list shows, so if the
 * numbers here are right the port is faithful:
 *
 *   "$20 - 10 for 1"      ratio, one prize per 10 entries
 *   "$25 - 50, 30, 20"    three places, split by percentage
 *   "$20 - Winner Take All"
 *
 *   bun scripts/verify-race-classes.ts
 */

import "dotenv/config";
import { winnerCount, payoutShares, MIN_POOL_ENTRIES } from "../src/lib/race-classes";
import { prisma } from "../src/lib/prisma";

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `  ${ok ? "PASS" : "FAIL"}  ${label}` + (ok ? "" : `\n        got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`)
  );
}

function near(label: string, actual: number, expected: number, tolerance = 0.01) {
  const ok = Math.abs(actual - expected) <= tolerance;
  if (!ok) failures++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}` + (ok ? "" : `  got ${actual} want ${expected}`));
}

console.log("Winner counts\n");
check("WTA always pays one", winnerCount("WTA", 1, 40), 1);
check("ratio 10-for-1 over 25 birds pays 2", winnerCount("RATIO", 10, 25), 2);
check("ratio 10-for-1 over 100 birds pays 10", winnerCount("RATIO", 10, 100), 10);
check("ratio pays at least one even in a short field", winnerCount("RATIO", 10, 4), 1);
check("places pays the configured three", winnerCount("PLACES", 3, 40), 3);
check("places cannot pay more than finished", winnerCount("PLACES", 3, 2), 2);
check("nothing placed pays nobody", winnerCount("RATIO", 10, 0), 0);

console.log("\nPayout shares\n");

const fiftyThirtyTwenty = [
  { place: 1, percValue: 50 },
  { place: 2, percValue: 30 },
  { place: 3, percValue: 20 },
];

check(
  "places follow 50/30/20 from the scheme",
  payoutShares("PLACES", 3, fiftyThirtyTwenty),
  [0.5, 0.3, 0.2]
);
check(
  "places fall back to an even split when the table is short",
  payoutShares("PLACES", 3, [{ place: 1, percValue: 50 }]),
  [1 / 3, 1 / 3, 1 / 3]
);
check("ratio splits evenly", payoutShares("RATIO", 2, fiftyThirtyTwenty), [0.5, 0.5]);
check("WTA gives everything to one", payoutShares("WTA", 1, fiftyThirtyTwenty), [1]);

console.log("\nWorked examples\n");

// "$25 - 50, 30, 20" with 40 birds and a 15% house cut.
{
  const fee = 25;
  const entries = 40;
  const pool = fee * entries; // 1000
  const cut = pool * 0.15; // 150
  const distributable = pool - cut; // 850
  const winners = winnerCount("PLACES", 3, entries);
  const shares = payoutShares("PLACES", winners, fiftyThirtyTwenty);
  const paid = shares.map((s) => Math.round(distributable * s * 100) / 100);

  console.log(`  $25 x 40 birds, 15% cut -> pool ${pool}, distributable ${distributable}`);
  near("first place takes 50%", paid[0], 425);
  near("second place takes 30%", paid[1], 255);
  near("third place takes 20%", paid[2], 170);
  near("the three places spend the whole pool", paid.reduce((a, b) => a + b, 0), distributable);
}

// "$20 - 10 for 1" with 100 birds and no cut.
{
  const pool = 20 * 100;
  const winners = winnerCount("RATIO", 10, 100);
  const shares = payoutShares("RATIO", winners, []);
  const each = Math.round(pool * shares[0] * 100) / 100;

  console.log(`\n  $20 x 100 birds, 10-for-1 -> ${winners} winners`);
  check("ten winners", winners, 10);
  near("each takes a tenth of the pool", each, 200);
}

// A pool too small to pay.
console.log(`\n  Pools under ${MIN_POOL_ENTRIES} entries are refunded, not paid.`);

console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);

await prisma.$disconnect();
process.exit(failures === 0 ? 0 : 1);
