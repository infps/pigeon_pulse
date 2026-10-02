"use client";

/**
 * Bird prescan — HayLoft's `TbirdPreScanF`, opened from the entries toolbar by
 * `ActionPreScan`.
 *
 * Where the basketing scanners show one bird enormous, prescan is a running
 * list: every tag read this session, newest first, with the basket it belongs
 * to. The column set is the original's — No, Breeder, Loft, Band, EID, Color,
 * Sex, Basket — as is the footer ("Scanned birds" and a count), the "Delete all"
 * action and the error line along the bottom.
 *
 * HayLoft ordered its grid by `SCAN_POS desc nulls last`, so the most recent
 * scan sits at the top. That is the order here too.
 */

import { useCallback, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Radio, Square, Trash2, Wifi } from "lucide-react";
import { toast } from "sonner";

type PrescanStatus = "scanned" | "already_scanned" | "foreign";

type PrescanRow = {
  /** SCAN_POS — the order the bird came past the reader. */
  scanPos: number;
  rfid: string;
  breeder: string | null;
  loft: string | null;
  band: string | null;
  birdName: string | null;
  color: string | null;
  sex: number | null;
  attention: boolean;
  basketLabel: string;
  status: PrescanStatus;
  raceItemId?: number;
};

const sexLabel = (sex: number | null) => (sex === 1 ? "Cock" : sex === 2 ? "Hen" : "—");

export function PrescanDialog({
  eventId,
  raceId,
  onClose,
}: {
  eventId: string;
  raceId: string;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<PrescanRow[]>([]);
  const [isPollActive, setIsPollActive] = useState(false);
  const [manualRfid, setManualRfid] = useState("");
  const [errMessage, setErrMessage] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastScannedRef = useRef<string | null>(null);
  const pollStartedAtRef = useRef<string | null>(null);
  const scanPosRef = useRef(0);

  const breederName = (b: { firstName?: string | null; lastName?: string | null } | null) =>
    b ? [b.lastName, b.firstName].filter(Boolean).join(", ") || null : null;

  const doScan = useCallback(
    async (rfid: string) => {
      const tag = rfid.trim();
      if (!tag || tag === lastScannedRef.current) return;
      lastScannedRef.current = tag;

      try {
        const res = await fetch(`/api/admin/event/${eventId}/baskets/prescan-race`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rfid: tag, raceId: parseInt(raceId) }),
        });
        const data = await res.json();

        if (!res.ok) {
          setErrMessage(data?.message ?? "Scan failed");
          return;
        }
        setErrMessage(null);

        scanPosRef.current += 1;
        const newRow: PrescanRow = {
          scanPos: scanPosRef.current,
          rfid: tag,
          breeder: breederName(data.breeder ?? null),
          loft: data.loftName ?? null,
          band: data.bird?.band ?? null,
          birdName: data.bird?.birdName ?? null,
          color: data.bird?.color ?? null,
          sex: data.bird?.sex ?? null,
          attention: data.bird?.attention ?? false,
          basketLabel:
            data.basketNo != null ? String(data.basketNo) : data.basketLabel ?? "—",
          status: data.status,
          raceItemId: data.raceItemId,
        };

        setRows((prev) => {
          const existing = prev.findIndex((r) => r.rfid === tag);
          if (existing >= 0) {
            const next = [...prev];
            // Keep the original scan position when a tag is read again.
            next[existing] = { ...newRow, scanPos: prev[existing].scanPos };
            scanPosRef.current -= 1;
            return next;
          }
          return [newRow, ...prev];
        });

        if (data.status === "already_scanned") {
          toast.info(`Already basketed: ${newRow.band ?? tag}`);
        } else if (data.status === "foreign") {
          setErrMessage(`Foreign bird — ${tag} is not registered for this race`);
          toast.warning(`Foreign bird: ${tag}`);
        } else {
          toast.success(`Scanned: ${newRow.band ?? tag} → ${newRow.basketLabel}`);
        }
      } catch {
        setErrMessage("Scan lookup failed");
        lastScannedRef.current = null;
      }
    },
    [eventId, raceId]
  );

  const startPoll = useCallback(() => {
    setIsPollActive(true);
    lastScannedRef.current = null;
    pollStartedAtRef.current = new Date().toISOString();
    toast.success("Prescan scanner started");

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/scanner/poll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startedAt: pollStartedAtRef.current }),
        });
        const d = await res.json();
        if (d?.length > 0 && d[0].el && d[0].el !== lastScannedRef.current) {
          await doScan(d[0].el);
        }
      } catch {
        /* silent */
      }
    }, 2000);
  }, [doScan]);

  const stopPoll = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setIsPollActive(false);
    lastScannedRef.current = null;
    toast.info("Prescan scanner stopped");
  }, []);

  const handleClose = () => {
    stopPoll();
    onClose();
  };

  const handleAddForeign = async (row: PrescanRow) => {
    try {
      const res = await fetch(`/api/admin/event/${eventId}/baskets/prescan-race`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rfid: row.rfid,
          raceId: parseInt(raceId),
          action: "register_foreign",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrMessage(data?.message ?? "Failed to register");
        toast.error(data?.message ?? "Failed to register");
        return;
      }
      setErrMessage(null);
      setRows((prev) =>
        prev.map((r) =>
          r.rfid === row.rfid
            ? {
                ...r,
                band: data.bird?.band ?? r.rfid,
                birdName: data.bird?.birdName ?? null,
                status: "scanned",
                raceItemId: data.raceItemId,
              }
            : r
        )
      );
      toast.success("Bird registered under admin for later reassignment");
    } catch {
      toast.error("Failed to register bird");
    }
  };

  const handleRemove = async (row: PrescanRow) => {
    if (row.raceItemId) {
      try {
        await fetch(`/api/admin/event/${eventId}/baskets/prescan-race`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ raceItemId: row.raceItemId }),
        });
      } catch {
        /* best effort */
      }
    }
    setRows((prev) => prev.filter((r) => r.rfid !== row.rfid));
  };

  /** ActionDelete — "Delete all". Clears the session list, not the race. */
  const handleDeleteAll = () => {
    setRows([]);
    scanPosRef.current = 0;
    lastScannedRef.current = null;
    setErrMessage(null);
  };

  const statusBadge = (status: PrescanStatus) => {
    if (status === "scanned") return <Badge className="text-[10px] px-1 py-0">Basketed</Badge>;
    if (status === "already_scanned") {
      return <Badge variant="secondary" className="text-[10px] px-1 py-0">Already</Badge>;
    }
    return <Badge variant="destructive" className="text-[10px] px-1 py-0">Foreign</Badge>;
  };

  const scannedCount = rows.filter((r) => r.status !== "foreign").length;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <DialogTitle className="flex items-center justify-between pr-6">
            <span>Bird prescan</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleDeleteAll}
                disabled={rows.length === 0}
              >
                <Trash2 className="h-4 w-4" />
                Delete all
              </Button>
              {isPollActive ? (
                <Button size="sm" className="gap-1.5 bg-red-600 hover:bg-red-700" onClick={stopPoll}>
                  <Square className="h-4 w-4" />
                  Stop Scanner
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={startPoll}>
                  <Wifi className="h-4 w-4" />
                  Start Scanner
                </Button>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* notifyL */}
        <p className="text-center text-sm font-bold py-2 border-b flex items-center justify-center gap-2">
          {isPollActive && <Radio className="h-3.5 w-3.5 text-primary animate-pulse" />}
          Please, bring the bird near the scanner...
        </p>

        {/* dataG */}
        <div className="flex-1 min-h-0 overflow-auto">
          {rows.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              {isPollActive ? "Waiting for scans..." : "Start the scanner to begin"}
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted text-muted-foreground z-10">
                <tr>
                  <th className="px-2 py-1.5 text-right font-bold w-12">No</th>
                  <th className="px-2 py-1.5 text-left font-bold">Breeder</th>
                  <th className="px-2 py-1.5 text-left font-bold">Loft</th>
                  <th className="px-2 py-1.5 text-left font-bold">Band</th>
                  <th className="px-2 py-1.5 text-left font-bold">EID</th>
                  <th className="px-2 py-1.5 text-left font-bold">Color</th>
                  <th className="px-2 py-1.5 text-left font-bold">Sex</th>
                  <th className="px-2 py-1.5 text-right font-bold">Basket</th>
                  <th className="px-2 py-1.5 text-center font-bold w-10">!</th>
                  <th className="px-2 py-1.5 text-left font-bold">Status</th>
                  <th className="px-2 py-1.5" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row, i) => (
                  <tr
                    key={row.rfid}
                    className={
                      row.status === "foreign"
                        ? "bg-red-50"
                        : i % 2 === 1
                        ? "bg-muted/30"
                        : undefined
                    }
                  >
                    <td className="px-2 py-1 text-right tabular-nums text-muted-foreground">
                      {row.scanPos}
                    </td>
                    <td className="px-2 py-1 font-semibold">{row.breeder ?? "—"}</td>
                    <td className="px-2 py-1 text-muted-foreground">{row.loft ?? "—"}</td>
                    <td className="px-2 py-1 font-mono font-semibold">{row.band ?? "—"}</td>
                    <td className="px-2 py-1 font-mono">{row.rfid}</td>
                    <td className="px-2 py-1">{row.color ?? "—"}</td>
                    <td className="px-2 py-1">{sexLabel(row.sex)}</td>
                    <td className="px-2 py-1 text-right tabular-nums font-semibold">
                      {row.basketLabel}
                    </td>
                    <td className="px-2 py-1 text-center">
                      {row.attention && (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mx-auto" />
                      )}
                    </td>
                    <td className="px-2 py-1">{statusBadge(row.status)}</td>
                    <td className="px-2 py-1">
                      {row.status === "foreign" ? (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-1.5 text-[11px]"
                            onClick={() => handleAddForeign(row)}
                          >
                            Add bird
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1.5 text-[11px] text-destructive"
                            onClick={() => handleRemove(row)}
                          >
                            Remove
                          </Button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Manual tag entry — no serial reader on the web */}
        <div className="border-t px-6 py-2 flex items-center gap-2">
          <Label htmlFor="prescan-manual-rfid" className="text-xs text-muted-foreground shrink-0">
            EID
          </Label>
          <Input
            id="prescan-manual-rfid"
            value={manualRfid}
            placeholder="Type or paste a tag and press Enter"
            className="h-8 font-mono text-xs"
            onChange={(e) => setManualRfid(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && manualRfid.trim()) {
                lastScannedRef.current = null;
                doScan(manualRfid);
                setManualRfid("");
              }
            }}
          />
        </div>

        {/* Panel1 — scannedBirdL */}
        <div className="border-t px-6 py-2 flex items-center justify-center gap-10 text-sm">
          <span className="text-muted-foreground">
            Scanned birds <strong className="text-foreground tabular-nums ml-1">{scannedCount}</strong>
          </span>
          <span className="text-muted-foreground">
            Foreign{" "}
            <strong className="text-foreground tabular-nums ml-1">
              {rows.filter((r) => r.status === "foreign").length}
            </strong>
          </span>
        </div>

        {/* errorDetailsP */}
        <div className="border-t px-6 py-1.5 min-h-8 flex items-center gap-2">
          {errMessage && (
            <>
              <span className="text-xs font-bold text-destructive shrink-0">ERROR</span>
              <span className="text-xs text-muted-foreground truncate">{errMessage}</span>
            </>
          )}
        </div>

        <DialogFooter className="px-6 py-3 border-t">
          <Button onClick={handleClose}>Close (Esc)</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
