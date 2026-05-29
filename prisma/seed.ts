import { prisma } from "../src/lib/prisma";
import { RaceItemStatus, RaceStatus } from "../src/generated/prisma/enums";

async function main() {
  console.log("Seeding...");

  // RaceTypes
  const rtRace = await prisma.raceType.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, name: "A" },
  });
  const rtTraining = await prisma.raceType.upsert({
    where: { id: 2 },
    update: {},
    create: { id: 2, name: "T" },
  });

  // Users
  const userIds = [
    "seed-user-1",
    "seed-user-2",
    "seed-user-3",
    "seed-user-4",
  ];
  const loftData = [
    { name: "Blue Angels Racing Loft", loftName: "Blue Angels Racing Loft", lastName: "Diaz", firstName: "Pedro" },
    { name: "Golden Wings Loft", loftName: "Golden Wings Loft", lastName: "Smith", firstName: "James" },
    { name: "Pacific Flyers", loftName: "Pacific Flyers", lastName: "Chen", firstName: "Wei" },
    { name: "Desert Storm Loft", loftName: "Desert Storm Loft", lastName: "Martinez", firstName: "Carlos" },
  ];

  const users = [];
  for (let i = 0; i < 4; i++) {
    const u = await prisma.user.upsert({
      where: { id: userIds[i] },
      update: { loftName: loftData[i].loftName },
      create: {
        id: userIds[i],
        name: `${loftData[i].firstName} ${loftData[i].lastName}`,
        lastName: loftData[i].lastName,
        email: `seed${i + 1}@pigeonpulse.dev`,
        emailVerified: true,
        loftName: loftData[i].loftName,
        role: "BREEDER",
        country: "US",
      },
    });
    users.push(u);
  }

  // Breeders
  const breeders = [];
  for (let i = 0; i < 4; i++) {
    const b = await prisma.breeder.upsert({
      where: { userId: userIds[i] },
      update: {},
      create: {
        firstName: loftData[i].firstName,
        lastName: loftData[i].lastName,
        country: "US",
        userId: userIds[i],
        status: 1,
      },
    });
    breeders.push(b);
  }

  // Event
  const event = await prisma.event.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: "2026 One Loft Center Race",
      shortName: "OLCR 2026",
      isOpen: 1,
    },
  });

  // Races
  const baseStart = new Date("2026-05-11T08:00:00Z");
  const raceConfigs = [
    { name: "Race # 1", desc: "Race # 1", dist: 150, daysOffset: 0, typeId: rtRace.id },
    { name: "Sprint Series # 1", desc: "Sprint Series # 1", dist: 57, daysOffset: 4, typeId: rtRace.id },
    { name: "Sprint Series # 2", desc: "Sprint Series # 2", dist: 75, daysOffset: 5, typeId: rtRace.id },
    { name: "Sprint Series # 3", desc: "Sprint Series # 3", dist: 75, daysOffset: 7, typeId: rtRace.id },
    { name: "Sprint Series Final", desc: "Sprint Series Final", dist: 103, daysOffset: 11, typeId: rtRace.id },
    { name: "Race # 2", desc: "Race # 2", dist: 185, daysOffset: 15, typeId: rtRace.id },
    { name: "Training # 1", desc: "Training # 1", dist: 71, daysOffset: -8, typeId: rtTraining.id },
    { name: "Training # 2", desc: "Training # 2", dist: 80, daysOffset: -6, typeId: rtTraining.id },
    { name: "Loft Fly", desc: "Loft Fly", dist: 1, daysOffset: -15, typeId: rtTraining.id },
  ];

  const races = [];
  for (let i = 0; i < raceConfigs.length; i++) {
    const cfg = raceConfigs[i];
    const startTime = new Date(baseStart);
    startTime.setDate(startTime.getDate() + cfg.daysOffset);
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 8);

    const r = await prisma.race.upsert({
      where: { id: i + 1 },
      update: {},
      create: {
        id: i + 1,
        eventId: event.id,
        name: cfg.name,
        description: cfg.desc,
        distance: cfg.dist,
        raceTypeId: cfg.typeId,
        startTime,
        endTime,
        status: RaceStatus.ENDED,
        location: "Bakersfield, CA",
        weather: "Sunny",
        temperature: "72",
        wind: "SW 5mph",
      },
    });
    races.push(r);
  }

  // EventInventories + Birds + Items + RaceItems
  const colors = ["BC", "BB", "WF", "CH", "GRZ"];
  const sexes = [1, 2, 1, 2, 1, 2];

  let birdCounter = 1;
  const allBirds: { bird: { id: number }; invItem: { id: number }; breederId: number; breederIdx: number }[] = [];

  for (let bi = 0; bi < 4; bi++) {
    const breeder = breeders[bi];

    const inv = await prisma.eventInventory.upsert({
      where: { id: bi + 1 },
      update: {},
      create: {
        id: bi + 1,
        eventId: event.id,
        breederId: breeder.id,
        signInDate: new Date("2026-03-01T00:00:00Z"),
      },
    });

    // 3 birds per breeder
    for (let bj = 0; bj < 3; bj++) {
      const bandNum = 554 + bi * 10 + bj;
      const bird = await prisma.bird.upsert({
        where: { id: birdCounter },
        update: {},
        create: {
          id: birdCounter,
          band: `2657${birdCounter}-AU26-${loftData[bi].lastName.slice(0, 4).toUpperCase()}`,
          band1: `${bandNum}`,
          band2: "AU26",
          band3: loftData[bi].lastName.slice(0, 4).toUpperCase(),
          band4: String(bandNum),
          birdName: `${loftData[bi].lastName} ${bandNum}`,
          color: colors[birdCounter % colors.length],
          sex: sexes[birdCounter % sexes.length],
          isActive: 1,
          breederId: breeder.id,
          rfid: `RF${String(birdCounter).padStart(6, "0")}`,
        },
      });

      const invItem = await prisma.eventInventoryItem.upsert({
        where: { id: birdCounter },
        update: {},
        create: {
          id: birdCounter,
          birdId: bird.id,
          eventInventoryId: inv.id,
          arrivalDate: new Date("2026-03-05T00:00:00Z"),
        },
      });

      allBirds.push({ bird, invItem, breederId: breeder.id, breederIdx: bi });
      birdCounter++;
    }
  }

  // RaceItems + Results for each race
  let raceItemId = 1;
  for (let ri = 0; ri < races.length; ri++) {
    const race = races[ri];
    const startMs = race.startTime!.getTime();
    const distYards = (race.distance ?? 1) * 1760;

    // Sort birds by simulated speed (varies per race/bird)
    const birdData = allBirds.map((b, idx) => {
      const baseSpeed = 1200 + (idx * 37 + ri * 83) % 700; // 1200-1900 YPM
      const flightMins = distYards / baseSpeed;
      const arrivalMs = startMs + flightMins * 60000;
      return { ...b, arrivalMs, rank: 0 };
    });
    birdData.sort((a, b) => a.arrivalMs - b.arrivalMs);
    birdData.forEach((b, idx) => (b.rank = idx + 1));

    for (const bd of birdData) {
      const raceItem = await prisma.raceItem.upsert({
        where: { id: raceItemId },
        update: {},
        create: {
          id: raceItemId,
          raceId: race.id,
          inventoryItemId: bd.invItem.id,
          status: RaceItemStatus.ARRIVED,
        },
      });

      await prisma.raceItemResult.upsert({
        where: { raceItemId: raceItem.id },
        update: {},
        create: {
          raceItemId: raceItem.id,
          arrivalTime: new Date(bd.arrivalMs),
          birdPosition: bd.rank,
          prizeValue: bd.rank <= 5 ? (6 - bd.rank) * 100 : 0,
        },
      });

      raceItemId++;
    }
  }

  console.log(`Seeded: 4 breeders, ${birdCounter - 1} birds, ${races.length} races, ${raceItemId - 1} race items`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect?.());
