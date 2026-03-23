import { NextResponse } from "next/server";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const RFIDS = ["MOCK-RFID-001", "MOCK-RFID-002", "MOCK-RFID-003", "MOCK-RFID-004", "MOCK-RFID-005"];
const STATE_FILE = join(process.cwd(), ".mock-scanner-state.json");

function getNextIndex(): number {
  try {
    const data = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
    return data.nextIndex ?? 0;
  } catch {
    return 0;
  }
}

function saveNextIndex(index: number) {
  writeFileSync(STATE_FILE, JSON.stringify({ nextIndex: index }));
}

export async function POST() {
  const index = getNextIndex();
  const rfid = RFIDS[index % RFIDS.length];
  saveNextIndex(index + 1);
  return NextResponse.json([{ el: rfid }]);
}
