/**
 * End-to-end proof that permissions are enforced over HTTP.
 *
 * Creates a throwaway admin, signs in as them, revokes one permission, and
 * checks the same request that worked a moment ago now comes back 403. Then
 * restores it and checks access returns. The account and its rules are deleted
 * at the end whatever happens.
 *
 * Needs the dev server running.
 *
 *   bun scripts/verify-rbac-e2e.ts [baseUrl]
 */

import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const BASE = process.argv[2] ?? "http://localhost:3000";
const EMAIL = `rbac-check-${Date.now()}@pigeonpulse.test`;
const PASSWORD = "Rbac-Check-Passw0rd!";

let failures = 0;
let cookie = "";

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `  ${ok ? "PASS" : "FAIL"}  ${label}` +
      (ok ? "" : `  got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`)
  );
}

async function call(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { cookie } });
  let body: Record<string, unknown> = {};
  try {
    body = await res.json();
  } catch {
    /* some routes stream a file */
  }
  return { status: res.status, body };
}

// The server caches grants for ten seconds; a change made straight in the
// database has to outlast that window before the next request sees it.
const waitForCache = () => new Promise((r) => setTimeout(r, 11_000));

async function main() {
  console.log(`Base: ${BASE}\n`);

  // 1. a throwaway account, created the way a real sign-up does
  const signup = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, name: "RBAC Check" }),
  });
  if (!signup.ok) {
    console.error(`Could not create the test account: ${signup.status} ${await signup.text()}`);
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true } });
  if (!user) {
    console.error("Account was created but could not be read back.");
    process.exit(1);
  }

  // Promote to admin and approve, so only permissions are under test.
  await prisma.user.update({
    where: { id: user.id },
    data: { role: "ADMIN", approvalStatus: "APPROVED" },
  });

  const signin = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  cookie = (signin.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  if (!cookie) {
    console.error("Sign-in returned no session cookie.");
    await cleanup(user.id);
    process.exit(1);
  }

  console.log("An admin with default permissions\n");

  const mine = await call("/api/me/permissions");
  const held: string[] = (mine.body.permissions as string[]) ?? [];
  check("is signed in", mine.body.signedIn, true);
  check("holds races.manage by default", held.includes("races.manage"), true);
  check("holds refunds.manage by default", held.includes("refunds.manage"), true);
  check("does NOT hold users.permissions", held.includes("users.permissions"), false);

  const reportsBefore = await call("/api/admin/reports");
  check("can reach a guarded route", reportsBefore.status, 200);

  const permsScreen = await call("/api/admin/permissions");
  check("cannot reach the permissions screen", permsScreen.status, 403);
  check(
    "and the refusal names what is missing",
    String(permsScreen.body.permission ?? ""),
    "users.permissions"
  );

  console.log("\nAfter revoking reports.view from this one person\n");

  await prisma.userPermission.create({
    data: { userId: user.id, permission: "reports.view", allowed: false },
  });
  await waitForCache();

  const mineAfter = await call("/api/me/permissions");
  const heldAfter: string[] = (mineAfter.body.permissions as string[]) ?? [];
  check("reports.view is gone from their set", heldAfter.includes("reports.view"), false);
  check("races.manage is untouched", heldAfter.includes("races.manage"), true);

  const reportsAfter = await call("/api/admin/reports");
  check("the same request is now refused", reportsAfter.status, 403);
  check(
    "the refusal names the permission",
    String(reportsAfter.body.permission ?? ""),
    "reports.view"
  );

  const racesStillFine = await call("/api/admin/race?raceId=221");
  check("an unrelated module still works", racesStillFine.status, 200);

  console.log("\nAfter giving it back\n");

  await prisma.userPermission.update({
    where: { userId_permission: { userId: user.id, permission: "reports.view" } },
    data: { allowed: true },
  });
  await waitForCache();

  const restored = await call("/api/admin/reports");
  check("access returns", restored.status, 200);

  console.log("\nA revoke on the role, not the person\n");

  await prisma.userPermission.deleteMany({ where: { userId: user.id } });
  await prisma.rolePermission.create({
    data: { role: "ADMIN", permission: "reports.view", allowed: false },
  });
  await waitForCache();

  const roleRevoked = await call("/api/admin/reports");
  check("every admin loses it", roleRevoked.status, 403);

  // A personal grant should beat the role-level revoke.
  await prisma.userPermission.create({
    data: { userId: user.id, permission: "reports.view", allowed: true },
  });
  await waitForCache();

  const personalWins = await call("/api/admin/reports");
  check("a personal grant overrides the role revoke", personalWins.status, 200);

  await cleanup(user.id);

  console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

async function cleanup(userId: string) {
  await prisma.rolePermission.deleteMany({
    where: { role: "ADMIN", permission: "reports.view" },
  });
  await prisma.userPermission.deleteMany({ where: { userId } });
  await prisma.notification.deleteMany({ where: { userId } });
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.account.deleteMany({ where: { userId } });
  await prisma.breeder.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  console.log("\nTest account and rules removed.");
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
