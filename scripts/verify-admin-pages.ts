/**
 * Smoke test that the admin screens actually render.
 *
 * A route can be wired correctly and still die on the first render — a client
 * component that throws during SSR takes the whole page down with a 500, which
 * no API-level check would catch. So this signs in as a throwaway admin, asks
 * for each page as a browser would, and fails on anything that is not a clean
 * 200 or carries a Next.js error marker in the HTML.
 *
 * Needs the dev server running.
 *
 *   bun scripts/verify-admin-pages.ts [baseUrl]
 */

import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const BASE = process.argv[2] ?? "http://localhost:3000";
const EMAIL = `page-check-${Date.now()}@pigeonpulse.test`;
const PASSWORD = "Page-Check-Passw0rd!";

/** Strings Next.js only emits when a render failed. */
const ERROR_MARKERS = [
  "not a constructor",
  "must pass your app key",
  "Unhandled Runtime Error",
  "__next_error__",
];

let failures = 0;
let cookie = "";

async function page(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { cookie }, redirect: "manual" });
  const html = res.status === 200 ? await res.text() : "";
  const found = ERROR_MARKERS.filter((m) => html.includes(m));
  const ok = res.status === 200 && found.length === 0;
  if (!ok) failures++;
  console.log(
    `  ${ok ? "PASS" : "FAIL"}  ${path}  ${res.status}` +
      (found.length ? `  markers: ${found.join(", ")}` : "")
  );
}

async function cleanup(userId?: string) {
  if (!userId) return;
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
}

async function main() {
  const signup = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, name: "Page Check" }),
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

  // SUPERADMIN so a missing permission never masquerades as a broken page.
  await prisma.user.update({
    where: { id: user.id },
    data: { role: "SUPERADMIN", approvalStatus: "APPROVED" },
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

  // Work backwards from a race that has an event, rather than forwards from
  // the newest event — the newest event may have no races at all, and then the
  // detail routes would be skipped without the run looking any different.
  const race = await prisma.race.findFirst({
    where: { seasonId: { not: null } },
    orderBy: { id: "desc" },
    select: { id: true, seasonRel: { select: { eventId: true } } },
  });
  const event =
    (race?.seasonRel?.eventId != null
      ? { id: race.seasonRel.eventId }
      : null) ??
    (await prisma.event.findFirst({ orderBy: { id: "desc" }, select: { id: true } }));
  const bird = await prisma.bird.findFirst({ orderBy: { id: "desc" }, select: { id: true } });

  const paths = [
    "/admin/events",
    ...(event ? [`/admin/events/${event.id}`] : []),
    ...(event && race ? [`/admin/events/${event.id}/races/${race.id}`] : []),
    "/admin/birds",
    ...(bird ? [`/admin/birds/${bird.id}`] : []),
    "/admin/users",
    "/admin/permissions",
    "/admin/reports",
    "/admin/schemes",
    "/admin/event-types",
    "/admin/race-types",
    "/admin/settings",
    ...(event ? [`/events/${event.id}/calcutta`] : []),
    ...(race ? [`/races/${race.id}`] : []),
  ];

  console.log(`Base: ${BASE}\n`);
  for (const p of paths) await page(p);

  await cleanup(user.id);
  console.log(failures === 0 ? "\nAll pages render." : `\n${failures} page(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
