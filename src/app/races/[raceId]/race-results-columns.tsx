"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Trophy, MapPin, ArrowUp, ArrowDown, Minus } from "lucide-react";
import Image from "next/image";
import type { RaceItem } from "@/lib/types";
import { getSexLabel } from "@/lib/bird-constants";
import type { VelocityUnit, SexTerminology } from "@/lib/settings-context";

export type EnrichedRaceItem = RaceItem & {
  rank: number | null;
  leaderTimeMs: number | null;
  ypm: number | null;
  flightTimeMs: number | null;
  loftName: string;
  countryCode: string | null;
  loftImage: string | null;
  band: string;
  bandSex: number | null;
  color: string | null;
  previousPosition: number | null;
  breederId: number | null;
  birdId: number | null;
};

function countryToFlag(code: string | null): string {
  if (!code || code.length !== 2) return "";
  const A = 0x1f1e6;
  const cc = code.toUpperCase();
  return String.fromCodePoint(A + cc.charCodeAt(0) - 65) +
    String.fromCodePoint(A + cc.charCodeAt(1) - 65);
}

function formatGap(ms: number): string {
  const total = Math.floor(ms);
  const s = Math.floor(total / 1000);
  const millis = total % 1000;
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `+${hh}:${mm}:${ss}.${String(millis).padStart(3, "0")}`;
}

function formatArrival(d: string | null): string {
  if (!d) return "-";
  const dt = new Date(d);
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  const ss = String(dt.getSeconds()).padStart(2, "0");
  const ms = String(dt.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

export function makeRaceResultsColumns({
  velocityUnit,
  sexTerminology,
  onBreederClick,
  onBirdClick,
}: {
  velocityUnit: VelocityUnit;
  sexTerminology: SexTerminology;
  onBreederClick?: (breederId: number, loftName: string) => void;
  onBirdClick?: (birdId: number, band: string) => void;
}): ColumnDef<EnrichedRaceItem>[] {
function formatFlightTime(ms: number | null): string {
  if (ms == null || ms <= 0) return "-";
  const h = String(Math.floor(ms / 3600000)).padStart(2, "0");
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, "0");
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");
  const mil = String(ms % 1000).padStart(3, "0");
  return `${h}:${m}:${s}.${mil}`;
}

return [
  {
    id: "rank",
    accessorKey: "rank",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Rank" />
    ),
    cell: ({ row }) => {
      const r = row.original.rank;
      if (!r) return <span className="text-muted-foreground text-xs">-</span>;
      const color =
        r === 1 ? "text-yellow-500" :
        r === 2 ? "text-gray-400" :
        r === 3 ? "text-amber-700" : "";
      const prev = row.original.previousPosition ?? null;
      const delta = prev != null ? prev - r : null;
      return (
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-sm w-6 text-right">{r}</span>
          {r <= 3 && <Trophy className={`h-3.5 w-3.5 ${color}`} />}
          {delta != null && (
            delta > 0 ? (
              <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-green-600">
                <ArrowUp className="h-3 w-3" />{delta}
              </span>
            ) : delta < 0 ? (
              <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-600">
                <ArrowDown className="h-3 w-3" />{-delta}
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                <Minus className="h-3 w-3" />
              </span>
            )
          )}
        </div>
      );
    },
    sortingFn: (a, b) => (a.original.rank ?? 9999) - (b.original.rank ?? 9999),
  },
  {
    id: "loftAndBand",
    accessorFn: (row) => `${row.loftName} ${row.band}`,
    header: () => <span>Loft & Bird Band ID - Sex - Color</span>,
    cell: ({ row }) => {
      const o = row.original;
      const flag = countryToFlag(o.countryCode);
      const sexLabel = o.bandSex != null && o.bandSex !== 0 ? getSexLabel(o.bandSex, sexTerminology) : "";
      const sexIcon = o.bandSex === 1 ? "♂" : o.bandSex === 2 ? "♀" : "";
      const sexColor = o.bandSex === 1 ? "text-blue-500" : "text-pink-500";
      return (
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="relative h-10 w-10 rounded-full overflow-hidden bg-muted shrink-0 hover:ring-2 hover:ring-primary transition-all"
            onClick={() => o.breederId && onBreederClick?.(o.breederId, o.loftName)}
          >
            {o.loftImage ? (
              <Image src={o.loftImage} alt={o.loftName} fill className="object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-xs font-bold">
                {(o.loftName || "?").substring(0, 2).toUpperCase()}
              </div>
            )}
          </button>
          <div className="flex flex-col">
            <button
              type="button"
              className="flex items-center gap-1.5 text-left hover:underline"
              onClick={() => o.breederId && onBreederClick?.(o.breederId, o.loftName)}
            >
              {flag && <span className="text-base leading-none">{flag}</span>}
              <span className="font-semibold text-sm">{o.loftName || "-"}</span>
            </button>
            <div className="flex items-center gap-1.5 flex-wrap">
              <MapPin className="h-3 w-3 text-green-600 shrink-0" />
              <button
                type="button"
                className="font-mono text-xs text-green-700 hover:underline"
                onClick={() => o.birdId && onBirdClick?.(o.birdId, o.band)}
              >
                {o.band || "-"}
              </button>
              {sexLabel && (
                <span className={`text-xs font-medium ${sexColor}`}>{sexIcon} {sexLabel}</span>
              )}
              {o.color && (
                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">{o.color}</Badge>
              )}
            </div>
          </div>
        </div>
      );
    },
  },
  {
    id: "arrivalGap",
    header: () => <span>Arrival & Gap</span>,
    cell: ({ row }) => {
      const o = row.original;
      if (!o.arrivalTime) return <span className="text-muted-foreground text-xs">-</span>;
      const arrival = formatArrival(o.arrivalTime);
      if (o.rank === 1) {
        return (
          <div className="flex flex-col">
            <span className="font-mono text-sm">{arrival}</span>
            <span className="text-xs font-semibold text-green-600">LEADER</span>
          </div>
        );
      }
      if (o.leaderTimeMs != null) {
        const gap = new Date(o.arrivalTime).getTime() - o.leaderTimeMs;
        return (
          <div className="flex flex-col">
            <span className="font-mono text-sm">{arrival}</span>
            <span className="text-xs font-semibold text-red-600">{formatGap(gap)}</span>
          </div>
        );
      }
      return <span className="font-mono text-sm">{arrival}</span>;
    },
  },
  {
    id: "flightTime",
    header: () => <span>Flight Time</span>,
    cell: ({ row }) => {
      const ms = row.original.flightTimeMs;
      if (ms == null) return <span className="text-muted-foreground text-xs">-</span>;
      return (
        <div className="flex items-center gap-1 text-xs font-mono">
          <span className="text-muted-foreground">⏱</span>
          <span>{formatFlightTime(ms)}</span>
        </div>
      );
    },
  },
  {
    id: "speed",
    header: ({ column }) => <DataTableColumnHeader column={column} title={`Speed (${velocityUnit})`} />,
    accessorFn: (row) => row.ypm ?? -1,
    cell: ({ row }) => {
      const v = row.original.ypm;
      if (v == null) return <span className="text-muted-foreground text-xs">-</span>;
      const display = velocityUnit === "MPM" ? (v * 0.9144).toFixed(4) : v.toFixed(4);
      return <span className="font-semibold text-blue-600">{display} <span className="text-xs font-normal">{velocityUnit}</span></span>;
    },
    sortingFn: (a, b) => (b.original.ypm ?? -1) - (a.original.ypm ?? -1),
  },
  {
    id: "competitions",
    header: () => <span>Competitions</span>,
    cell: () => (
      <Badge variant="outline" className="gap-1 border-red-300 text-red-600">
        <DollarSign className="h-3 w-3" />
        RACE
      </Badge>
    ),
  },
];
}
