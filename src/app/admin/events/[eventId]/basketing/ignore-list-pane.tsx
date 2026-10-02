"use client";

/**
 * The Ignore birds list — HayLoft's `TraceIgnoreListFr`, the second grid in the
 * left column of `TeditRaceF`, under its own "Ignore birds list" caption.
 *
 * Columns are the originals: Breeder, Band, EID, Color, Note. A bird lands here
 * when the operator decides it did not really fly — scanned in error, went back
 * to the loft — and leaves again through Restore bird. Unlike HayLoft, where the
 * table existed but was never applied, the result engine here excludes these
 * birds from both rankings, so a change needs a recalculation to show up.
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Undo2 } from "lucide-react";

export interface IgnoredBirdRow {
  id: number;
  inventoryItemId: number | null;
  note: string | null;
  breeder: string | null;
  band: string | null;
  eid: string | null;
  color: string | null;
}

export function IgnoreListPane({
  rows,
  isPending,
  isRestoring,
  onRestore,
}: {
  rows: IgnoredBirdRow[];
  isPending: boolean;
  isRestoring: boolean;
  onRestore: (row: IgnoredBirdRow) => void;
}) {
  return (
    <div className="flex flex-col min-h-0 h-full border rounded-lg overflow-hidden bg-card">
      {/* Panel2 — the pane caption */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/40 shrink-0">
        <span className="text-sm font-semibold">Ignore birds list</span>
        <Badge variant="secondary" className="tabular-nums">{rows.length}</Badge>
        {rows.length > 0 && (
          <span className="ml-auto text-[11px] text-muted-foreground">
            Excluded from position and hotspot ranking — recalculate to apply
          </span>
        )}
      </div>

      {/* dataG */}
      <div className="flex-1 min-h-0 overflow-auto">
        {isPending ? (
          <div className="p-3 space-y-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            No ignored birds in this race
          </p>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted text-muted-foreground z-10">
              <tr>
                <th className="px-2 py-1.5 text-left font-bold">Breeder</th>
                <th className="px-2 py-1.5 text-left font-bold">Band</th>
                <th className="px-2 py-1.5 text-left font-bold">EID</th>
                <th className="px-2 py-1.5 text-left font-bold">Color</th>
                <th className="px-2 py-1.5 text-left font-bold">Note</th>
                <th className="w-8 px-2 py-1.5" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r, i) => (
                <tr key={r.id} className={i % 2 === 1 ? "bg-muted/30" : undefined}>
                  <td className="px-2 py-1 font-semibold">{r.breeder ?? "—"}</td>
                  <td className="px-2 py-1 font-mono font-semibold">{r.band ?? "—"}</td>
                  <td className="px-2 py-1 font-mono">{r.eid ?? "—"}</td>
                  <td className="px-2 py-1">{r.color ?? "—"}</td>
                  <td className="px-2 py-1 text-muted-foreground truncate max-w-[16rem]" title={r.note ?? ""}>
                    {r.note || "—"}
                  </td>
                  <td className="px-1 py-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      title="Restore bird"
                      disabled={isRestoring}
                      onClick={() => onRestore(r)}
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
