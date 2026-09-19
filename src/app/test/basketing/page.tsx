"use client";

/**
 * Demo: Basketing scanner tabs — no real API, fully in-memory.
 * RFIDs: 8-char hex matching MC2100 old_scanner_client.py output.
 * Statuses demoed: REGISTERED, CHECKED_IN, BASKETED, RELEASED, ARRIVED,
 *                  LOST, STRAY, IGNORED, FOREIGN_BIRD
 * Health statuses: HEALTHY, INJURED, HOSPITALIZED, DEAD (visual only)
 */

import { useState, useCallback, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, CheckCircle2, Radio, Skull, Heart, Stethoscope, BandageIcon } from "lucide-react";
import { toast } from "sonner";
import { createCheckinColumns } from "@/app/admin/events/[eventId]/checkin-columns";
import type { CheckinStatusItem } from "@/lib/types";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────

type RaceStatus =
  | "REGISTERED"
  | "CHECKED_IN"
  | "BASKETED"
  | "RELEASED"
  | "ARRIVED"
  | "LOST"
  | "STRAY"
  | "IGNORED"
  | "FOREIGN_BIRD";

type HealthStatus = "HEALTHY" | "INJURED" | "HOSPITALIZED" | "DEAD";

interface DemoBird {
  id: number;
  rfid: string | null;
  band: string;
  birdName: string;
  color: string;
  sex: 1 | 2;
  attention: boolean;
  note: string | null;
  breederFirstName: string;
  breederLastName: string;
  hasPaid: boolean;
  raceStatus: RaceStatus;
  healthStatus: HealthStatus;
  statusNote: string | null;
  basket: string | null;
  group: string | null;
}

// ─── Demo birds ──────────────────────────────────────────────────────────────

const INITIAL_BIRDS: DemoBird[] = [
  { id: 1, rfid: null,       band: "AU-2024-ABC-1001", birdName: "Blue Thunder",  color: "Blue Bar",     sex: 1, attention: true,  note: "Strong performer",            breederFirstName: "John",   breederLastName: "Smith",    hasPaid: true,  raceStatus: "REGISTERED",    healthStatus: "HEALTHY",      statusNote: null, basket: null, group: null },
  { id: 2, rfid: null,       band: "AU-2023-XYZ-2002", birdName: "Red Rocket",    color: "Red",          sex: 2, attention: false, note: null,                          breederFirstName: "Mary",   breederLastName: "Jones",    hasPaid: true,  raceStatus: "REGISTERED",    healthStatus: "HEALTHY",      statusNote: null, basket: null, group: null },
  { id: 3, rfid: null,       band: "IF-2022-DEF-3003",  birdName: "Silver Arrow",  color: "Silver",       sex: 1, attention: false, note: "Young bird, first season",    breederFirstName: "Bob",    breederLastName: "Williams", hasPaid: false, raceStatus: "REGISTERED",    healthStatus: "HEALTHY",      statusNote: null, basket: null, group: null },
  { id: 4, rfid: null,       band: "AU-2024-JKL-5005",  birdName: "Golden Wing",   color: "Yellow",       sex: 2, attention: true,  note: "Exceptional bloodline",       breederFirstName: "Alice",  breederLastName: "Brown",    hasPaid: true,  raceStatus: "REGISTERED",    healthStatus: "INJURED",      statusNote: "Wing sprain — visual flag only", basket: null, group: null },
  { id: 5, rfid: null,       band: "CU-2023-MNO-6006",  birdName: "Iron Fist",     color: "Blue Checker", sex: 1, attention: false, note: null,                          breederFirstName: "Tom",    breederLastName: "Davis",    hasPaid: true,  raceStatus: "REGISTERED",    healthStatus: "HEALTHY",      statusNote: null, basket: null, group: null },
  { id: 6, rfid: null,       band: "BB-2024-PQR-7007",  birdName: "Midnight Star", color: "Black",        sex: 2, attention: false, note: "Fast sprinter",               breederFirstName: "Sarah",  breederLastName: "Taylor",   hasPaid: true,  raceStatus: "REGISTERED",    healthStatus: "HEALTHY",      statusNote: null, basket: null, group: null },
  { id: 7, rfid: null,       band: "IPB-2023-VWX-9009", birdName: "White Flash",   color: "White",        sex: 2, attention: true,  note: "Aggressive in loft",          breederFirstName: "Linda",  breederLastName: "Moore",    hasPaid: false, raceStatus: "REGISTERED",    healthStatus: "HOSPITALIZED", statusNote: "Under treatment — visual flag only", basket: null, group: null },
  { id: 8, rfid: null,       band: "AU-2024-YZA-1010",  birdName: "Amber Dusk",    color: "Mealy",        sex: 1, attention: false, note: null,                          breederFirstName: "Carlos", breederLastName: "Garcia",   hasPaid: true,  raceStatus: "REGISTERED",    healthStatus: "HEALTHY",      statusNote: null, basket: null, group: null },
  // Pre-set: already lost from a prior flight (will appear as STRAY when scanned)
  { id: 9, rfid: "AAAABBBB", band: "AU-2023-STR-0001",  birdName: "Ghost Rider",   color: "Grizzle",      sex: 1, attention: false, note: null,                          breederFirstName: "John",   breederLastName: "Smith",    hasPaid: true,  raceStatus: "LOST",          healthStatus: "HEALTHY",      statusNote: "LOST at inventory flight Spring Run 1", basket: null, group: null },
];

// RFID assigned at check-in step — mapping bird id → rfid tag
const RFID_ASSIGN: Record<number, string> = {
  1: "4F7D5A06",
  2: "3E9A1B22",
  3: "A1B2C3D4",
  4: "5C6D7E8F",
  5: "F0E1D2C3",
  6: "D7E8F901",
  7: "B4A5960C",
  8: "CC112233",
};

// Basket assignment after BASKETED scan
const BASKET_ASSIGN: Record<string, { basket: string; group: string }> = {
  "4F7D5A06": { basket: "LB-SMITH-1",  group: "Group Red" },
  "3E9A1B22": { basket: "LB-SMITH-1",  group: "Group Red" },
  "A1B2C3D4": { basket: "LB-BROWN-1",  group: "Group Blue" },
  "5C6D7E8F": { basket: "LB-BROWN-1",  group: "Group Blue" },
  "F0E1D2C3": { basket: "LB-TAYLOR-1", group: "Group Green" },
  "D7E8F901": { basket: "LB-TAYLOR-1", group: "Group Green" },
  "B4A5960C": { basket: "LB-MOORE-1",  group: "Group Green" },
  "CC112233": { basket: "LB-GARCIA-1", group: "Group Blue" },
};

const RACE_BASKET_ASSIGN: Record<string, string> = {
  "4F7D5A06": "RB-01", "3E9A1B22": "RB-01",
  "A1B2C3D4": "RB-02", "5C6D7E8F": "RB-02",
  "F0E1D2C3": "RB-03", "D7E8F901": "RB-03",
  "B4A5960C": "RB-04", "CC112233": "RB-04",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusBadge(s: RaceStatus) {
  const map: Record<RaceStatus, { label: string; className: string }> = {
    REGISTERED:   { label: "Registered",   className: "bg-gray-100 text-gray-700 border-gray-300" },
    CHECKED_IN:   { label: "Checked In",   className: "bg-sky-100 text-sky-700 border-sky-300" },
    BASKETED:     { label: "Basketed",     className: "bg-blue-100 text-blue-700 border-blue-300" },
    RELEASED:     { label: "Released",     className: "bg-amber-100 text-amber-700 border-amber-300" },
    ARRIVED:      { label: "Arrived",      className: "bg-green-100 text-green-700 border-green-300" },
    LOST:         { label: "Lost",         className: "bg-red-100 text-red-700 border-red-300" },
    STRAY:        { label: "Stray",        className: "bg-purple-100 text-purple-700 border-purple-300" },
    IGNORED:      { label: "Ignored",      className: "bg-zinc-100 text-zinc-500 border-zinc-300" },
    FOREIGN_BIRD: { label: "Foreign",      className: "bg-orange-100 text-orange-700 border-orange-300" },
  };
  const { label, className } = map[s];
  return <Badge variant="outline" className={`text-xs ${className}`}>{label}</Badge>;
}

function healthBadge(h: HealthStatus, note?: string | null) {
  const map: Record<HealthStatus, { label: string; className: string; icon: React.ReactNode }> = {
    HEALTHY:      { label: "Healthy",      className: "bg-green-50 text-green-700 border-green-200",  icon: <Heart className="h-3 w-3" /> },
    INJURED:      { label: "Injured",      className: "bg-amber-50 text-amber-700 border-amber-200",  icon: <BandageIcon className="h-3 w-3" /> },
    HOSPITALIZED: { label: "Hospitalized", className: "bg-red-50 text-red-700 border-red-200",        icon: <Stethoscope className="h-3 w-3" /> },
    DEAD:         { label: "Dead",         className: "bg-zinc-100 text-zinc-500 border-zinc-300",    icon: <Skull className="h-3 w-3" /> },
  };
  const { label, className, icon } = map[h];
  return (
    <span title={note ?? undefined}>
      <Badge variant="outline" className={`text-xs gap-1 ${className}`}>
        {icon}{label}
      </Badge>
    </span>
  );
}

function findByRfid(birds: DemoBird[], rfid: string) {
  return birds.find((b) => b.rfid === rfid);
}

// ─── Legend panel ─────────────────────────────────────────────────────────────

function StatusLegend() {
  const raceStatuses: RaceStatus[] = ["REGISTERED","CHECKED_IN","BASKETED","RELEASED","ARRIVED","LOST","STRAY","IGNORED","FOREIGN_BIRD"];
  const healthStatuses: HealthStatus[] = ["HEALTHY","INJURED","HOSPITALIZED","DEAD"];
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Status Legend</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">Race / Flight</p>
          <div className="flex flex-wrap gap-1.5">
            {raceStatuses.map((s) => <span key={s}>{statusBadge(s)}</span>)}
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">Health (visual only)</p>
          <div className="flex flex-wrap gap-1.5">
            {healthStatuses.map((h) => <span key={h}>{healthBadge(h)}</span>)}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          STRAY = lost bird reappears in its own event's flock (no rank). IGNORED = admin skips bird for this race. FOREIGN = scanned at wrong event.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Bird table ───────────────────────────────────────────────────────────────

function BirdTable({ birds, onIgnore, onMarkLost }: {
  birds: DemoBird[];
  onIgnore?: (id: number) => void;
  onMarkLost?: (id: number) => void;
}) {
  return (
    <div className="border rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted text-muted-foreground sticky top-0">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Bird</th>
            <th className="px-3 py-2 text-left font-medium">Band</th>
            <th className="px-3 py-2 text-left font-medium">Breeder</th>
            <th className="px-3 py-2 text-left font-medium">RFID</th>
            <th className="px-3 py-2 text-left font-medium">Race Status</th>
            <th className="px-3 py-2 text-left font-medium">Health</th>
            <th className="px-3 py-2 text-left font-medium">Basket</th>
            <th className="px-3 py-2 text-left font-medium">Note</th>
            {(onIgnore || onMarkLost) && <th className="px-3 py-2 text-left font-medium">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y">
          {birds.map((b) => (
            <tr key={b.id} className={
              b.raceStatus === "LOST" ? "bg-red-50" :
              b.raceStatus === "STRAY" ? "bg-purple-50" :
              b.raceStatus === "IGNORED" ? "bg-zinc-50 opacity-60" :
              b.healthStatus !== "HEALTHY" ? "bg-amber-50/40" : undefined
            }>
              <td className="px-3 py-2 font-medium">
                {b.birdName}
                {b.attention && <AlertTriangle className="inline h-3.5 w-3.5 text-amber-500 ml-1" />}
              </td>
              <td className="px-3 py-2 font-mono text-xs">{b.band}</td>
              <td className="px-3 py-2 text-muted-foreground">{b.breederFirstName} {b.breederLastName}</td>
              <td className="px-3 py-2 font-mono text-xs">{b.rfid ?? <span className="text-muted-foreground">—</span>}</td>
              <td className="px-3 py-2">
                <div className="space-y-0.5">
                  {statusBadge(b.raceStatus)}
                  {b.statusNote && <p className="text-[10px] text-muted-foreground">{b.statusNote}</p>}
                </div>
              </td>
              <td className="px-3 py-2">{healthBadge(b.healthStatus, b.statusNote)}</td>
              <td className="px-3 py-2 text-xs">{b.basket ?? <span className="text-muted-foreground">—</span>}</td>
              <td className="px-3 py-2 text-xs text-muted-foreground max-w-[140px] truncate">{b.note ?? "—"}</td>
              {(onIgnore || onMarkLost) && (
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    {onIgnore && b.raceStatus !== "IGNORED" && b.raceStatus !== "ARRIVED" && b.raceStatus !== "LOST" && (
                      <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => onIgnore(b.id)}>
                        Ignore
                      </Button>
                    )}
                    {onMarkLost && b.raceStatus === "RELEASED" && (
                      <Button size="sm" variant="outline" className="h-6 text-xs px-2 text-red-600 border-red-300" onClick={() => onMarkLost(b.id)}>
                        Mark Lost
                      </Button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// TAB 1 — CHECK-IN  (assign RFID → CHECKED_IN)
// ============================================================

const CHECKIN_SEQUENCE = [
  { birdId: 1, rfid: "4F7D5A06" }, // Blue Thunder / Smith
  { birdId: 2, rfid: "3E9A1B22" }, // Red Rocket / Jones
  { birdId: 3, rfid: "A1B2C3D4" }, // Silver Arrow / Williams (unpaid)
  { birdId: 4, rfid: "5C6D7E8F" }, // Golden Wing / Brown (injured — visual flag)
  { birdId: 5, rfid: "F0E1D2C3" }, // Iron Fist / Davis
  { birdId: 6, rfid: "D7E8F901" }, // Midnight Star / Taylor
  { birdId: 7, rfid: "B4A5960C" }, // White Flash / Moore (unpaid + hospitalized)
  { birdId: 8, rfid: "CC112233" }, // Amber Dusk / Garcia
  // Duplicate re-scan
  { birdId: 1, rfid: "4F7D5A06" },
  // Foreign
  { birdId: null, rfid: "DEADBEEF" },
  // STRAY: Ghost Rider (LOST bird from same event reappears)
  { birdId: 9, rfid: "AAAABBBB", stray: true },
];

function CheckinDemoTab() {
  const [birds, setBirds] = useState<DemoBird[]>(INITIAL_BIRDS.map((b) => ({ ...b })));
  const [scanIdx, setScanIdx] = useState(0);
  const [lastScan, setLastScan] = useState<string | null>(null);

  const checkedIn = birds.filter((b) => b.raceStatus !== "REGISTERED").length;

  const fireNextScan = useCallback(() => {
    if (scanIdx >= CHECKIN_SEQUENCE.length) { toast.info("Sequence done — reset"); return; }
    const step = CHECKIN_SEQUENCE[scanIdx] as any;
    setScanIdx((i) => i + 1);

    if (!step.birdId) {
      toast.warning(`Foreign bird: ${step.rfid} — not in this event`);
      setLastScan(`FOREIGN: ${step.rfid}`);
      return;
    }

    setBirds((prev) => {
      const bird = prev.find((b) => b.id === step.birdId);
      if (!bird) return prev;

      if (bird.raceStatus === "CHECKED_IN" || bird.raceStatus === "BASKETED") {
        toast.info(`Already checked in: ${bird.birdName}`);
        setLastScan(`DUPLICATE: ${bird.birdName}`);
        return prev;
      }

      // STRAY: lost bird from same event reappears
      if (step.stray && bird.raceStatus === "LOST") {
        toast.success(`STRAY: ${bird.birdName} reappeared — no rank`);
        setLastScan(`STRAY: ${bird.birdName}`);
        return prev.map((b) => b.id === step.birdId
          ? { ...b, rfid: step.rfid, raceStatus: "STRAY" as RaceStatus, statusNote: `Lost at ${b.statusNote?.replace("LOST at ", "") ?? "prior flight"}` }
          : b
        );
      }

      if (bird.healthStatus !== "HEALTHY") {
        toast.warning(`${bird.birdName} flagged: ${bird.healthStatus} — checking in anyway (visual only)`);
      }
      if (!bird.hasPaid) {
        toast.warning(`${bird.birdName} unpaid — checking in but flagged`);
      } else {
        toast.success(`Checked in: ${bird.birdName} (${step.rfid})`);
      }
      setLastScan(`CHECKED_IN: ${bird.birdName} — ${step.rfid}`);
      return prev.map((b) => b.id === step.birdId
        ? { ...b, rfid: step.rfid, raceStatus: "CHECKED_IN" as RaceStatus }
        : b
      );
    });
  }, [scanIdx]);

  const handleIgnore = (id: number) => {
    setBirds((prev) => prev.map((b) => b.id === id
      ? { ...b, raceStatus: "IGNORED" as RaceStatus, statusNote: "Didn't fly" }
      : b
    ));
    const bird = birds.find((b) => b.id === id);
    toast.info(`${bird?.birdName} ignored for this race`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Check-in — Assign RFID</p>
              <p className="text-xs text-muted-foreground">Each scan assigns RFID → CHECKED_IN. Covers: duplicate, foreign, unpaid, injured (visual), stray (lost bird reappears), IGNORED action.</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" onClick={fireNextScan} disabled={scanIdx >= CHECKIN_SEQUENCE.length} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                Simulate Scan ({scanIdx + 1}/{CHECKIN_SEQUENCE.length})
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setScanIdx(0); setBirds(INITIAL_BIRDS.map(b => ({...b}))); setLastScan(null); }}>Reset</Button>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>Checked In: <strong>{checkedIn}/{birds.length}</strong></span>
              <span className="text-muted-foreground">{Math.round(checkedIn / birds.length * 100)}%</span>
            </div>
            <Progress value={checkedIn / birds.length * 100} className="h-2" />
          </div>
          {lastScan && (
            <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
              <span className="font-mono text-xs">{lastScan}</span>
              <button onClick={() => setLastScan(null)} className="ml-auto text-muted-foreground hover:text-foreground text-xs">✕</button>
            </div>
          )}
        </CardContent>
      </Card>
      <BirdTable birds={birds} onIgnore={handleIgnore} />
    </div>
  );
}

// ============================================================
// TAB 2 — BASKET SCAN  (BASKETED — loft + race baskets)
// ============================================================

const BASKET_SCAN_SEQUENCE = [
  { rfid: "4F7D5A06" }, // Blue Thunder → LB-SMITH-1, Group Red
  { rfid: "3E9A1B22" }, // Red Rocket → LB-SMITH-1, Group Red
  { rfid: "5C6D7E8F" }, // Golden Wing → LB-BROWN-1, Group Blue (INJURED — visual flag)
  { rfid: "F0E1D2C3" }, // Iron Fist → LB-TAYLOR-1, Group Green
  { rfid: "DEADBEEF" }, // Foreign
  { rfid: "4F7D5A06" }, // Duplicate
  { rfid: "D7E8F901" }, // Midnight Star → LB-TAYLOR-1, Group Green
  { rfid: "B4A5960C" }, // White Flash → LB-MOORE-1, Group Green (unpaid + hospitalized)
  { rfid: "CC112233" }, // Amber Dusk → LB-GARCIA-1, Group Blue
];

type HeroScan =
  | { status: "placed"; rfid: string; birdName: string | null; band: string | null; breeder: string; basket: string; group: string; color: string; sex: string; attention: boolean; note: string | null; health: HealthStatus; healthNote: string | null }
  | { status: "foreign"; rfid: string }
  | { status: "duplicate"; rfid: string; basket: string }
  | { status: "unassigned"; rfid: string; birdName: string | null };

function BasketScanDemoTab() {
  const [birds, setBirds] = useState<DemoBird[]>(
    INITIAL_BIRDS.map((b) => ({ ...b, rfid: RFID_ASSIGN[b.id] ?? b.rfid, raceStatus: b.id <= 8 ? "CHECKED_IN" as RaceStatus : b.raceStatus }))
  );
  const [scanIdx, setScanIdx] = useState(0);
  const [hero, setHero] = useState<HeroScan | null>(null);
  const [log, setLog] = useState<{ rfid: string; birdName: string; basket: string; group: string; time: string }[]>([]);
  const scannedRfids = useRef<Set<string>>(new Set());

  const fireScan = useCallback(() => {
    if (scanIdx >= BASKET_SCAN_SEQUENCE.length) { toast.info("Done — reset"); return; }
    const { rfid } = BASKET_SCAN_SEQUENCE[scanIdx];
    setScanIdx((i) => i + 1);

    if (scannedRfids.current.has(rfid)) {
      const assign = BASKET_ASSIGN[rfid];
      setHero({ status: "duplicate", rfid, basket: assign?.basket ?? "?" });
      toast.info(`Already basketed: ${rfid}`);
      return;
    }

    const bird = birds.find((b) => b.rfid === rfid);
    if (!bird) {
      setHero({ status: "foreign", rfid });
      toast.warning(`Foreign: ${rfid}`);
      return;
    }

    const assign = BASKET_ASSIGN[rfid];
    if (!assign) {
      setHero({ status: "unassigned", rfid, birdName: bird.birdName });
      toast.warning(`${bird.birdName} — no basket assigned`);
      return;
    }

    scannedRfids.current.add(rfid);
    const statusNote = `Loft flight, ${assign.basket}, ${assign.group}`;

    if (bird.healthStatus !== "HEALTHY") {
      toast.warning(`${bird.birdName} flagged: ${bird.healthStatus} — basketed anyway (visual only)`);
    } else {
      toast.success(`${bird.birdName} → ${assign.basket}`);
    }

    setBirds((prev) => prev.map((b) => b.rfid === rfid
      ? { ...b, raceStatus: "BASKETED" as RaceStatus, basket: assign.basket, group: assign.group, statusNote }
      : b
    ));
    setHero({
      status: "placed",
      rfid,
      birdName: bird.birdName,
      band: bird.band,
      breeder: `${bird.breederFirstName} ${bird.breederLastName}`,
      basket: assign.basket,
      group: assign.group,
      color: bird.color,
      sex: bird.sex === 1 ? "Cock" : "Hen",
      attention: bird.attention,
      note: bird.note,
      health: bird.healthStatus,
      healthNote: bird.statusNote,
    });
    setLog((prev) => [{ rfid, birdName: bird.birdName, basket: assign.basket, group: assign.group, time: new Date().toISOString() }, ...prev]);
  }, [scanIdx, birds]);

  const reset = () => {
    setScanIdx(0);
    setHero(null);
    setLog([]);
    scannedRfids.current.clear();
    setBirds(INITIAL_BIRDS.map((b) => ({ ...b, rfid: RFID_ASSIGN[b.id] ?? b.rfid, raceStatus: b.id <= 8 ? "CHECKED_IN" as RaceStatus : b.raceStatus })));
  };

  const basketed = birds.filter((b) => b.raceStatus === "BASKETED").length;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Basket Scan — BASKETED status</p>
            <p className="text-xs text-muted-foreground">Covers: normal, foreign, duplicate, injured/hospitalized (visual flag), unpaid. Note records basket + group.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" onClick={fireScan} disabled={scanIdx >= BASKET_SCAN_SEQUENCE.length} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              Scan ({scanIdx + 1}/{BASKET_SCAN_SEQUENCE.length})
            </Button>
            <Button size="sm" variant="ghost" onClick={reset}>Reset</Button>
          </div>
        </CardContent>
      </Card>

      {/* Hero */}
      {hero ? (
        <div className={`rounded-xl border-2 p-4 ${
          hero.status === "placed" ? "border-green-400 bg-green-50" :
          hero.status === "duplicate" ? "border-blue-300 bg-blue-50" :
          hero.status === "foreign" ? "border-red-400 bg-red-50" : "border-amber-400 bg-amber-50"
        }`}>
          <div className="flex items-start gap-4">
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white text-xl font-bold ${
              hero.status === "placed" ? "bg-green-500" :
              hero.status === "duplicate" ? "bg-blue-400" :
              hero.status === "foreign" ? "bg-red-500" : "bg-amber-500"
            }`}>
              {hero.status === "placed" ? "✓" : hero.status === "duplicate" ? "↩" : hero.status === "foreign" ? "!" : "?"}
            </div>
            <div className="flex-1">
              {hero.status === "foreign" && <>
                <span className="text-xs font-bold uppercase tracking-widest text-red-700">Foreign Bird</span>
                <p className="text-xl font-bold font-mono mt-0.5">{hero.rfid}</p>
                <p className="text-sm text-muted-foreground">Not registered in this event</p>
              </>}
              {hero.status === "duplicate" && <>
                <span className="text-xs font-bold uppercase tracking-widest text-blue-700">Already Basketed</span>
                <p className="text-xl font-bold font-mono mt-0.5">{hero.rfid}</p>
                <p className="text-sm text-muted-foreground">Basket: <strong>{hero.basket}</strong></p>
              </>}
              {hero.status === "unassigned" && <>
                <span className="text-xs font-bold uppercase tracking-widest text-amber-700">No Basket Assigned</span>
                <p className="text-xl font-bold font-mono mt-0.5">{hero.birdName ?? hero.rfid}</p>
              </>}
              {hero.status === "placed" && <>
                <span className="text-xs font-bold uppercase tracking-widest text-green-700">Place in Basket</span>
                <p className="text-xl font-bold font-mono mt-0.5">{hero.band}</p>
                {hero.birdName && <p className="text-sm text-muted-foreground">{hero.birdName}</p>}
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
                  <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Basket</p><p className="font-bold text-green-700 text-lg">{hero.basket}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Group</p><p>{hero.group}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Breeder</p><p>{hero.breeder}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Color</p><p>{hero.color}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Sex</p><p>{hero.sex}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Health</p><p>{healthBadge(hero.health, hero.healthNote)}</p></div>
                </div>
                {hero.attention && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg bg-red-100 border border-red-300 px-3 py-2">
                    <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                    <p className="font-bold text-red-700">ATTENTION REQUIRED</p>
                  </div>
                )}
                {hero.health !== "HEALTHY" && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-300 px-3 py-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <p className="text-sm text-amber-700">Health: <strong>{hero.health}</strong> — visual flag only, basketing allowed</p>
                  </div>
                )}
              </>}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          Scan a bird to see basket assignment
        </div>
      )}

      {/* Log */}
      {log.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-medium">#</th>
                <th className="px-3 py-2 text-left font-medium">Bird</th>
                <th className="px-3 py-2 text-left font-medium">Basket</th>
                <th className="px-3 py-2 text-left font-medium">Group</th>
                <th className="px-3 py-2 text-left font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {log.map((r, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 text-muted-foreground">{log.length - i}</td>
                  <td className="px-3 py-2 font-medium">{r.birdName}</td>
                  <td className="px-3 py-2 font-medium text-primary">{r.basket}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.group}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(r.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-xs text-muted-foreground pt-1">{basketed} basketed · {birds.filter(b => b.raceStatus === "CHECKED_IN").length} still waiting</div>
      <BirdTable birds={birds} />
    </div>
  );
}

// ============================================================
// TAB 3 — RACE (RELEASED → ARRIVED / LOST / STRAY / IGNORED)
// ============================================================

const RACE_SCAN_SEQUENCE = [
  { rfid: "4F7D5A06" }, // Blue Thunder → ARRIVED #1
  { rfid: "3E9A1B22" }, // Red Rocket → ARRIVED #2
  { rfid: "F0E1D2C3" }, // Iron Fist → ARRIVED #3
  { rfid: "D7E8F901" }, // Midnight Star → ARRIVED #4
  { rfid: "4F7D5A06" }, // Duplicate → already arrived
  { rfid: "DEADBEEF" }, // Foreign
  { rfid: "AAAABBBB" }, // Ghost Rider (STRAY — lost bird from same event)
  { rfid: "CC112233" }, // Amber Dusk → ARRIVED #5
];

function RaceDemoTab() {
  // Start state: all BASKETED birds → RELEASED (simulating race start)
  const initial = INITIAL_BIRDS.map((b) => ({
    ...b,
    rfid: RFID_ASSIGN[b.id] ?? b.rfid,
    raceStatus: (b.id <= 8 ? "RELEASED" : b.raceStatus) as RaceStatus,
    basket: BASKET_ASSIGN[RFID_ASSIGN[b.id] ?? ""]?.basket ?? null,
    group: BASKET_ASSIGN[RFID_ASSIGN[b.id] ?? ""]?.group ?? null,
    statusNote: b.id <= 8 ? `Flown at Spring Race 1 at 08:00` : b.statusNote,
  }));

  const [birds, setBirds] = useState<DemoBird[]>(initial);
  const [scanIdx, setScanIdx] = useState(0);
  const [arrivedCount, setArrivedCount] = useState(0);
  const scannedRfids = useRef<Set<string>>(new Set());

  const handleIgnore = (id: number) => {
    setBirds((prev) => prev.map((b) => b.id === id
      ? { ...b, raceStatus: "IGNORED" as RaceStatus, statusNote: "Didn't fly" }
      : b
    ));
    toast.info(`${birds.find(b => b.id === id)?.birdName} ignored`);
  };

  const handleMarkLost = (id: number) => {
    const bird = birds.find((b) => b.id === id);
    setBirds((prev) => prev.map((b) => b.id === id
      ? { ...b, raceStatus: "LOST" as RaceStatus, statusNote: "LOST at race Spring Race 1" }
      : b
    ));
    toast.error(`${bird?.birdName} marked LOST`);
  };

  const fireScan = useCallback(() => {
    if (scanIdx >= RACE_SCAN_SEQUENCE.length) { toast.info("Done — reset"); return; }
    const { rfid } = RACE_SCAN_SEQUENCE[scanIdx];
    setScanIdx((i) => i + 1);

    if (scannedRfids.current.has(rfid)) {
      toast.info(`Already arrived: ${rfid}`);
      return;
    }

    const bird = birds.find((b) => b.rfid === rfid);

    // Foreign bird
    if (!bird) {
      toast.warning(`Foreign: ${rfid} — not in this race`);
      return;
    }

    // STRAY: lost bird from same event reappears in this race's flock
    if (bird.raceStatus === "LOST" || bird.raceStatus === "STRAY") {
      scannedRfids.current.add(rfid);
      setBirds((prev) => prev.map((b) => b.rfid === rfid
        ? { ...b, raceStatus: "STRAY" as RaceStatus, statusNote: `Lost at ${b.statusNote?.replace("LOST at ", "") ?? "prior flight"}` }
        : b
      ));
      toast.success(`STRAY: ${bird.birdName} returned — no rank assigned`);
      return;
    }

    // Normal arrival
    scannedRfids.current.add(rfid);
    const pos = arrivedCount + 1;
    setArrivedCount((c) => c + 1);
    setBirds((prev) => prev.map((b) => b.rfid === rfid
      ? { ...b, raceStatus: "ARRIVED" as RaceStatus, statusNote: `Position #${pos} · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` }
      : b
    ));
    toast.success(`${bird.birdName} arrived — Position #${pos}`);
  }, [scanIdx, birds, arrivedCount]);

  const arrived = birds.filter((b) => b.raceStatus === "ARRIVED").length;
  const released = birds.filter((b) => b.raceStatus === "RELEASED").length;
  const lost = birds.filter((b) => b.raceStatus === "LOST").length;
  const stray = birds.filter((b) => b.raceStatus === "STRAY").length;
  const ignored = birds.filter((b) => b.raceStatus === "IGNORED").length;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Race — Post-Release Scanner</p>
              <p className="text-xs text-muted-foreground">Birds start as RELEASED. Scan → ARRIVED + position. LOST and IGNORED via action buttons. STRAY when lost bird rejoins.</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" onClick={fireScan} disabled={scanIdx >= RACE_SCAN_SEQUENCE.length} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                Arrival Scan ({scanIdx + 1}/{RACE_SCAN_SEQUENCE.length})
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setScanIdx(0); setBirds(initial); setArrivedCount(0); scannedRfids.current.clear(); }}>Reset</Button>
            </div>
          </div>
          <div className="flex gap-6 text-sm">
            <div className="text-center"><p className="text-xl font-bold text-green-600">{arrived}</p><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Arrived</p></div>
            <div className="text-center"><p className="text-xl font-bold text-amber-500">{released}</p><p className="text-[10px] text-muted-foreground uppercase tracking-wide">In Flight</p></div>
            <div className="text-center"><p className="text-xl font-bold text-red-500">{lost}</p><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Lost</p></div>
            <div className="text-center"><p className="text-xl font-bold text-purple-500">{stray}</p><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Stray</p></div>
            <div className="text-center"><p className="text-xl font-bold text-zinc-400">{ignored}</p><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Ignored</p></div>
          </div>
        </CardContent>
      </Card>
      <BirdTable birds={birds} onIgnore={handleIgnore} onMarkLost={handleMarkLost} />
    </div>
  );
}

// ============================================================
// TAB 4 — HEALTH STATUS (visual demo)
// ============================================================

const HEALTH_CODES = [
  { code: 1,    label: "Healthy",      color: "#22c55e", allowedToFly: true  },
  { code: 2,    label: "Injured",      color: "#f59e0b", allowedToFly: false },
  { code: 3,    label: "Hospitalized", color: "#ef4444", allowedToFly: false },
  { code: 9999, label: "Dead",         color: "#71717a", allowedToFly: false },
];

function HealthDemoTab() {
  const [birds, setBirds] = useState<DemoBird[]>(INITIAL_BIRDS.map((b) => ({ ...b })));
  const [editBird, setEditBird] = useState<DemoBird | null>(null);
  const [selectedCode, setSelectedCode] = useState<number>(1);
  const [healthNote, setHealthNote] = useState("");

  const applyHealth = () => {
    if (!editBird) return;
    const code = HEALTH_CODES.find((c) => c.code === selectedCode)!;
    setBirds((prev) => prev.map((b) => b.id === editBird.id
      ? { ...b, healthStatus: code.label.toUpperCase().replace(" ", "") as HealthStatus, statusNote: healthNote || null }
      : b
    ));
    toast.success(`${editBird.birdName} → ${code.label}`);
    setEditBird(null);
    setHealthNote("");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 space-y-2">
          <p className="text-sm font-medium">Health Status Codes</p>
          <p className="text-xs text-muted-foreground">Admin-defined codes with numeric keys. Code number is stable — admin can rename/recolor but not change the number. Visual only for now; enforcement (blocking basketing) is deferred.</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {HEALTH_CODES.map((c) => (
              <div key={c.code} className="flex items-center gap-2 border rounded-md px-3 py-1.5 text-sm">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                <span className="font-mono text-xs text-muted-foreground">{c.code}</span>
                <span className="font-medium">{c.label}</span>
                <Badge variant="outline" className={`text-[10px] px-1 ${c.allowedToFly ? "text-green-700 border-green-300" : "text-red-700 border-red-300"}`}>
                  {c.allowedToFly ? "Can fly" : "No fly"}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Bird</th>
              <th className="px-3 py-2 text-left font-medium">Band</th>
              <th className="px-3 py-2 text-left font-medium">Breeder</th>
              <th className="px-3 py-2 text-left font-medium">Health</th>
              <th className="px-3 py-2 text-left font-medium">Note</th>
              <th className="px-3 py-2 text-left font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {birds.map((b) => (
              <tr key={b.id} className={b.healthStatus !== "HEALTHY" ? "bg-amber-50/40" : undefined}>
                <td className="px-3 py-2 font-medium">{b.birdName}</td>
                <td className="px-3 py-2 font-mono text-xs">{b.band}</td>
                <td className="px-3 py-2 text-muted-foreground">{b.breederFirstName} {b.breederLastName}</td>
                <td className="px-3 py-2">{healthBadge(b.healthStatus, b.statusNote)}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{b.statusNote ?? "—"}</td>
                <td className="px-3 py-2">
                  <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => { setEditBird(b); setSelectedCode(1); setHealthNote(""); }}>
                    Set Health
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editBird} onOpenChange={(o) => { if (!o) setEditBird(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Health Status — {editBird?.birdName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Health Code</Label>
              <Select value={String(selectedCode)} onValueChange={(v) => setSelectedCode(parseInt(v))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HEALTH_CODES.map((c) => (
                    <SelectItem key={c.code} value={String(c.code)}>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                        {c.code} — {c.label}
                        {!c.allowedToFly && <Badge variant="outline" className="text-[10px] px-1 text-red-700 border-red-300 ml-1">No fly</Badge>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="health-note">Note</Label>
              <Input id="health-note" placeholder="e.g. Wing sprain, under treatment" value={healthNote} onChange={(e) => setHealthNote(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBird(null)}>Cancel</Button>
            <Button onClick={applyHealth}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// PAGE
// ============================================================

export default function BasketingDemoPage() {
  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Basketing & Status Demo</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All in-memory. RFIDs = 8-char hex (MC2100 format). Nothing saved.
          </p>
        </div>
        <Link href="/test">
          <Button variant="outline" size="sm">← Back</Button>
        </Link>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        Click <strong className="mx-1">Simulate Scan</strong> to step through MC2100 scan events one at a time.
      </div>

      <StatusLegend />

      <Tabs defaultValue="checkin" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="checkin">1 · Check-in</TabsTrigger>
          <TabsTrigger value="basket">2 · Basket Scan</TabsTrigger>
          <TabsTrigger value="race">3 · Race</TabsTrigger>
          <TabsTrigger value="health">4 · Health</TabsTrigger>
        </TabsList>
        <TabsContent value="checkin" className="mt-4"><CheckinDemoTab /></TabsContent>
        <TabsContent value="basket" className="mt-4"><BasketScanDemoTab /></TabsContent>
        <TabsContent value="race" className="mt-4"><RaceDemoTab /></TabsContent>
        <TabsContent value="health" className="mt-4"><HealthDemoTab /></TabsContent>
      </Tabs>
    </div>
  );
}
