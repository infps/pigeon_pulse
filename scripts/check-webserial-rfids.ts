/**
 * Can the web serial scanner read every RFID in the DB?
 * Feeds each Bird.rfid through the real serial line parser (useWebSerial.parseMessage)
 * in both reader formats, then resolves it the way /api/admin/race/[raceId]/scan does
 * (band = ringNo OR rfid = ringNo). Read-only.
 *
 *   npx tsx scripts/check-webserial-rfids.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { parseMessage } from "../src/hooks/useWebSerial";

const mc2100 = (tag: string) => `${tag}-3E-05.09.26 04:17:29.58-001`; // real MC2100 line
const legacy = (tag: string) => `SN000/002:${tag}`; // legacy colon line

async function main() {
  const birds = await prisma.bird.findMany({
    where: { rfid: { not: null } },
    select: { id: true, band: true, rfid: true },
  });

  // scan route lookup: any bird whose band or rfid equals the read value
  const byKey = new Map<string, Set<number>>();
  const add = (k: string | null, id: number) => {
    if (!k) return;
    if (!byKey.has(k)) byKey.set(k, new Set());
    byKey.get(k)!.add(id);
  };
  const all = await prisma.bird.findMany({ select: { id: true, band: true, rfid: true } });
  for (const b of all) { add(b.band, b.id); add(b.rfid, b.id); }

  const fails: Record<string, { id: number; rfid: string; got?: string }[]> = {};
  const fail = (why: string, id: number, rfid: string, got?: string) => (fails[why] ??= []).push({ id, rfid, got });
  let ok = 0, okMc = 0, okLegacy = 0;
  const shapes = new Map<string, number>();

  for (const { id, rfid } of birds) {
    const tag = rfid!;
    const shape = /^[0-9A-F]{8}$/.test(tag) ? "8 hex upper"
      : /^[0-9a-fA-F]{8}$/.test(tag) ? "8 hex mixed/lower"
      : /^[0-9A-Za-z]+$/.test(tag) ? `alnum len ${tag.length}`
      : "other chars";
    shapes.set(shape, (shapes.get(shape) ?? 0) + 1);

    // a reader sends the chip id; try both line formats, pass if either resolves to this bird
    let pass = false;
    for (const [fmt, line] of [["mc2100", mc2100(tag)], ["legacy", legacy(tag)]] as const) {
      const parsed = parseMessage(line);
      if (!parsed) continue;
      const hits = byKey.get(parsed.rfid);
      if (!hits?.has(id)) { if (fmt === "mc2100" && parsed.rfid !== tag) fail("parser altered tag", id, tag, parsed.rfid); continue; }
      if (hits.size > 1) { fail("ambiguous: value matches >1 bird", id, tag); continue; }
      pass = true;
      if (fmt === "mc2100") okMc++; else okLegacy++;
      break;
    }
    if (pass) ok++;
    else if (!Object.values(fails).some((l) => l.at(-1)?.id === id)) fail("unparseable by both formats", id, tag);
  }

  console.log(`birds with rfid: ${birds.length} / ${all.length} total`);
  console.log("rfid shapes:", Object.fromEntries(shapes));
  console.log(`scannable: ${ok} (mc2100 line: ${okMc}, legacy line: ${okLegacy}), failing: ${birds.length - ok}`);
  for (const [why, list] of Object.entries(fails)) {
    console.log(`\n${why}: ${list.length}`);
    for (const f of list.slice(0, 10)) console.log(`  bird ${f.id} rfid=${JSON.stringify(f.rfid)}${f.got ? ` -> ${f.got}` : ""}`);
  }
  await prisma.$disconnect();
  process.exitCode = ok === birds.length ? 0 : 1;
}
main();
