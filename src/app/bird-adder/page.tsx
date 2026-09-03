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
import { Trash2, Radio, Square, Pencil } from "lucide-react";

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

  // basketing sim
  const [basketing, setBasketingActive] = useState(false);
  const [basketDialogOpen, setBasketDialogOpen] = useState(false);
  const [currentScanIdx, setCurrentScanIdx] = useState<number | null>(null);
  const [lastScanned, setLastScanned] = useState<StagedBird | null>(null);
  const [basketedLog, setBasketedLog] = useState<StagedBird[]>([]);
  const basketTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scanQueueRef = useRef<StagedBird[]>([]);

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

  // ── basketing sim ─────────────────────────────────────────────────────────

  const stopBasketSim = useCallback((completed = false) => {
    if (basketTimerRef.current) {
      clearInterval(basketTimerRef.current);
      basketTimerRef.current = null;
    }
    setBasketingActive(false);
    setCurrentScanIdx(null);
    scanQueueRef.current = [];
    if (!completed) toast.info("Basketing simulation stopped");
  }, []);

  const startBasketSim = useCallback(() => {
    const unbasketedBirds = birds.filter(b => !b.basketed);
    if (unbasketedBirds.length === 0) {
      toast.info("All birds already basketed");
      return;
    }
    // Birds without RFID can't be scanned
    const scannable = unbasketedBirds.filter(b => b.rfid);
    const noRfid = unbasketedBirds.filter(b => !b.rfid);
    if (noRfid.length > 0) {
      toast.warning(`${noRfid.length} bird(s) skipped — no RFID`);
    }
    if (scannable.length === 0) {
      toast.error("No birds have RFID — add RFIDs to simulate basketing");
      return;
    }

    scanQueueRef.current = [...scannable];
    setBasketingActive(true);
    setBasketDialogOpen(true);
    setBasketedLog([]);
    setLastScanned(null);

    let queueIdx = 0;

    const doScan = () => {
      if (queueIdx >= scanQueueRef.current.length) {
        stopBasketSim(true);
        toast.success("All birds basketed!");
        return;
      }
      const bird = scanQueueRef.current[queueIdx];
      queueIdx++;
      setCurrentScanIdx(bird._idx);
      setLastScanned(bird);
      setBasketedLog(prev => [bird, ...prev]);
      setBirds(prev => prev.map(b => b._idx === bird._idx ? { ...b, basketed: true } : b));
      if (bird.attention) {
        toast.warning(`⚠️ ATTENTION: ${bird.name || bird.band1 + "-" + bird.band4}`, { duration: 8000 });
      }
    };

    doScan();
    basketTimerRef.current = setInterval(doScan, 10000);
  }, [birds, stopBasketSim]);

  // cleanup on unmount
  useEffect(() => () => { if (basketTimerRef.current) clearInterval(basketTimerRef.current); }, []);

  const basketedCount = birds.filter(b => b.basketed).length;
  const basketPct = birds.length > 0 ? (basketedCount / birds.length) * 100 : 0;

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen p-8 bg-background space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bird Adder — Demo Page</h1>
        <div className="flex gap-2">
          {birds.length > 0 && !basketing && (
            <Button variant="outline" onClick={() => { setBirds([]); setLastScanned(null); }}>Clear all</Button>
          )}
          {birds.length > 0 && (
            basketing ? (
              <Button variant="destructive" onClick={() => setBasketDialogOpen(true)} className="gap-2">
                <Radio className="h-4 w-4" />
                Stop Basketing
              </Button>
            ) : (
              <Button variant="secondary" onClick={startBasketSim} className="gap-2">
                <Radio className="h-4 w-4" />
                Simulate Basketing
              </Button>
            )
          )}
          <Button onClick={() => { reset(); setAddOpen(true); }}>Add Bird</Button>
        </div>
      </div>

      {/* Basketing Dialog */}
      <Dialog open={basketDialogOpen} onOpenChange={(v) => { if (!v) stopBasketSim(); setBasketDialogOpen(v); }}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Basketing Simulation</span>
              <Badge variant={basketing ? "default" : "secondary"}>
                {basketedLog.length}/{birds.filter(b => b.rfid).length} scanned
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            {/* Progress */}
            <div className="space-y-1.5">
              <Progress value={basketPct} className="h-2" />
              <p className="text-xs text-muted-foreground text-right">{Math.round(basketPct)}% complete</p>
            </div>

            {!basketing && !lastScanned && (
              <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground text-center">
                Basketing complete
              </div>
            )}

            {/* Basketed list */}
            <div className="flex-1 overflow-y-auto border rounded-lg">
              {basketedLog.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center">No birds basketed yet</p>
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
                      <th className="px-3 py-2 text-left font-medium">Basket</th>
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
                        <td className="px-3 py-2 text-xs font-mono">LB-{(basketedLog.length - i).toString().padStart(2, "0")}</td>
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

          <DialogFooter className="border-t pt-3">
            {basketing ? (
              <Button variant="destructive" onClick={() => stopBasketSim(false)} className="gap-2">
                <Square className="h-4 w-4" />
                Stop
              </Button>
            ) : (
              <Button onClick={() => setBasketDialogOpen(false)}>Close</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
