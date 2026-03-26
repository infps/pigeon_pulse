/**
 * Bulk-migrate legacy Breeders (no User account) → User + Account records.
 *
 * Usage:
 *   bun pigeon_pulse/scripts/migrate-legacy-breeders.ts [--dry-run] [--verbose]
 */
import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// --- CLI flags ---
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const VERBOSE = args.includes("--verbose");

// --- Prisma init (inline to avoid @/ alias issues) ---
const url = new URL(process.env.DATABASE_URL!);
const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";

let adapter: PrismaPg;
if (isLocal) {
  adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
} else {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL!,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });
  adapter = new PrismaPg(pool);
}
const prisma = new PrismaClient({ adapter });

// --- ID generator matching better-auth (32-char alphanumeric) ---
const ALPHABET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
function generateId(size = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

// --- Email placeholder generator (always includes breeder ID for uniqueness) ---
function generateEmail(breeder: {
  id: number;
  firstName: string | null;
  lastName: string | null;
}): string {
  if (breeder.firstName && breeder.lastName) {
    const slug = `${breeder.firstName}-${breeder.lastName}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-");
    if (slug && slug !== "-")
      return `${slug}-${breeder.id}@pigeon-pulse.local`;
  }
  return `legacy-${breeder.id}@pigeon-pulse.local`;
}

// --- Main ---
async function main() {
  console.log(
    DRY_RUN ? "=== DRY RUN (no DB writes) ===" : "=== LIVE MIGRATION ==="
  );

  // Hash default password once (scrypt is expensive)
  const passwordHash = await hashPassword("demoUser");

  // Fetch unmigrated breeders
  const breeders = await prisma.breeder.findMany({
    where: { userId: null },
  });
  console.log(`Found ${breeders.length} unmigrated breeder(s)\n`);

  if (breeders.length === 0) {
    console.log("Nothing to migrate.");
    await prisma.$disconnect();
    return;
  }

  // Existing users for dedup
  const existingUsers = await prisma.user.findMany({
    select: { id: true, email: true, username: true },
  });
  const emailToUserId = new Map(
    existingUsers.map((u) => [u.email.toLowerCase(), u.id])
  );
  const usernameSet = new Set(
    existingUsers
      .filter((u) => u.username)
      .map((u) => u.username!.toLowerCase())
  );

  // Track which userIds are already linked to a breeder (unique constraint)
  const linkedBreeders = await prisma.breeder.findMany({
    where: { userId: { not: null } },
    select: { userId: true },
  });
  const claimedUserIds = new Set(linkedBreeders.map((b) => b.userId!));

  let created = 0;
  let linked = 0;
  let skipped = 0;
  let errors = 0;

  for (const breeder of breeders) {
    try {
      const email = (breeder.email || generateEmail(breeder))
        .toLowerCase()
        .trim();

      // Case A: User with this email exists → link if not already claimed
      const existingUserId = emailToUserId.get(email);
      if (existingUserId) {
        if (claimedUserIds.has(existingUserId)) {
          skipped++;
          if (VERBOSE)
            console.log(
              `${DRY_RUN ? "[DRY] " : ""}SKIP breeder#${breeder.id} — user#${existingUserId} already linked to another breeder`
            );
          continue;
        }
        if (!DRY_RUN) {
          await prisma.breeder.update({
            where: { id: breeder.id },
            data: { userId: existingUserId },
          });
        }
        claimedUserIds.add(existingUserId);
        linked++;
        if (VERBOSE)
          console.log(
            `${DRY_RUN ? "[DRY] " : ""}LINK breeder#${breeder.id} → user#${existingUserId}`
          );
        continue;
      }

      // Case B: Create User + Account + link Breeder
      const userId = generateId();
      const accountId = generateId();

      // Deduplicate username
      let username = breeder.loginName?.trim() || null;
      if (username && usernameSet.has(username.toLowerCase())) {
        username = null;
      }
      if (username) usernameSet.add(username.toLowerCase());

      if (!DRY_RUN) {
        await prisma.$transaction([
          prisma.user.create({
            data: {
              id: userId,
              name: breeder.firstName || "Legacy",
              lastName: breeder.lastName,
              email,
              emailVerified: false,
              username,
              displayUsername: username,
              country: breeder.country,
              state: breeder.state1,
              city: breeder.city1,
              address: breeder.address1,
              postalCode: breeder.zip1,
              phoneNumber: breeder.phone || breeder.cell,
              webAddress: breeder.webAddress,
              ssn: breeder.ssn,
              taxNumber: breeder.taxNumber,
              note: breeder.note,
              status: breeder.status === 0 ? "INACTIVE" : "ACTIVE",
              role: "BREEDER",
            },
          }),
          prisma.account.create({
            data: {
              id: accountId,
              accountId: userId,
              providerId: "credential",
              userId,
              password: passwordHash,
            },
          }),
          prisma.breeder.update({
            where: { id: breeder.id },
            data: { userId },
          }),
        ]);
      }

      emailToUserId.set(email, userId);
      claimedUserIds.add(userId);
      created++;
      if (VERBOSE)
        console.log(
          `${DRY_RUN ? "[DRY] " : ""}CREATE user for breeder#${breeder.id} (${breeder.firstName} ${breeder.lastName}) email=${email}`
        );
    } catch (err) {
      errors++;
      console.error(
        `ERROR breeder#${breeder.id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  console.log("\n--- Migration Report ---");
  console.log(`Total:   ${breeders.length}`);
  console.log(`Created: ${created}`);
  console.log(`Linked:  ${linked}`);
  console.log(`Skipped: ${skipped} (duplicate email, user already linked)`);
  console.log(`Errors:  ${errors}`);
  if (DRY_RUN) console.log("\n(DRY RUN — no changes committed)");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
