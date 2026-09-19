/**
 * Proves the permission resolver behaves, including the cases that matter most:
 * a user override removing access a role grants, and a superadmin never being
 * lockable out of the screen that hands out permissions.
 *
 *   bun scripts/verify-rbac.ts
 */

import "dotenv/config";
import {
  ALL_PERMISSIONS,
  MODULES,
  hasDefault,
  isKnownPermission,
  resolveAll,
  resolvePermission,
} from "../src/lib/permissions";
import { prisma } from "../src/lib/prisma";

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `  ${ok ? "PASS" : "FAIL"}  ${label}` +
      (ok ? "" : `  got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`)
  );
}

console.log(`Catalog: ${MODULES.length} modules, ${ALL_PERMISSIONS.length} permissions\n`);

console.log("Defaults\n");
check("admin manages races by default", hasDefault("ADMIN", "races.manage"), true);
check("admin cannot assign permissions", hasDefault("ADMIN", "users.permissions"), false);
check("admin cannot edit users", hasDefault("ADMIN", "users.manage"), false);
check("admin can see users", hasDefault("ADMIN", "users.view"), true);
check("breeder has no admin rights", hasDefault("BREEDER", "races.manage"), false);
check("bettor has no admin rights", hasDefault("BETTOR", "betting.manage"), false);

console.log("\nResolution order\n");

check(
  "superadmin bypasses everything, even an explicit revoke",
  resolvePermission("SUPERADMIN", "users.permissions", [], [
    { permission: "users.permissions", allowed: false },
  ]),
  true
);

check(
  "a role grant adds what the default withholds",
  resolvePermission("ADMIN", "users.manage", [{ permission: "users.manage", allowed: true }], []),
  true
);

check(
  "a user grant beats the role grant",
  resolvePermission(
    "ADMIN",
    "payments.manage",
    [{ permission: "payments.manage", allowed: true }],
    [{ permission: "payments.manage", allowed: false }]
  ),
  false
);

check(
  "a user revoke removes a default the role has",
  resolvePermission("ADMIN", "refunds.manage", [], [
    { permission: "refunds.manage", allowed: false },
  ]),
  false
);

check(
  "a role revoke removes a default",
  resolvePermission("ADMIN", "betting.payouts", [{ permission: "betting.payouts", allowed: false }], []),
  false
);

check(
  "a user grant lifts a role revoke",
  resolvePermission(
    "ADMIN",
    "betting.payouts",
    [{ permission: "betting.payouts", allowed: false }],
    [{ permission: "betting.payouts", allowed: true }]
  ),
  true
);

console.log("\nThe scenario this was built for\n");

// "This admin runs races but must not touch money."
const noMoney = ["payments.manage", "refunds.manage", "betting.payouts", "classes.payouts"].map(
  (permission) => ({ permission, allowed: false })
);
const effective = resolveAll("ADMIN", [], noMoney);

check("still runs races", effective.includes("races.manage"), true);
check("still checks birds in", effective.includes("checkin.manage"), true);
check("cannot record payments", effective.includes("payments.manage"), false);
check("cannot issue refunds", effective.includes("refunds.manage"), false);
check("cannot settle betting payouts", effective.includes("betting.payouts"), false);
check("cannot settle class payouts", effective.includes("classes.payouts"), false);

console.log("\nCatalog integrity\n");
check("every code is unique", new Set(ALL_PERMISSIONS.map((p) => p.code)).size, ALL_PERMISSIONS.length);
check("codes are module.action", ALL_PERMISSIONS.every((p) => p.code.split(".").length === 2), true);
check("an invented code is rejected", isKnownPermission("races.destroy"), false);
check("a real code is accepted", isKnownPermission("races.manage"), true);

// Every code a route guards must exist in the catalog, or the guard can never pass.
const fs = await import("node:fs");
const path = await import("node:path");
const used = new Set<string>();

function walk(dir: string) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name === "route.ts") {
      const src = fs.readFileSync(full, "utf8");
      for (const m of src.matchAll(/requirePermission\("([^"]+)"\)/g)) used.add(m[1]);
    }
  }
}
walk("src/app/api/admin");

const unknown = [...used].filter((code) => !isKnownPermission(code));
check(`all ${used.size} guarded codes exist in the catalog`, unknown, []);

console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);

await prisma.$disconnect();
process.exit(failures === 0 ? 0 : 1);
