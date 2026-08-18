/**
 * seed-500-reset.ts — wipe everything created by seed-500.ts
 * Run: npx tsx prisma/seed-500-reset.ts
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Resetting seed-500 data...");

  await prisma.raceItem.deleteMany({ where: { id: { gte: 2000, lt: 3000 } } });
  await prisma.eventInventoryItem.deleteMany({ where: { id: { gte: 1000, lt: 2000 } } });
  await prisma.payment.deleteMany({ where: { id: { gte: 600, lt: 700 } } });
  await prisma.eventInventory.deleteMany({ where: { id: { gte: 100, lt: 120 } } });
  await prisma.bird.deleteMany({ where: { id: { gte: 1000, lt: 2000 } } });
  await prisma.eventGroup.deleteMany({ where: { id: 100 } });
  await prisma.race.deleteMany({ where: { id: 20 } });
  await prisma.season.deleteMany({ where: { id: 2 } });
  await prisma.event.deleteMany({ where: { id: 2 } });
  await prisma.breeder.deleteMany({ where: { userId: { startsWith: "stress-user-" } } });
  await prisma.user.deleteMany({ where: { id: { startsWith: "stress-user-" } } });

  console.log("Reset complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect?.());
