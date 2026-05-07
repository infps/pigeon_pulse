import { prisma } from "@/lib/prisma";

export interface ExportData {
  columns: string[];
  rows: string[][];
  title: string;
}

const SEX_LABEL: Record<number, string> = { 0: "Cock", 1: "Hen", 2: "Unknown" };

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return isNaN(dt.getTime()) ? "" : dt.toLocaleDateString();
}

function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return isNaN(dt.getTime()) ? "" : dt.toLocaleString();
}

export async function getRegistrationRows(
  breederId: number,
  eventId?: number,
): Promise<ExportData> {
  const where: { breederId: number; eventId?: number } = { breederId };
  if (eventId) where.eventId = eventId;

  const inventories = await prisma.eventInventory.findMany({
    where,
    include: {
      event: true,
      items: { include: { bird: true } },
      payments: true,
    },
    orderBy: { signInDate: "desc" },
  });

  const columns = [
    "Event",
    "Event Date",
    "Loft",
    "Sign-In Date",
    "Birds",
    "Total Fees",
    "Total Paid",
    "Balance",
  ];

  const rows: string[][] = inventories.map((inv) => {
    const totalOwed = (inv.items ?? []).reduce(
      (s, i) =>
        s +
        (i.entryFeeValue ?? 0) +
        (i.perchFeeValue ?? 0) +
        (i.raceFeeValue ?? 0) +
        (i.hotSpotFeeValue ?? 0),
      0,
    );
    const totalPaid = (inv.payments ?? []).reduce(
      (s, p) => s + (p.paymentValue ?? 0),
      0,
    );
    return [
      inv.event?.name ?? "",
      fmtDate(inv.event?.eventDate ?? null),
      inv.loft ?? "",
      fmtDate(inv.signInDate ?? null),
      String(inv.items?.length ?? 0),
      totalOwed.toFixed(2),
      totalPaid.toFixed(2),
      (totalOwed - totalPaid).toFixed(2),
    ];
  });

  return {
    columns,
    rows,
    title: eventId
      ? `Registrations - ${inventories[0]?.event?.name ?? `Event ${eventId}`}`
      : "My Registrations",
  };
}

export async function getResultsRows(
  breederId: number,
  eventId?: number,
  raceId?: number,
): Promise<ExportData> {
  const raceItems = await prisma.raceItem.findMany({
    where: {
      ...(raceId ? { raceId } : {}),
      inventoryItem: {
        eventInventory: {
          breederId,
          ...(eventId ? { eventId } : {}),
        },
      },
    },
    include: {
      race: { include: { event: true } },
      result: true,
      inventoryItem: { include: { bird: true } },
    },
    orderBy: [{ raceId: "asc" }, { id: "asc" }],
  });

  const columns = [
    "Event",
    "Race",
    "Race Date",
    "Band",
    "Bird Name",
    "Status",
    "Position",
    "Arrival Time",
    "Prize",
  ];

  const rows: string[][] = raceItems.map((ri) => [
    ri.race?.event?.name ?? "",
    ri.race?.name || ri.race?.description || `Race ${ri.race?.id ?? ""}`,
    fmtDate(ri.race?.startTime ?? null),
    ri.inventoryItem?.bird?.band ?? "",
    ri.inventoryItem?.bird?.birdName ?? "",
    String(ri.status ?? ""),
    ri.result?.birdPosition != null ? String(ri.result.birdPosition) : "",
    fmtDateTime(ri.result?.arrivalTime ?? null),
    ri.result?.prizeValue != null ? ri.result.prizeValue.toFixed(2) : "",
  ]);

  return { columns, rows, title: "My Race Results" };
}

export async function getBasketsRows(
  breederId: number,
  eventId: number,
): Promise<ExportData> {
  const assignments = await prisma.basketAssignment.findMany({
    where: {
      eventBasket: { eventId },
      inventoryItem: {
        eventInventory: { breederId, eventId },
      },
    },
    include: {
      eventBasket: true,
      inventoryItem: { include: { bird: true } },
    },
    orderBy: { eventBasketId: "asc" },
  });

  const event = await prisma.event.findUnique({ where: { id: eventId } });

  const columns = [
    "Basket Label",
    "Basket No",
    "Phase",
    "Capacity",
    "Band",
    "Bird Name",
    "Assigned At",
  ];

  const rows: string[][] = assignments.map((a) => [
    a.eventBasket.label ?? "",
    String(a.eventBasket.basketNo),
    String(a.eventBasket.phase),
    String(a.eventBasket.capacity),
    a.inventoryItem?.bird?.band ?? "",
    a.inventoryItem?.bird?.birdName ?? "",
    fmtDateTime(a.assignedAt),
  ]);

  return {
    columns,
    rows,
    title: `Baskets - ${event?.name ?? `Event ${eventId}`}`,
  };
}

export async function getBirdsRows(breederId: number): Promise<ExportData> {
  const birds = await prisma.bird.findMany({
    where: { breederId },
    orderBy: { birdName: "asc" },
  });

  const columns = [
    "Band",
    "Bird Name",
    "Color",
    "Sex",
    "RFID",
    "Active",
    "Lost",
  ];

  const rows: string[][] = birds.map((b) => [
    b.band ?? "",
    b.birdName ?? "",
    b.color ?? "",
    b.sex != null ? (SEX_LABEL[b.sex] ?? String(b.sex)) : "",
    b.rfid ?? "",
    b.isActive ? "Yes" : "No",
    b.isLost ? "Yes" : "No",
  ]);

  return { columns, rows, title: "My Birds" };
}
