"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Trophy, MapPin, ArrowUp, ArrowDown, Minus } from "lucide-react";
import Image from "next/image";
import type { RaceItem } from "@/lib/types";

export type EnrichedRaceItem = RaceItem & {
  rank: number | null;
  leaderTimeMs: number | null;
  ypm: number | null;
  loftName: string;
  countryCode: string | null;
  loftImage: string | null;
  band: string;
  bandSex: number | null;
  color: string | null;
  previousPosition: number | null;
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

export const raceResultsColumns: ColumnDef<EnrichedRaceItem>[] = [
  {
    id: "rank",
    accessorKey: "rank",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Rank" />
    ),
    cell: ({ row }) => {
      const r = row.original.rank;
      if (!r) return <span className="text-muted-foreground">-</span>;
      const color =
        r === 1 ? "text-yellow-500" :
        r === 2 ? "text-gray-400" :
        r === 3 ? "text-amber-700" : "";
      const prev = row.original.previousPosition ?? null;
      const delta = prev != null ? prev - r : null;
      return (
        <div className="flex items-center gap-2">
          <span className="font-semibold">{r}</span>
          {r <= 3 && <Trophy className={`h-4 w-4 ${color}`} />}
          {delta != null && (
            delta > 0 ? (
              <span
                className="inline-flex items-center gap-0.5 text-xs font-semibold text-green-600"
                title={`Up ${delta} from prev race (was #${prev})`}
              >
                <ArrowUp className="h-3 w-3" />{delta}
              </span>
            ) : delta < 0 ? (
              <span
                className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-600"
                title={`Down ${-delta} from prev race (was #${prev})`}
              >
                <ArrowDown className="h-3 w-3" />{-delta}
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"
                title={`Same as prev race (#${prev})`}
              >
                <Minus className="h-3 w-3" />
              </span>
            )
          )}
        </div>
      );
    },
    sortingFn: (a, b) => {
      const ra = a.original.rank ?? 9999;
      const rb = b.original.rank ?? 9999;
      return ra - rb;
    },
  },
  {
    id: "loftAndBand",
    accessorFn: (row) => `${row.loftName} ${row.band}`,
    header: () => <span>Loft & Bird Band ID</span>,
    cell: ({ row }) => {
      const o = row.original;
      const flag = countryToFlag(o.countryCode);
      const sexIcon = o.bandSex === 1 ? "♂" : o.bandSex === 2 ? "♀" : "";
      const sexColor = o.bandSex === 1 ? "text-blue-600" : "text-pink-600";
      return (
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 rounded-full overflow-hidden bg-muted shrink-0">
            {o.loftImage ? (
              <Image src={o.loftImage} alt={o.loftName} fill className="object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-xs font-bold">
                {(o.loftName || "?").substring(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              {flag && <span className="text-base leading-none">{flag}</span>}
              <span className="font-semibold text-sm">{o.loftName || "-"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3 text-green-600" />
              <span className="font-mono text-xs text-green-700">{o.band || "-"}</span>
              {sexIcon && <span className={`text-xs ${sexColor}`}>{sexIcon}</span>}
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
      if (!o.arrivalTime) return <span className="text-muted-foreground">-</span>;
      const arrival = formatArrival(o.arrivalTime);
      if (o.rank === 1) {
        return (
          <div className="flex flex-col">
            <span className="text-sm">{arrival}</span>
            <span className="text-xs font-semibold text-green-600">LEADER</span>
          </div>
        );
      }
      if (o.leaderTimeMs != null) {
        const gap = new Date(o.arrivalTime).getTime() - o.leaderTimeMs;
        return (
          <div className="flex flex-col">
            <span className="text-sm">{arrival}</span>
            <span className="text-xs text-red-600">{formatGap(gap)}</span>
          </div>
        );
      }
      return <span className="text-sm">{arrival}</span>;
    },
  },
  {
    id: "speed",
    header: () => <span>Speed</span>,
    cell: ({ row }) => {
      const v = row.original.ypm;
      if (v == null) return <span className="text-muted-foreground">-</span>;
      return <span className="font-semibold text-blue-600">{v.toFixed(4)} YPM</span>;
    },
  },
  {
    id: "color",
    accessorFn: (row) => row.color ?? "",
    header: () => <span>Color</span>,
    cell: ({ row }) => <span className="text-sm">{row.original.color || "-"}</span>,
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
