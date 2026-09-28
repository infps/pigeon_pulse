/**
 * Where the permission system is not actually load-bearing.
 *
 * The guards that exist are enforced server-side and are not decorative — the
 * e2e suites prove that. This asks the separate question of coverage: which
 * admin endpoints can still be reached by somebody who should not reach them.
 *
 * Two kinds of gap are probed. Handlers with no check at all, tried with no
 * credentials; and handlers that check only that you are signed in, tried as a
 * plain breeder who holds no admin permission whatsoever.
 *
 * Reads are real. Writes use an id that cannot exist, so a 404 proves the
 * request reached the handler — which is the finding — without touching a row.
 *
 *   bun scripts/audit-rbac-gaps.ts [baseUrl]
 */

import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const BASE = process.argv[2] ?? "http://localhost:3000";
const EMAIL = `gap-audit-${Date.now()}@pigeonpulse.test`;
const PASSWORD = "Gap-Audit-Passw0rd!";

interface Probe {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  what: string;
  /** Requests without a session should be refused outright. */
  anonymous: boolean;
}

const PROBES: Probe[] = [
  // No check at all
  { method: "GET", path: "/api/admin/race-type", what: "race types", anonymous: true },
  { method: "GET", path: "/api/admin/event-type", what: "event types", anonymous: true },
  { method: "GET", path: "/api/admin/bird-status-codes", what: "bird status codes", anonymous: true },
  { method: "GET", path: "/api/admin/bird/999999999", what: "any bird record", anonymous: true },
  { method: "PATCH", path: "/api/admin/bird/999999999", what: "edit any bird", anonymous: true },
  { method: "DELETE", path: "/api/admin/bird/999999999", what: "delete any bird", anonymous: true },
  { method: "GET", path: "/api/admin/event/999999999/stations", what: "liberation points", anonymous: true },
  { method: "GET", path: "/api/admin/event/999999999/status-presets", what: "status presets", anonymous: true },
  { method: "GET", path: "/api/admin/race/999999999/track", what: "race tracking feed", anonymous: true },

  // Signed in, but no permission required
  { method: "GET", path: "/api/admin/users", what: "every user account", anonymous: false },
  { method: "POST", path: "/api/admin/event", what: "create an event", anonymous: false },
  { method: "PUT", path: "/api/admin/event", what: "edit an event", anonymous: false },
  { method: "DELETE", path: "/api/admin/event", what: "delete an event", anonymous: false },
  { method: "POST", path: "/api/admin/event/999999999/seasons", what: "create a season", anonymous: false },
];

const REFUSED = new Set([401, 403]);

async function main() {
  const signup = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, name: "Gap Audit" }),
  });
  if (!signup.ok) {
    console.error(`Could not create the test account: ${signup.status}`);
    process.exit(1);
  }
  const user = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true } });
  if (!user) throw new Error("account created but not readable");

  // A plain approved breeder: the least privileged person who can still log in.
  await prisma.user.update({
    where: { id: user.id },
    data: { role: "BREEDER", approvalStatus: "APPROVED" },
  });

  const signin = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const cookie = (signin.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");

  const held = await (await fetch(`${BASE}/api/me/permissions`, { headers: { cookie } })).json();
  console.log(`Signed in as a breeder holding ${(held?.permissions ?? []).length} permissions.\n`);

  let open = 0;
  for (const probe of PROBES) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (!probe.anonymous) headers.cookie = cookie;

    const res = await fetch(`${BASE}${probe.path}`, {
      method: probe.method,
      headers,
      body: probe.method === "GET" || probe.method === "DELETE" ? undefined : "{}",
      // A handler that hangs is its own finding, but it must not hang the audit.
      signal: AbortSignal.timeout(20_000),
    }).catch((err) => ({ status: err?.name === "TimeoutError" ? 0 : -1 }) as Response);

    const refused = REFUSED.has(res.status);
    if (!refused) open++;
    console.log(
      `  ${refused ? "refused" : "REACHED"}  ${String(res.status).padEnd(3)}  ` +
        `${probe.anonymous ? "anon   " : "breeder"}  ${probe.method} ${probe.path}` +
        (refused ? "" : `   ← ${probe.what}`)
    );
  }

  console.log(
    `\n${open} of ${PROBES.length} probes were not refused.` +
      (open ? " Each one is an endpoint the permission system does not cover." : "")
  );

  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
