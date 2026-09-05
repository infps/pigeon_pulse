"use client";

import { useState, useReducer, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AddBirdForm,
  createAddBirdFormState,
  validateAddBirdForm,
  buildAddBirdPayload,
} from "@/components/add-bird-form";
import type { AddBirdFormState } from "@/components/add-bird-form";
import { toast } from "sonner";
import { Trash2, Radio, Square, Pencil, Wifi, Shuffle, CheckCircle2, AlertTriangle, Dices } from "lucide-react";
import { FEDERATIONS, COLORS } from "@/lib/bird-constants";

// ── form helpers ────────────────────────────────────────────────────────────

function formReducer(s: AddBirdFormState, patch: Partial<AddBirdFormState>): AddBirdFormState {
  return { ...s, ...patch };
}

function makeSetters(dispatch: React.Dispatch<Partial<AddBirdFormState>>) {
  const keys = Object.keys(createAddBirdFormState()) as (keyof AddBirdFormState)[];
  return Object.fromEntries(
    keys.map((k) => [
      `set${k.charAt(0).toUpperCase()}${k.slice(1)}`,
      (v: AddBirdFormState[typeof k]) => dispatch({ [k]: v } as Partial<AddBirdFormState>),
    ])
  ) as any;
}

// ── types ───────────────────────────────────────────────────────────────────

interface StagedBird extends AddBirdFormState {
  _idx: number;
  basketed?: boolean;
}

// ── component ───────────────────────────────────────────────────────────────

export default function BirdAdderPage() {
  // add-bird dialog
  const [addOpen, setAddOpen] = useState(false);
  const [formState, dispatch] = useReducer(formReducer, createAddBirdFormState());
  const setters = makeSetters(dispatch);
  const bandNumberRef = useRef<HTMLInputElement>(null);
  const reset = () => dispatch(createAddBirdFormState());

  // bird list
  const [birds, setBirds] = useState<StagedBird[]>([]);

  // edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editState, editDispatch] = useReducer(formReducer, createAddBirdFormState());
  const editSetters = makeSetters(editDispatch);

  // RFID poll scanner for AddBirdForm
  const [rfidPolling, setRfidPolling] = useState(false);
  const [scannerDemoOpen, setScannerDemoOpen] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollStartedAtRef = useRef<string | null>(null);
  const lastScannedRfidRef = useRef<string | null>(null);

  const handleRfidScanned = useCallback((rfid: string) => {
    if (rfid === lastScannedRfidRef.current) return;
    lastScannedRfidRef.current = rfid;
    dispatch({ rfid });
    toast.success(`RFID scanned: ${rfid}`);
  }, []);

  const startRfidPoll = useCallback(() => {
    setRfidPolling(true);
    setScannerDemoOpen(true);
    pollStartedAtRef.current = new Date().toISOString();
    lastScannedRfidRef.current = null;
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/scanner/poll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startedAt: pollStartedAtRef.current }),
        });
        const data = await res.json();
        if (data?.length > 0 && data[0].el) handleRfidScanned(data[0].el);
      } catch { /* silent */ }
    }, 2000);
    toast.success("Poll scanner started");
  }, [handleRfidScanned]);

  const stopRfidPoll = useCallback(() => {
    if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
    setRfidPolling(false);
    lastScannedRfidRef.current = null;
    toast.info("Poll scanner stopped");
  }, []);

  // basketing dialog + poll scanner
  const [basketDialogOpen, setBasketDialogOpen] = useState(false);
  const [currentScanIdx, setCurrentScanIdx] = useState<number | null>(null);
  const [basketedLog, setBasketedLog] = useState<StagedBird[]>([]);
  const [isBasketScanning, setIsBasketScanning] = useState(false);
  const [lastScan, setLastScan] = useState<{ bird: StagedBird; status: "basketed" | "duplicate" | "foreign" } | null>(null);
  const [foreignCount, setForeignCount] = useState(0);
  const basketPollRef = useRef<NodeJS.Timeout | null>(null);
  const basketPollStartRef = useRef<string | null>(null);
  const lastBasketRfidRef = useRef<string | null>(null);
  const birdsRef = useRef<StagedBird[]>([]);
  birdsRef.current = birds;

  // ── add bird ──────────────────────────────────────────────────────────────

  const handleAddAnother = () => {
    const err = validateAddBirdForm(formState);
    if (err) { toast.error(err); return; }
    const idx = birds.length;
    setBirds(prev => [...prev, { ...formState, _idx: idx }]);
    toast.success(`${formState.band1}-${formState.band2}-${formState.band3}-${formState.band4} staged`);
    const next = parseInt(formState.band4);
    dispatch({
      ...createAddBirdFormState(),
      band1: formState.band1,
      band2: formState.band2,
      band3: formState.band3,
      color: formState.color,
      band4: isNaN(next) ? "" : String(next + 1),
    });
    setTimeout(() => bandNumberRef.current?.focus(), 0);
  };

  const handleRegister = () => {
    const err = validateAddBirdForm(formState);
    if (err) { toast.error(err); return; }
    const idx = birds.length;
    const all = [...birds, { ...formState, _idx: idx }];
    setBirds(all);
    toast.success(`${all.length} bird(s) registered (demo only)`);
    reset();
    setAddOpen(false);
  };

  // ── edit bird ─────────────────────────────────────────────────────────────

  const openEdit = (bird: StagedBird) => {
    setEditIdx(bird._idx);
    editDispatch(bird);
    setEditOpen(true);
  };

  const handleEditSave = () => {
    const err = validateAddBirdForm(editState);
    if (err) { toast.error(err); return; }
    setBirds(prev => prev.map(b => b._idx === editIdx ? { ...editState, _idx: editIdx, basketed: b.basketed } : b));
    toast.success("Bird updated");
    setEditOpen(false);
  };

  // ── basketing scanner ─────────────────────────────────────────────────────

  const handleBasketScan = useCallback((rfid: string) => {
    if (rfid === lastBasketRfidRef.current) return;
    lastBasketRfidRef.current = rfid;
    const current = birdsRef.current;
    const bird = current.find(b => b.rfid === rfid && !b.basketed);
    if (!bird) {
      const already = current.find(b => b.rfid === rfid && b.basketed);
      if (already) {
        setLastScan({ bird: already, status: "duplicate" });
        toast.info(`Already basketed: ${already.band1}-${already.band4}`);
      } else {
        const phantom: StagedBird = { _idx: -1, rfid, band1: "?", band2: "?", band3: "?", band4: rfid.slice(-6), name: "Unknown", color: "", sex: "0", attention: false, note: "" } as any;
        setLastScan({ bird: phantom, status: "foreign" });
        setForeignCount(c => c + 1);
        toast.warning(`Unknown RFID: ${rfid}`);
      }
      return;
    }
    setCurrentScanIdx(bird._idx);
    setLastScan({ bird, status: "basketed" });
    setBasketedLog(prev => [bird, ...prev]);
    setBirds(prev => prev.map(b => b._idx === bird._idx ? { ...b, basketed: true } : b));
    if (bird.attention) toast.warning(`ATTENTION: ${bird.name || bird.band1 + "-" + bird.band4}`, { duration: 8000 });
    else toast.success(`Basketed: ${bird.band1}-${bird.band4}`);
  }, []);

  const startBasketScanner = useCallback(() => {
    setIsBasketScanning(true);
    setBasketDialogOpen(true);
    lastBasketRfidRef.current = null;
    basketPollStartRef.current = new Date().toISOString();
    toast.success("Scanner started");
    basketPollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/scanner/poll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startedAt: basketPollStartRef.current }),
        });
        const data = await res.json();
        if (data?.length > 0 && data[0].el && data[0].el !== lastBasketRfidRef.current) {
          handleBasketScan(data[0].el);
        }
      } catch { /* silent */ }
    }, 2000);
  }, [handleBasketScan]);

  const stopBasketScanner = useCallback(() => {
    if (basketPollRef.current) { clearInterval(basketPollRef.current); basketPollRef.current = null; }
    setIsBasketScanning(false);
    lastBasketRfidRef.current = null;
    toast.info("Scanner stopped");
  }, []);

  // cleanup on unmount
  useEffect(() => () => {
    if (basketPollRef.current) clearInterval(basketPollRef.current);
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
  }, []);

  const basketedCount = birds.filter(b => b.basketed).length;
  const pendingCount = birds.filter(b => !b.basketed).length;
  const basketPct = birds.length > 0 ? (basketedCount / birds.length) * 100 : 0;

  const CountBar = () => (
    <div className="flex justify-center gap-8">
      <div className="text-center">
        <p className="text-2xl font-bold text-green-600">{basketedCount}</p>
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Basketed</p>
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold text-amber-500">{pendingCount}</p>
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Pending</p>
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold text-red-500">{foreignCount}</p>
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Foreign</p>
      </div>
    </div>
  );

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen p-8 bg-background space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bird Adder — Demo Page</h1>
        <div className="flex gap-2">
          {birds.length > 0 && (
            <Button variant="outline" onClick={() => { setBirds([]); setBasketedLog([]); setCurrentScanIdx(null); setLastScan(null); setForeignCount(0); }}>Clear all</Button>
          )}
          {birds.length > 0 && (
            isBasketScanning ? (
              <Button variant="outline" onClick={() => setBasketDialogOpen(true)} className="gap-2">
                <Wifi className="h-4 w-4 animate-pulse text-green-600" />
                View Scanner
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => { setBasketedLog([]); setCurrentScanIdx(null); setBasketDialogOpen(true); }} className="gap-2">
                <Radio className="h-4 w-4" />
                Basketing
              </Button>
            )
          )}
          <Button variant="outline" className="gap-2" onClick={() => {
            const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
            const year = String(new Date().getFullYear());
            const letters = () => Array.from({ length: 3 }, () => "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)]).join("");
            const nextIdx = birds.length;
            const newBirds: StagedBird[] = Array.from({ length: 10 }, (_, i) => ({
              ...createAddBirdFormState(),
              _idx: nextIdx + i,
              band1: pick(FEDERATIONS),
              band2: year,
              band3: letters(),
              band4: String(Math.floor(Math.random() * 90000) + 10000),
              color: pick(COLORS),
              sex: pick(["1", "2"]),
              rfid: Math.random().toString(16).slice(2, 18).toUpperCase(),
            }));
            setBirds(prev => [...prev, ...newBirds]);
            toast.success("10 random birds added");
          }}>
            <Dices className="h-4 w-4" />
            Add 10 Random
          </Button>
          <Button onClick={() => { reset(); setAddOpen(true); }}>Add Bird</Button>
        </div>
      </div>

      {/* Basketing Dialog */}
      <Dialog open={basketDialogOpen} onOpenChange={(v) => { if (!v && isBasketScanning) stopBasketScanner(); setBasketDialogOpen(v); }}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between pr-6">
              <span>Basketing Scanner</span>
              <div className="flex items-center gap-2">
                <Badge variant={isBasketScanning ? "default" : "secondary"}>
                  {basketedCount}/{birds.length} basketed
                </Badge>
                {isBasketScanning ? (
                  <Button size="sm" className="gap-1.5 bg-red-600 hover:bg-red-700" onClick={stopBasketScanner}>
                    <Square className="h-4 w-4" />Stop
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={startBasketScanner}>
                    <Wifi className="h-4 w-4" />Start Scanner
                  </Button>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <div className="space-y-1.5">
              <Progress value={basketPct} className="h-2" />
              <p className="text-xs text-muted-foreground text-right">{Math.round(basketPct)}% complete</p>
            </div>

            {!isBasketScanning && basketedLog.length === 0 && (
              <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground text-center">
                Start scanner then scan bird RFID tags
              </div>
            )}

            {isBasketScanning && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Demo</p>
                <div className="flex gap-2">
                  {(() => {
                    const unscanned = birds.find(b => b.rfid && !b.basketed);
                    return (
                      <button
                        disabled={!unscanned}
                        onClick={() => unscanned && handleBasketScan(unscanned.rfid!)}
                        className="flex-1 flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                        <div className="min-w-0">
                          <p className="font-medium text-xs">Unscanned Bird</p>
                          <p className="text-[11px] text-muted-foreground truncate">{unscanned ? `${unscanned.band1}-${unscanned.band4}` : "none"}</p>
                        </div>
                      </button>
                    );
                  })()}
                  {(() => {
                    const already = birds.find(b => b.rfid && b.basketed);
                    return (
                      <button
                        disabled={!already}
                        onClick={() => already && handleBasketScan(already.rfid!)}
                        className="flex-1 flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                        <div className="min-w-0">
                          <p className="font-medium text-xs">Already Basketed</p>
                          <p className="text-[11px] text-muted-foreground truncate">{already ? `${already.band1}-${already.band4}` : "none"}</p>
                        </div>
                      </button>
                    );
                  })()}
                  <button
                    onClick={() => handleBasketScan(Math.random().toString(16).slice(2, 18).toUpperCase())}
                    className="flex-1 flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                  >
                    <Shuffle className="h-4 w-4 shrink-0 text-violet-500" />
                    <div>
                      <p className="font-medium text-xs">Random String</p>
                      <p className="text-[11px] text-muted-foreground">Unknown RFID</p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Last scanned hero */}
            {lastScan ? (
              <div className={`rounded-xl border-2 p-5 transition-all ${
                lastScan.status === "basketed" ? "border-green-400 bg-green-50" :
                lastScan.status === "duplicate" ? "border-amber-400 bg-amber-50" :
                "border-red-400 bg-red-50"
              }`}>
                {/* Top row: icon + band + status + edit */}
                <div className="flex items-start gap-4">
                  <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-white text-2xl font-bold ${
                    lastScan.status === "basketed" ? "bg-green-500" :
                    lastScan.status === "duplicate" ? "bg-amber-500" : "bg-red-500"
                  }`}>
                    {lastScan.status === "basketed" ? "✓" : lastScan.status === "duplicate" ? "↩" : "!"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs font-bold uppercase tracking-widest ${
                      lastScan.status === "basketed" ? "text-green-700" :
                      lastScan.status === "duplicate" ? "text-amber-700" : "text-red-700"
                    }`}>
                      {lastScan.status === "basketed" ? "Basketed" : lastScan.status === "duplicate" ? "Already Basketed" : "Foreign Bird"}
                    </span>
                    <p className="text-2xl font-bold font-mono tracking-wide leading-tight mt-0.5">
                      {lastScan.bird.band1}-{lastScan.bird.band2}-{lastScan.bird.band3}-{lastScan.bird.band4}
                    </p>
                    {lastScan.bird.name && lastScan.bird.name !== "Unknown" && (
                      <p className="text-sm text-muted-foreground">{lastScan.bird.name}</p>
                    )}
                  </div>
                  {lastScan.bird._idx >= 0 ? (
                    <Button size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={() => openEdit(lastScan.bird)}>
                      <Pencil className="h-3.5 w-3.5" />Edit
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={() => {
                      dispatch({ ...createAddBirdFormState(), rfid: lastScan.bird.rfid });
                      setAddOpen(true);
                    }}>
                      <Pencil className="h-3.5 w-3.5" />Create Bird
                    </Button>
                  )}
                </div>

                {/* Meta row */}
                <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                  <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">RFID</p><p className="font-mono text-xs">{lastScan.bird.rfid || "—"}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Color</p><p>{lastScan.bird.color || "—"}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Sex</p><p>{lastScan.bird.sex === "1" ? "Cock" : lastScan.bird.sex === "2" ? "Hen" : "—"}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Basket</p><p>—</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Breeder</p><p>—</p></div>
                </div>

                {/* Attention + note — prominent */}
                {(lastScan.bird.attention || lastScan.bird.note) && (
                  <div className="mt-3 space-y-1.5">
                    {lastScan.bird.attention && (
                      <div className="flex items-center gap-2 rounded-lg bg-red-100 border border-red-300 px-3 py-2">
                        <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
                        <p className="text-base font-bold text-red-700">ATTENTION REQUIRED</p>
                      </div>
                    )}
                    {lastScan.bird.note && (
                      <div className="rounded-lg bg-yellow-50 border border-yellow-300 px-3 py-2">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Note</p>
                        <p className="text-base font-bold text-yellow-900">{lastScan.bird.note}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border-2 border-dashed px-5 py-6 text-center text-sm text-muted-foreground">
                Scan a bird to see details here
              </div>
            )}

            <div className="flex-1 overflow-y-auto border rounded-lg">
              {basketedLog.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center">No birds scanned yet</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted text-muted-foreground sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">#</th>
                      <th className="px-3 py-2 text-left font-medium">Name</th>
                      <th className="px-3 py-2 text-left font-medium">Band</th>
                      <th className="px-3 py-2 text-left font-medium">RFID</th>
                      <th className="px-3 py-2 text-left font-medium">Attn</th>
                      <th className="px-3 py-2 text-left font-medium w-64">Note</th>
                      <th className="px-3 py-2 text-left font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {basketedLog.map((b, i) => (
                      <tr key={b._idx}>
                        <td className="px-3 py-2 text-muted-foreground">{basketedLog.length - i}</td>
                        <td className="px-3 py-2 font-medium">{b.name || "-"}</td>
                        <td className="px-3 py-2 font-mono text-xs">{b.band1}-{b.band2}-{b.band3}-{b.band4}</td>
                        <td className="px-3 py-2 font-mono text-xs">{b.rfid || "-"}</td>
                        <td className="px-3 py-2">
                          {b.attention ? <Badge variant="destructive" className="text-[10px] px-1 py-0">!</Badge> : <span className="text-muted-foreground">-</span>}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground w-64 max-w-[256px] truncate">{b.note || "-"}</td>
                        <td className="px-3 py-2">
                          <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => openEdit(b)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <CountBar />
            <DialogFooter>
              <Button onClick={() => { stopBasketScanner(); setBasketDialogOpen(false); }}>Close</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Last scanned detail box */}
      {lastScan && (
        <div className={`rounded-xl border-2 p-5 transition-all ${
          lastScan.status === "basketed" ? "border-green-400 bg-green-50" :
          lastScan.status === "duplicate" ? "border-amber-400 bg-amber-50" :
          "border-red-400 bg-red-50"
        }`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white text-xl font-bold ${
                lastScan.status === "basketed" ? "bg-green-500" :
                lastScan.status === "duplicate" ? "bg-amber-500" : "bg-red-500"
              }`}>
                {lastScan.status === "basketed" ? "✓" : lastScan.status === "duplicate" ? "↩" : "!"}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-xs font-semibold uppercase tracking-widest ${
                    lastScan.status === "basketed" ? "text-green-700" :
                    lastScan.status === "duplicate" ? "text-amber-700" : "text-red-700"
                  }`}>
                    {lastScan.status === "basketed" ? "Basketed" : lastScan.status === "duplicate" ? "Already Basketed" : "Foreign Bird"}
                  </span>
                  {lastScan.bird.attention && <Badge variant="destructive" className="text-[10px] px-1.5">ATTENTION</Badge>}
                </div>
                <p className="text-xl font-bold font-mono tracking-wide">
                  {lastScan.bird.band1}-{lastScan.bird.band2}-{lastScan.bird.band3}-{lastScan.bird.band4}
                </p>
                {lastScan.bird.name && <p className="text-sm text-muted-foreground mt-0.5">{lastScan.bird.name}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm shrink-0">
              <div><span className="text-muted-foreground text-xs">RFID</span><p className="font-mono text-xs">{lastScan.bird.rfid || "—"}</p></div>
              <div><span className="text-muted-foreground text-xs">Color</span><p>{lastScan.bird.color || "—"}</p></div>
              <div><span className="text-muted-foreground text-xs">Sex</span><p>{lastScan.bird.sex === "1" ? "Cock" : lastScan.bird.sex === "2" ? "Hen" : "Unknown"}</p></div>
              {lastScan.bird.note && <div className="col-span-2"><span className="text-muted-foreground text-xs">Note</span><p className="text-xs">{lastScan.bird.note}</p></div>}
            </div>
          </div>
        </div>
      )}

      {/* Count bar (main page) */}
      {birds.length > 0 && (
        <div className="rounded-lg border bg-muted/30 py-4">
          <CountBar />
        </div>
      )}

      {/* Bird table */}
      {birds.length === 0 ? (
        <p className="text-muted-foreground text-sm">No birds yet. Click "Add Bird" to start.</p>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                {["#", "Band", "Color", "Sex", "Name", "RFID", "Attention", "Status", ""].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {birds.map((b) => (
                <tr
                  key={b._idx}
                  className={`hover:bg-muted/40 transition-colors ${b._idx === currentScanIdx ? "bg-green-50 ring-1 ring-green-300" : ""}`}
                >
                  <td className="px-3 py-2 text-muted-foreground">{b._idx + 1}</td>
                  <td className="px-3 py-2 font-mono">{b.band1}-{b.band2}-{b.band3}-{b.band4}</td>
                  <td className="px-3 py-2">{b.color}</td>
                  <td className="px-3 py-2">{b.sex === "1" ? "Cock" : b.sex === "2" ? "Hen" : "Unk"}</td>
                  <td className="px-3 py-2">{b.name || <span className="text-muted-foreground">-</span>}</td>
                  <td className="px-3 py-2 font-mono text-xs">{b.rfid || <span className="text-muted-foreground">-</span>}</td>
                  <td className="px-3 py-2">{b.attention ? <Badge variant="destructive" className="text-[10px] px-1 py-0">!</Badge> : "-"}</td>
                  <td className="px-3 py-2">
                    {b.basketed
                      ? <Badge variant="default" className="text-[10px]">Basketed</Badge>
                      : <Badge variant="outline" className="text-[10px]">Pending</Badge>}
                  </td>
                  <td className="px-3 py-2 flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(b)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => setBirds(prev => prev.filter(x => x._idx !== b._idx))}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Bird Dialog */}
      <Dialog open={addOpen} onOpenChange={(v) => { if (!v) reset(); setAddOpen(v); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Add Bird {birds.length > 0 && <span className="text-sm font-normal text-muted-foreground ml-2">({birds.length} staged)</span>}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 pr-1 py-2">
            <AddBirdForm
              state={formState}
              setters={setters}
              bettingScheme={null}
              showFees={false}
              showClasses={false}
              bandNumberRef={bandNumberRef}
              rfidPolling={rfidPolling}
              onStartRfidPoll={startRfidPoll}
              onStopRfidPoll={stopRfidPoll}
            />
          </div>
          <DialogFooter className="border-t pt-3">
            <Button variant="outline" onClick={() => { reset(); setAddOpen(false); }}>Cancel</Button>
            <Button variant="secondary" onClick={handleAddAnother}>Add Another</Button>
            <Button onClick={handleRegister}>
              {birds.length > 0 ? `Register ${birds.length + 1} Birds` : "Register Bird"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scanner Demo Dialog */}
      <Dialog open={scannerDemoOpen} onOpenChange={(v) => { setScannerDemoOpen(v); if (!v) stopRfidPoll(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wifi className="h-4 w-4 animate-pulse text-green-600" />
              RFID Scanner
              <span className="ml-auto text-xs font-normal text-muted-foreground">Demo Mode</span>
            </DialogTitle>
          </DialogHeader>

          {/* Pulse ring */}
          <div className="flex items-center justify-center py-6">
            <div className="relative flex items-center justify-center">
              <span className="absolute h-24 w-24 rounded-full bg-primary/10 animate-ping" />
              <span className="absolute h-16 w-16 rounded-full bg-primary/20 animate-ping [animation-delay:300ms]" />
              <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white">
                <Radio className="h-6 w-6" />
              </div>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground -mt-2 mb-2">Waiting for tag… use demo buttons below</p>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Demo</p>

            {/* Unscanned bird */}
            {(() => {
              const unscanned = birds.find(b => !b.rfid);
              return (
                <button
                  disabled={!unscanned}
                  onClick={() => {
                    if (!unscanned) return;
                    const tag = `DEMO-${unscanned.band3 || "BIRD"}-${Math.random().toString(16).slice(2, 10).toUpperCase()}`;
                    handleRfidScanned(tag);
                    setScannerDemoOpen(false);
                    stopRfidPoll();
                  }}
                  className="w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Unscanned Bird</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {unscanned ? `${unscanned.name || unscanned.band1 + "-" + unscanned.band4} — no RFID` : "No unscanned birds"}
                    </p>
                  </div>
                </button>
              );
            })()}

            {/* Already scanned bird */}
            {(() => {
              const scanned = birds.find(b => !!b.rfid);
              return (
                <button
                  disabled={!scanned}
                  onClick={() => {
                    if (!scanned) return;
                    handleRfidScanned(scanned.rfid!);
                    setScannerDemoOpen(false);
                    stopRfidPoll();
                  }}
                  className="w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Already Scanned Bird</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {scanned ? `${scanned.name || scanned.band1 + "-" + scanned.band4} — ${scanned.rfid}` : "No bird with RFID"}
                    </p>
                  </div>
                </button>
              );
            })()}

            {/* Random string */}
            <button
              onClick={() => {
                const tag = Math.random().toString(16).slice(2, 18).toUpperCase();
                handleRfidScanned(tag);
                setScannerDemoOpen(false);
                stopRfidPoll();
              }}
              className="w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted"
            >
              <Shuffle className="h-4 w-4 shrink-0 text-violet-500" />
              <div>
                <p className="text-sm font-medium">Random String</p>
                <p className="text-xs text-muted-foreground">Generate a random RFID tag</p>
              </div>
            </button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setScannerDemoOpen(false); stopRfidPoll(); }}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Bird Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Edit Bird</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 pr-1 py-2">
            <AddBirdForm
              state={editState}
              setters={editSetters}
              bettingScheme={null}
              showFees={false}
              showClasses={false}
            />
          </div>
          <DialogFooter className="border-t pt-3">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
