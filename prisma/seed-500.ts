/**
 * seed-500.ts — stress-test seed: 500 birds across 20 breeders in event id=2 / season id=2
 * Run: npx tsx prisma/seed-500.ts
 * Safe: uses event id=2, will not touch existing seed data (event id=1)
 */
import { prisma } from "../src/lib/prisma";
import { RaceItemStatus, RaceStatus } from "../src/generated/prisma/enums";

const BREEDER_COUNT = 20;
const BIRDS_PER_BREEDER = 25; // 20 × 25 = 500
const FEDERATIONS = ["AU", "IF", "CU", "NPA"];
const COLORS = ["BC", "BB", "WF", "CH", "GRZ", "SIL", "RED", "PED"];
const SEXES = [0, 1]; // 0=cock, 1=hen
const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
  "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
  "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
];
const FIRST_NAMES = [
  "James", "John", "Robert", "Michael", "William", "David", "Richard",
  "Joseph", "Thomas", "Charles", "Mary", "Patricia", "Jennifer", "Linda",
  "Barbara", "Elizabeth", "Susan", "Jessica", "Sarah", "Karen",
];

async function main() {
  console.log("Seeding 500-bird stress test event...");

  // Event + Season (separate from seed.ts event id=1)
  const event = await prisma.event.upsert({
    where: { id: 2 },
    update: { name: "Stress Test 500 — One Loft Race", shortName: "ST500" },
    create: {
      id: 2,
      name: "Stress Test 500 — One Loft Race",
      shortName: "ST500",
      isOpen: 1,
      locationAddress: "Bakersfield, CA",
    },
  });

  const season = await prisma.season.upsert({
    where: { id: 2 },
    update: { name: "2026 ST500 Season", isActive: true },
    create: {
      id: 2,
      name: "2026 ST500 Season",
      startDate: new Date("2026-01-01T00:00:00Z"),
      endDate: new Date("2026-12-31T00:00:00Z"),
      eventId: event.id,
      isActive: true,
    },
  });

  // Deactivate all other seasons for this event to avoid conflicts
  await prisma.season.updateMany({
    where: { eventId: event.id, id: { not: season.id } },
    data: { isActive: false },
  });

  // Race — REGISTERING so birds show up in checkin tab
  const race = await prisma.race.upsert({
    where: { id: 20 },
    update: { name: "ST500 Championship", status: RaceStatus.REGISTERING },
    create: {
      id: 20,
      seasonId: season.id,
      name: "ST500 Championship",
      description: "500-bird stress test race",
      distance: 300,
      startTime: new Date("2026-09-15T07:00:00Z"),
      status: RaceStatus.REGISTERING,
      isClosed: 0,
      location: "Bakersfield, CA",
    },
  });

  // Loft group for checkin
  const loftGroup = await prisma.eventGroup.upsert({
    where: { id: 100 },
    update: { name: "Loft A", status: "OPEN" },
    create: {
      id: 100,
      seasonId: season.id,
      name: "Loft A",
      type: "LOFT",
      status: "OPEN",
      hasCapacity: true,
      capacity: 600,
    },
  });

  let userBase = 200; // start user/breeder IDs well above existing seed
  let birdBase = 1000;
  let inventoryBase = 100;
  let inventoryItemBase = 1000;
  let raceItemBase = 2000;

  let totalBirds = 0;

  for (let bi = 0; bi < BREEDER_COUNT; bi++) {
    const userId = `stress-user-${bi + 1}`;
    const lastName = LAST_NAMES[bi % LAST_NAMES.length];
    const firstName = FIRST_NAMES[bi % FIRST_NAMES.length];

    // User
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        name: `${firstName} ${lastName}`,
        lastName,
        email: `stress${bi + 1}@pigeonpulse-test.dev`,
        emailVerified: true,
        loftName: `${lastName} Loft`,
        role: "BREEDER",
        country: "US",
        username: `stress_${lastName.toLowerCase()}_${bi + 1}`,
      },
    });

    // Breeder
    const breeder = await prisma.breeder.upsert({
      where: { userId },
      update: {},
      create: {
        firstName,
        lastName,
        country: "US",
        userId,
        status: 1,
        city1: "Los Angeles",
        state1: "CA",
      },
    });

    // EventInventory
    const invId = inventoryBase + bi;
    const inv = await prisma.eventInventory.upsert({
      where: { id: invId },
      update: {},
      create: {
        id: invId,
        seasonId: season.id,
        breederId: breeder.id,
        signInDate: new Date("2026-01-15T00:00:00Z"),
        cashPromised: bi % 4 === 0, // 25% promised cash
      },
    });

    // Payment — mark half as PAID
    if (bi % 2 === 0) {
      await prisma.payment.upsert({
        where: { id: inventoryBase + bi + 500 },
        update: {},
        create: {
          id: inventoryBase + bi + 500,
          eventInventoryId: inv.id,
          breederId: breeder.id,
          paymentValue: 500,
          status: "PAID",
          paymentDate: new Date("2026-01-20T00:00:00Z"),
          paymentDesc: "Seed payment",
        },
      });
    }

    // Birds
    for (let bj = 0; bj < BIRDS_PER_BREEDER; bj++) {
      const birdId = birdBase + bi * BIRDS_PER_BREEDER + bj;
      const bandNum = 1000 + birdId;
      const fed = FEDERATIONS[bj % FEDERATIONS.length];
      const color = COLORS[birdId % COLORS.length];
      const sex = SEXES[birdId % 2];
      const year = "26";
      const letters = lastName.slice(0, 3).toUpperCase();

      // Assign RFID to 60% of birds (realistic — not all scanned yet)
      const hasRfid = birdId % 10 < 6;

      const bird = await prisma.bird.upsert({
        where: { id: birdId },
        update: {},
        create: {
          id: birdId,
          band: `${fed}-${year}-${letters}-${bandNum}`,
          band1: fed,
          band2: year,
          band3: letters,
          band4: String(bandNum),
          birdName: `${lastName} ${bandNum}`,
          color,
          sex,
          isActive: 1,
          breederId: breeder.id,
          rfid: hasRfid ? `RFST${String(birdId).padStart(6, "0")}` : null,
        },
      });

      const itemId = inventoryItemBase + bi * BIRDS_PER_BREEDER + bj;
      await prisma.eventInventoryItem.upsert({
        where: { id: itemId },
        update: {},
        create: {
          id: itemId,
          birdId: bird.id,
          eventInventoryId: inv.id,
          arrivalDate: new Date("2026-02-01T00:00:00Z"),
          birdNo: bj + 1,
        },
      });

      // RaceItem — all REGISTERED (checkin not done yet)
      await prisma.raceItem.upsert({
        where: { id: raceItemBase + bi * BIRDS_PER_BREEDER + bj },
        update: {},
        create: {
          id: raceItemBase + bi * BIRDS_PER_BREEDER + bj,
          raceId: race.id,
          inventoryItemId: itemId,
          status: RaceItemStatus.REGISTERED,
        },
      });

      totalBirds++;
    }

    if ((bi + 1) % 5 === 0) {
      console.log(`  Breeders: ${bi + 1}/${BREEDER_COUNT}, Birds so far: ${totalBirds}`);
    }
  }

  console.log(`
Done.
  Event:    id=2  "${event.name}"
  Season:   id=2  "${season.name}"
  Race:     id=20 "ST500 Championship" (REGISTERING)
  LoftGroup: id=100 "Loft A" (OPEN, capacity 600)
  Breeders: ${BREEDER_COUNT}
  Birds:    ${totalBirds} (60% have RFID, 50% paid)

To test checkin: open event id=2, checkin tab.
To reset: run prisma/seed-500-reset.ts
  `);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect?.());
