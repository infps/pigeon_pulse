/**
 * Checks the paged admin lists that the browser caches (users, birds):
 * every page stitched together == the full list, no duplicates, and the paged
 * users rows carry no sensitive fields while `?id=` still returns them.
 * Signs in as a throwaway SUPERADMIN (deleted at the end). Needs the dev server.
 *
 *   bun scripts/verify-list-pagination.ts [baseUrl]
 */

import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { fetchAllPages } from "../src/lib/list-cache";

const BASE = process.argv[2] ?? "http://localhost:3000";
const EMAIL = `list-check-${Date.now()}@pigeonpulse.test`;
const SECRET = `${randomUUID()}Aa1!`; // throwaway, never stored
const SENSITIVE = ["ssn", "ssnDocKey", "taxDocKey", "taxNumber"];

async function main() {
  let userId: string | undefined;
  try {
    const creds = JSON.stringify({ email: EMAIL, password: SECRET, name: "List Check" });
    const up = await fetch(`${BASE}/api/auth/sign-up/email`, { method: "POST", headers: { "Content-Type": "application/json" }, body: creds });
    assert.ok(up.ok, `sign-up ${up.status}`);
    userId = (await prisma.user.findUniqueOrThrow({ where: { email: EMAIL }, select: { id: true } })).id;
    await prisma.user.update({ where: { id: userId }, data: { role: "SUPERADMIN", approvalStatus: "APPROVED" } });
    const inRes = await fetch(`${BASE}/api/auth/sign-in/email`, { method: "POST", headers: { "Content-Type": "application/json" }, body: creds });
    const cookie = (inRes.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
    assert.ok(cookie, "no session cookie");

    let bytes = 0;
    const authed: typeof fetch = async (url, init) => {
      const res = await fetch(String(url).replace(/^https?:\/\/[^/]+/, BASE), { ...init, headers: { cookie } });
      const text = await res.text();
      bytes += text.length;
      return new Response(text, { status: res.status, headers: res.headers });
    };
    const time = async <T>(label: string, fn: () => Promise<T>) => {
      bytes = 0;
      const t = Date.now();
      const out = await fn();
      console.log(`  ${label.padEnd(28)} ${String(Date.now() - t).padStart(5)}ms  ${(bytes / 1024).toFixed(0)}KB`);
      return out;
    };

    // Users: legacy full response vs stitched pages.
    const full = await time("users full (legacy)", async () => (await (await authed(`${BASE}/api/admin/users`)).json()).users as { id: string }[]);
    const paged = await time("users paged (500/page)", () => fetchAllPages<Record<string, unknown> & { id: string }>("/api/admin/users", "users", undefined, authed));
    const ids = paged.map((u) => u.id);
    assert.equal(new Set(ids).size, ids.length, "duplicate user ids across pages");
    assert.deepEqual(new Set(ids), new Set(full.map((u) => u.id)), "paged users != full users");
    for (const u of paged) for (const k of SENSITIVE) assert.ok(!(k in u), `paged user leaks ${k}`);
    const one = await (await authed(`${BASE}/api/admin/users?id=${encodeURIComponent(userId)}`)).json();
    assert.equal(one.user?.id, userId);
    assert.ok("ssn" in one.user, "?id= lost full record");
    console.log(`  users OK: ${paged.length} rows (incl. legacy breeders), no sensitive fields`);

    // Birds: stitched pages == table.
    const birds = await time("birds paged (500/page)", () => fetchAllPages<{ id: number }>("/api/admin/birds", "birds", undefined, authed));
    const birdIds = birds.map((b) => b.id);
    assert.equal(new Set(birdIds).size, birdIds.length, "duplicate bird ids across pages");
    assert.equal(birdIds.length, await prisma.bird.count(), "paged birds != bird count");
    console.log(`  birds OK: ${birds.length} rows`);
    console.log("PASS");
  } finally {
    if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("FAIL", e.message);
  process.exit(1);
});
