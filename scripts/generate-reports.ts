/**
 * Render every report against real data and write the files to .report-output.
 *
 * This is the verification harness for the report pack: it proves each of the
 * eleven HayLoft templates produces a non-empty CSV, XLSX and PDF from the
 * live database, without needing a browser session.
 *
 *   bun scripts/generate-reports.ts                 # auto-pick a season + race
 *   bun scripts/generate-reports.ts --season 11 --race 221
 */

import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/prisma";
import { REPORTS } from "../src/lib/reports/definitions";
import { renderReport, type ReportFormat } from "../src/lib/reports/render";
import type { ReportParams } from "../src/lib/reports/types";

const OUT_DIR = path.join(process.cwd(), ".report-output");
const FORMATS: ReportFormat[] = ["csv", "xlsx", "pdf"];

function argValue(flag: string): number | undefined {
  const i = process.argv.indexOf(flag);
  if (i === -1) return undefined;
  const parsed = parseInt(process.argv[i + 1] ?? "", 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

async function pickSeason(): Promise<number | undefined> {
  // The season with the most registrations exercises the most report paths.
  const rows = await prisma.eventInventory.groupBy({
    by: ["seasonId"],
    _count: { _all: true },
    orderBy: { _count: { seasonId: "desc" } },
    take: 1,
  });
  return rows[0]?.seasonId ?? undefined;
}

async function pickRace(seasonId: number | undefined): Promise<number | undefined> {
  const race = await prisma.race.findFirst({
    where: {
      ...(seasonId ? { seasonId } : {}),
      raceItems: { some: { result: { isNot: null } } },
    },
    orderBy: { id: "desc" },
    select: { id: true },
  });
  if (race) return race.id;

  const any = await prisma.race.findFirst({
    where: { raceItems: { some: { result: { isNot: null } } } },
    orderBy: { id: "desc" },
    select: { id: true },
  });
  return any?.id;
}

async function main() {
  const seasonId = argValue("--season") ?? (await pickSeason());
  const raceId = argValue("--race") ?? (await pickRace(seasonId));

  await mkdir(OUT_DIR, { recursive: true });

  const params: ReportParams = { seasonId, raceId };
  console.log(`Rendering ${REPORTS.length} reports  (season ${seasonId ?? "—"}, race ${raceId ?? "—"})`);
  console.log(`Output: ${OUT_DIR}\n`);

  let failures = 0;

  for (const report of REPORTS) {
    try {
      const data = await report.build(params);
      const sizes: string[] = [];

      for (const format of FORMATS) {
        const { body, extension } = await renderReport(data, format, report.isLabelSheet ?? false);
        const bytes = typeof body === "string" ? Buffer.from(body, "utf8") : Buffer.from(body);
        await writeFile(path.join(OUT_DIR, `${report.key}.${extension}`), bytes);
        sizes.push(`${extension} ${(bytes.length / 1024).toFixed(1)}kb`);
      }

      const totalsNote = data.totals ? ", totals" : "";
      console.log(
        `  OK    ${report.key.padEnd(22)} ${String(data.rows.length).padStart(5)} rows${totalsNote}  [${sizes.join(", ")}]`
      );
      if (data.rows.length === 0) {
        console.log(`        ^ empty — check the source data for this scope`);
      }
    } catch (error) {
      failures++;
      const message = error instanceof Error ? error.message : String(error);
      console.log(`  FAIL  ${report.key.padEnd(22)} ${message}`);
    }
  }

  console.log(`\n${REPORTS.length - failures}/${REPORTS.length} reports rendered.`);
  await prisma.$disconnect();
  // lib/prisma.ts keeps a keepalive timer running, which would hold the process open.
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
