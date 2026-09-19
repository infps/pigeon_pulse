/**
 * Proves the read half of the permission matrix actually grants something.
 *
 * Every module offers a "view" and a "manage" permission, but the GET routes
 * were guarded on "manage" alone — so granting somebody "View races" and
 * nothing else produced a 403 on the very screen it was meant to open. The
 * matrix showed an access level the server did not honour.
 *
 * This signs in as an account holding one lone view permission and checks two
 * things at once: the read goes through, and the write still does not.
 *
 * Needs the dev server running.
 *
 *   bun scripts/verify-view-permissions.ts [baseUrl]
 */

import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { MODULES } from "../src/lib/permissions";

const BASE = process.argv[2] ?? "http://localhost:3000";
const EMAIL = `view-check-${Date.now()}@pigeonpulse.test`;
const PASSWORD = "View-Check-Passw0rd!";

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

async function call(path: string, method: "GET" | "POST" = "GET") {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { cookie, "Content-Type": "application/json" },
    body: method === "POST" ? "{}" : undefined,
  });
  return res.status;
}

async function grant(userId: string, permission: string) {
  await prisma.userPermission.create({ data: { userId, permission, allowed: true } });
}

/** The server caches grants for ten seconds. */
const waitForCache = () => new Promise((r) => setTimeout(r, 11_000));

async function cleanup(userId?: string) {
  if (!userId) return;
  await prisma.userPermission.deleteMany({ where: { userId } }).catch(() => {});
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
}

async function main() {
  console.log(`Base: ${BASE}\n`);

  // Every module's catalog really does offer both halves — if that ever stops
  // being true the rest of this check is meaningless.
  const missing = MODULES.filter(
    (m) => !m.permissions.some((p) => p.action === "view")
  ).map((m) => m.key);
  check("every module defines a view permission", missing, []);

  const signup = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, name: "View Check" }),
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

  // A plain breeder role carries no admin defaults, so the only access this
  // account has is the one grant added below. That is the whole point: the
  // view permission has to stand on its own.
  await prisma.user.update({
    where: { id: user.id },
    data: { role: "BREEDER", approvalStatus: "APPROVED" },
  });
  await grant(user.id, "races.view");
  await grant(user.id, "breeders.view");

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

  const mine = await fetch(`${BASE}/api/me/permissions`, { headers: { cookie } });
  const held: string[] = (await mine.json())?.permissions ?? [];
  check("holds races.view", held.includes("races.view"), true);
  check("does NOT hold races.manage", held.includes("races.manage"), false);

  console.log("\nReads a view permission should open\n");
  check("GET /api/admin/race", await call("/api/admin/race"), 200);
  check("GET /api/admin/breeders", await call("/api/admin/breeders"), 200);

  console.log("\nWrites it must still refuse\n");
  check("POST /api/admin/race", await call("/api/admin/race", "POST"), 403);

  console.log("\nModules it was never granted\n");
  check("GET /api/admin/birds", await call("/api/admin/birds"), 403);

  console.log("\nRevoking the view permission closes the read again\n");
  await prisma.userPermission.deleteMany({
    where: { userId: user.id, permission: "races.view" },
  });
  await waitForCache();
  check("GET /api/admin/race", await call("/api/admin/race"), 403);

  await cleanup(user.id);
  console.log(failures === 0 ? "\nView permissions work." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
