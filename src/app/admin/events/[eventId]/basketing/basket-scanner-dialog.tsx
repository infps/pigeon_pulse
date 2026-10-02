"use client";

/**
 * Single-bird basketing scanner and the basket editor.
 *
 * HayLoft ran basketing through modal scanner screens that all inherited one
 * base form (`TraceBasketingF`): loft basketing (`TdistBasketingF`, captioned
 * "Loft basketing" and reached through the "Big basketing" action) and race
 * basketing (`TscannerBasketingF`). Each put a single bird on screen with its
 * basket number set enormous, because the operator is standing at a table and
 * reading the number from a distance.
 */

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AlertTriangle, Radio, Square, Wifi } from "lucide-react";
import { toast } from "sonner";

type ScanPhase = "LOFT" | "RACE";

type ScannerBird = {
  band?: string | null;
  birdName?: string | null;
  rfid?: string | null;
  color?: string | null;
  sex?: number | null;
  attention?: boolean | null;
  note?: string | null;
};

type ScannerState =
  | { kind: "idle" }
  | {
      kind: "ok";
      basketNo: number | null;
      basketLabel: string | null;
      bird: ScannerBird;
      breeder: string | null;
      loft: string | null;
      repeat: boolean;
    }
  | { kind: "unbasketed"; bird: ScannerBird; breeder: string | null; loft: string | null }
  | { kind: "error"; message: string; rfid?: string };

const sexLabel = (sex?: number | null) => (sex === 1 ? "COCK" : sex === 2 ? "HEN" : "");

/**
 * The single-bird basketing scanner.
 *
 * Deliberately reproduces HayLoft's proportions: one line each for bird, breeder
 * and loft, then the basket number filling the rest of the window.
 */
export function ScannerBasketingDialog({
  eventId,
  raceId,
  phase,
  totalBirds,
  nonBasketedBirds,
  onScanned,
  onClose,
}: {
  eventId: string;
  raceId: string;
  phase: ScanPhase;
  totalBirds: number;
  nonBasketedBirds: number;
  onScanned?: () => void;
  onClose: () => void;
}) {
  const [state, setState] = useState<ScannerState>({ kind: "idle" });
  const [isPollActive, setIsPollActive] = useState(false);
  const [manualRfid, setManualRfid] = useState("");
  const [scannedCount, setScannedCount] = useState(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollStartedAtRef = useRef<string | null>(null);
  const lastScannedRef = useRef<string | null>(null);

  const breederName = (b: { firstName?: string | null; lastName?: string | null } | null) =>
    b ? [b.firstName, b.lastName].filter(Boolean).join(" ") || null : null;

  const doScan = useCallback(
    async (rfid: string) => {
      const tag = rfid.trim();
      if (!tag || tag === lastScannedRef.current) return;
      lastScannedRef.current = tag;

      try {
        const endpoint =
          phase === "LOFT"
            ? `/api/admin/event/${eventId}/baskets/prescan-loft`
            : `/api/admin/event/${eventId}/baskets/prescan-race`;
        const body = phase === "LOFT" ? { rfid: tag } : { rfid: tag, raceId: parseInt(raceId) };
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const d = await res.json();

        if (!res.ok) {
          setState({ kind: "error", message: d?.message ?? "Scan failed", rfid: tag });
          return;
        }

        if (d.status === "foreign") {
          setState({ kind: "error", message: "Bird is not registered in this event", rfid: tag });
          return;
        }

        if (d.status === "unassigned") {
          setState({
            kind: "unbasketed",
            bird: d.bird ?? {},
            breeder: breederName(d.breeder ?? null),
            loft: d.loftName ?? null,
          });
          return;
        }

        // placed | scanned | already_scanned
        const basketNo = d.basket?.basketNo ?? d.basketNo ?? null;
        const basketLabel = d.basket?.label ?? d.basketLabel ?? null;
        const repeat = d.status === "already_scanned";
        setState({
          kind: "ok",
          basketNo,
          basketLabel,
          bird: d.bird ?? {},
          breeder: breederName(d.breeder ?? null),
          loft: d.loftName ?? null,
          repeat,
        });
        if (!repeat) {
          setScannedCount((c) => c + 1);
          onScanned?.();
        }
      } catch {
        setState({ kind: "error", message: "Scan lookup failed", rfid: tag });
        lastScannedRef.current = null;
      }
    },
    [eventId, raceId, phase, onScanned]
  );

  const startPoll = useCallback(() => {
    setIsPollActive(true);
    lastScannedRef.current = null;
    pollStartedAtRef.current = new Date().toISOString();
    toast.success("Scanner started");
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
        /* silent — the reader comes and goes */
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
    toast.info("Scanner stopped");
  }, []);

  const handleClose = () => {
    stopPoll();
    onClose();
  };

  const bird = state.kind === "ok" || state.kind === "unbasketed" ? state.bird : null;
  const birdLine = bird
    ? [
        "BIRD:",
        bird.band ?? bird.birdName ?? "—",
        bird.color ?? "",
        sexLabel(bird.sex),
        bird.rfid ?? "",
      ]
        .filter(Boolean)
        .join(" ")
    : "BIRD:";
  const breederLine =
    state.kind === "ok" || state.kind === "unbasketed"
      ? `BREEDER: ${state.breeder ?? "—"}`
      : "BREEDER:";
  const loftLine =
    state.kind === "ok" || state.kind === "unbasketed" ? `LOFT: ${state.loft ?? "—"}` : "LOFT:";

  const bigValue =
    state.kind === "ok"
      ? state.basketNo != null
        ? String(state.basketNo)
        : state.basketLabel ?? "—"
      : state.kind === "unbasketed"
      ? "—"
      : state.kind === "error"
      ? "!"
      : "";

  const bigTone =
    state.kind === "ok"
      ? state.repeat
        ? "text-amber-500"
        : "text-primary"
      : state.kind === "error"
      ? "text-destructive"
      : "text-muted-foreground";

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) handleClose();
      }}
    >
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <DialogTitle className="flex items-center justify-between pr-6">
            <span>{phase === "LOFT" ? "Loft basketing" : "Race basketing"}</span>
            <div className="flex items-center gap-2">
              {isPollActive ? (
                <Button
                  size="sm"
                  className="gap-1.5 bg-red-600 hover:bg-red-700"
                  onClick={stopPoll}
                >
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
        <p className="text-center text-lg font-bold py-2 flex items-center justify-center gap-2">
          {isPollActive && <Radio className="h-4 w-4 text-primary animate-pulse" />}
          Please, bring the bird near the scanner...
        </p>

        {/* birdL / breederL / loftL */}
        <div className="border-y py-2 space-y-0.5">
          <p className="text-center text-xl md:text-2xl font-bold text-blue-600 truncate px-4">
            {birdLine}
          </p>
          <p className="text-center text-xl md:text-2xl font-bold text-blue-600 truncate px-4">
            {breederLine}
          </p>
          <p className="text-center text-xl md:text-2xl font-bold text-blue-600 truncate px-4">
            {loftLine}
          </p>
        </div>

        {/* basketNoE — the whole point of the screen */}
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center">
          <span
            className={`font-bold leading-none tabular-nums ${bigTone}`}
            style={{ fontSize: "clamp(4rem, 22vh, 14rem)" }}
          >
            {bigValue}
          </span>
          {state.kind === "ok" && state.repeat && (
            <Badge variant="secondary" className="mt-3">
              Already basketed
            </Badge>
          )}
          {state.kind === "unbasketed" && (
            <p className="mt-3 text-sm text-amber-600">
              No basket allocated yet — run <strong>Set basket</strong> first.
            </p>
          )}
          {bird?.attention && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-100 border border-red-300 px-4 py-2">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
              <p className="text-lg font-bold text-red-700">ATTENTION REQUIRED</p>
            </div>
          )}
          {bird?.note && (
            <p className="mt-2 text-base font-bold text-yellow-900 bg-yellow-50 border border-yellow-300 rounded px-3 py-1.5">
              {bird.note}
            </p>
          )}
        </div>

        {/* Manual tag entry — the web has no serial reader to fall back on */}
        <div className="px-6 pb-2 flex items-center gap-2">
          <Label htmlFor="scanner-manual-rfid" className="text-xs text-muted-foreground shrink-0">
            EID
          </Label>
          <Input
            id="scanner-manual-rfid"
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

        {/* Panel1 — totals */}
        <div className="border-t px-6 py-2 flex items-center justify-center gap-10 text-sm">
          <span className="text-muted-foreground">
            Total birds <strong className="text-foreground tabular-nums ml-1">{totalBirds}</strong>
          </span>
          <span className="text-muted-foreground">
            Non basketed birds{" "}
            <strong className="text-foreground tabular-nums ml-1">
              {Math.max(nonBasketedBirds - scannedCount, 0)}
            </strong>
          </span>
          <span className="text-muted-foreground">
            Scanned <strong className="text-foreground tabular-nums ml-1">{scannedCount}</strong>
          </span>
        </div>

        {/* errorDetailsP */}
        <div className="border-t px-6 py-1.5 min-h-8 flex items-center gap-2">
          {state.kind === "error" && (
            <>
              <span className="text-xs font-bold text-destructive shrink-0">ERROR</span>
              <span className="text-xs text-muted-foreground truncate">
                {state.message}
                {state.rfid ? ` — ${state.rfid}` : ""}
              </span>
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

/**
 * HayLoft's basket editor (`TeditBasketF`, captioned "Basket data") was two
 * fields: Number and Capacity. The number is fixed — it comes from the next free
 * slot on create and cannot be edited afterwards, same as the original, where
 * NUMBER was shown but disabled.
 */
export function BasketFormDialog({
  open,
  mode,
  basketNo,
  capacity,
  label,
  isSaving,
  onCapacityChange,
  onLabelChange,
  onSave,
  onSaveAndNew,
  onClose,
}: {
  open: boolean;
  mode: "create" | "edit";
  basketNo: number;
  capacity: string;
  label: string;
  isSaving: boolean;
  onCapacityChange: (v: string) => void;
  onLabelChange: (v: string) => void;
  onSave: () => void;
  onSaveAndNew?: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Basket data</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="basket-form-no" className="text-xs font-bold">
              Number
            </Label>
            <Input
              id="basket-form-no"
              type="number"
              value={basketNo}
              readOnly
              className="bg-muted text-right tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="basket-form-capacity" className="text-xs font-bold">
              Capacity
            </Label>
            <Input
              id="basket-form-capacity"
              type="number"
              min="1"
              value={capacity}
              autoFocus
              className="text-right tabular-nums"
              onChange={(e) => onCapacityChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSave()}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="basket-form-label" className="text-xs font-bold">
            Label <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="basket-form-label"
            value={label}
            placeholder="e.g. LB-SMITH-1"
            onChange={(e) => onLabelChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSave()}
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {mode === "create" && onSaveAndNew && (
            <Button variant="secondary" onClick={onSaveAndNew} disabled={isSaving || !capacity}>
              {isSaving ? "Saving..." : "Save and New"}
            </Button>
          )}
          <Button onClick={onSave} disabled={isSaving || !capacity}>
            {isSaving ? "Saving..." : "OK"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
