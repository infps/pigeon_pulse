"use client";

import type { Event, EventInventoryItem } from "@/lib/types";
import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useWebSerial } from "@/hooks/useWebSerial";
import { useListEventInventoryItems, useAddBirdsToEvent, useRegisterBirdToEvent, useListEventInventoryItemsBySeason } from "@/lib/api/event-inventory-items";
import { useSeasonContext } from "@/lib/season-context";
import { useListEvents } from "@/lib/api/events";
import { Input } from "@/components/ui/input";
import { useApiQuery } from "@/hooks/useApi";
import { DataTable } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Plus, Wifi, WifiOff, Square, Usb, Upload, Download } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { createBirdsColumns } from "./birds-columns";
import { EditBirdDialog } from "@/components/edit-bird-dialog";
import { BirdDetailDialog } from "@/components/bird-detail-dialog";
import { ImportModal, ExportModal } from "@/components/csv-import-export";

interface BirdsTabProps {
  event: Event;
  eventId: string;
}

export function BirdsTab({ event, eventId }: BirdsTabProps) {
  const { selectedSeasonId } = useSeasonContext();
  const queryClient = useQueryClient();
  const [editingItem, setEditingItem] = useState<EventInventoryItem | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [detailBirdId, setDetailBirdId] = useState<number | null>(null);
  const [rfidFilter, setRfidFilter] = useState("");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isPollActive, setIsPollActive] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastScannedRef = useRef<string | null>(null);
  const pollStartedAtRef = useRef<string | null>(null);

  const { data, isPending, error, refetch } = useListEventInventoryItems(eventId, undefined, undefined, selectedSeasonId);

  const startPollScanner = useCallback(() => {
    setIsPollActive(true);
    lastScannedRef.current = null;
    pollStartedAtRef.current = new Date().toISOString();
    toast.success("Poll scanner started — scan a bird RFID to search");
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/scanner/poll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startedAt: pollStartedAtRef.current }),
        });
        const d = await res.json();
        if (d?.length > 0 && d[0].el && d[0].el !== lastScannedRef.current) {
          lastScannedRef.current = d[0].el;
          setRfidFilter(d[0].el);
        }
      } catch { /* silent */ }
    }, 2000);
  }, []);

  const stopPollScanner = useCallback(() => {
    if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
    setIsPollActive(false);
    lastScannedRef.current = null;
    pollStartedAtRef.current = null;
    toast.info("Poll scanner stopped");
  }, []);

  const handleEdit = (item: EventInventoryItem) => {
    setEditingItem(item);
    setIsEditDialogOpen(true);
  };

  const handleEditSuccess = () => {
    setEditingItem(null);
    refetch();
  };

  const handleAddSuccess = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["event-inventory"] });
  };

  const columns = createBirdsColumns(handleEdit, setDetailBirdId, eventId);

  const eventInventoryItems: EventInventoryItem[] =
    data?.eventInventoryItems || [];

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        <p>Error loading birds</p>
      </div>
    );
  }

  const emptyState = rfidFilter ? (
    <div className="flex flex-col items-center gap-3 py-4">
      <p className="text-sm text-muted-foreground">No bird found with RFID <span className="font-mono font-medium">{rfidFilter}</span></p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => { setRfidFilter(""); setIsAddDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" />Add a bird
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setRfidFilter("")}>
          Clear filter
        </Button>
      </div>
    </div>
  ) : eventInventoryItems.length === 0 ? (
    <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
      No birds registered yet.{" "}
      <button onClick={() => setIsAddDialogOpen(true)} className="text-primary underline underline-offset-2">
        Add birds now.
      </button>
    </div>
  ) : undefined;

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        {isPollActive ? (
          <Button size="sm" variant="outline" className="gap-1.5 border-red-400 text-red-600 hover:bg-red-50" onClick={stopPollScanner}>
            <Square className="h-4 w-4" />Stop Scan
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={startPollScanner}>
            <Wifi className="h-4 w-4" />Scan RFID
          </Button>
        )}
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setIsImportOpen(true)}>
          <Upload className="h-4 w-4" />Import
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setIsExportOpen(true)}>
          <Download className="h-4 w-4" />Export
        </Button>
        <Button size="sm" className="gap-1.5" onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Birds
        </Button>
      </div>

      <DataTable
        tableId="event-birds"
        columns={columns}
        data={eventInventoryItems}
        filterableColumns={[
          { id: "breeder", title: "Breeder" },
          { id: "birdName", title: "Bird Name" },
          { id: "band", title: "Full Band" },
          { id: "color", title: "Color" },
          { id: "rfid", title: "RFID" },
          { id: "band1", title: "Assoc" },
          { id: "band2", title: "Year" },
          { id: "band3", title: "Letter" },
          { id: "band4", title: "Number" },
        ]}
        externalFilterValue={rfidFilter || undefined}
        externalFilterColumn={rfidFilter ? "rfid" : undefined}
        emptyState={emptyState}
        onRowClick={(item) => { if (item.bird?.id) setDetailBirdId(item.bird.id); }}
        rowClickMode="action"
      />

      <EditBirdDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        eventInventoryItem={editingItem}
        event={event}
        eventId={parseInt(eventId)}
        onSuccess={handleEditSuccess}
      />

      <AddBirdsDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        eventId={eventId}
        existingItems={eventInventoryItems}
        onSuccess={handleAddSuccess}
      />

      <BirdDetailDialog
        open={detailBirdId !== null}
        onOpenChange={(o) => { if (!o) setDetailBirdId(null); }}
        birdId={detailBirdId}
        eventId={parseInt(eventId)}
      />

      <ImportModal
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        previewUrl={`/api/admin/event/${eventId}/import-birds/preview`}
        commitUrl={`/api/admin/event/${eventId}/import-birds/commit`}
        templateFields="breeder_first_name,breeder_last_name,breeder_email,bird_name,band1,band2,band3,band4,color,sex,rfid,attention"
        templateFilename="birds-import-template.csv"
        previewColumns={[
          { key: "breederName", label: "Breeder" },
          { key: "breederAction", label: "Breeder Action", render: (r) => {
            const a = r.breederAction as string;
            if (a === "existing_email") return <span className="text-xs text-blue-600">match email</span>;
            if (a === "existing_name") return <span className="text-xs text-blue-600">match name</span>;
            if (a === "create") return <span className="text-xs text-green-600">create new</span>;
            return null;
          }},
          { key: "band", label: "Band" },
          { key: "birdName", label: "Bird Name" },
          { key: "color", label: "Color" },
        ]}
        onSuccess={() => { refetch(); queryClient.invalidateQueries({ queryKey: ["event-inventory"] }); }}
      />

      <ExportModal
        open={isExportOpen}
        onOpenChange={setIsExportOpen}
        fields={[
          { key: "breeder_name", label: "Breeder Name" },
          { key: "breeder_email", label: "Breeder Email" },
          { key: "bird_name", label: "Bird Name" },
          { key: "band", label: "Band (full)" },
          { key: "band1", label: "Federation (band1)" },
          { key: "band2", label: "Year (band2)" },
          { key: "band3", label: "Letters (band3)" },
          { key: "band4", label: "Number (band4)" },
          { key: "color", label: "Color" },
          { key: "sex", label: "Sex" },
          { key: "rfid", label: "RFID" },
          { key: "attention", label: "Attention" },
          { key: "is_backup", label: "Backup" },
        ]}
        exportUrl={(fields) => `/api/admin/event/${eventId}/export-birds?fields=${fields.join(",")}`}
        filename={`birds-event-${eventId}.csv`}
      />
    </div>
  );
}

// ============================================================
// CONSTANTS (shared with edit-bird-dialog)
// ============================================================
const FEDERATIONS = ["AU", "IF", "NPA", "CU", "BB", "ARPU", "IPB"];
const COLORS = [
  "BB", "BC", "BBWF", "BBPD", "BCWF", "BCPD", "SPLA", "CHOC", "RC", "SIL",
  "RCSP", "RR", "BLK", "OPAL", "SLAT", "PENC", "WHIT", "GRIZ", "DC", "DCWF",
];

// ============================================================
// SHARED: Bird checklist used by event + season modes
// ============================================================
function BirdChecklist({
  items,
  loading,
  selectedBirdIds,
  onToggle,
  onToggleAll,
  emptyMsg,
}: {
  items: any[];
  loading: boolean;
  selectedBirdIds: Set<number>;
  onToggle: (id: number) => void;
  onToggleAll: () => void;
  emptyMsg: string;
}) {
  if (loading) return (
    <div className="space-y-2">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
  if (items.length === 0) return (
    <p className="text-sm text-muted-foreground border rounded-lg p-4 text-center">{emptyMsg}</p>
  );
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Birds <span className="text-muted-foreground font-normal">({selectedBirdIds.size} selected)</span></Label>
        <Button type="button" variant="ghost" size="sm" onClick={onToggleAll}>
          {selectedBirdIds.size === items.length ? "Deselect All" : "Select All"}
        </Button>
      </div>
      <div className="border rounded-lg divide-y max-h-[280px] overflow-y-auto">
        {items.map((item: any) => {
          const bird = item.bird;
          const breeder = item.eventInventory?.breeder;
          const breederName = [breeder?.firstName, breeder?.lastName].filter(Boolean).join(" ");
          return (
            <label key={bird.id} className="flex items-center gap-3 p-2.5 hover:bg-muted/50 cursor-pointer">
              <Checkbox checked={selectedBirdIds.has(bird.id)} onCheckedChange={() => onToggle(bird.id)} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{bird.birdName || "Unnamed"}</p>
                <p className="text-xs text-muted-foreground font-mono truncate">
                  {bird.band || [bird.band1, bird.band2, bird.band3, bird.band4].filter(Boolean).join("-")}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs text-muted-foreground">{bird.color || ""}</span>
                {breederName && <p className="text-xs text-muted-foreground">{breederName}</p>}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// ADD BIRDS DIALOG — three modes
// ============================================================

type AddMode = "new" | "event" | "season";

function AddBirdsDialog({
  open,
  onOpenChange,
  eventId,
  existingItems,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  existingItems: EventInventoryItem[];
  onSuccess: () => void;
}) {
  const [mode, setMode] = useState<AddMode | "">("");

  // mode=new state
  const registerMutation = useRegisterBirdToEvent(eventId);
  const [newBreederId, setNewBreederId] = useState("");
  const [newName, setNewName] = useState("");
  const [newBand1, setNewBand1] = useState("");
  const [newBand2, setNewBand2] = useState(String(new Date().getFullYear()).slice(-2));
  const [newBand3, setNewBand3] = useState("");
  const [newBand4, setNewBand4] = useState("");
  const [newColor, setNewColor] = useState("");
  const [newSex, setNewSex] = useState<"0" | "1" | "2">("1");
  const [newRfid, setNewRfid] = useState("");
  const [newAttention, setNewAttention] = useState(false);
  const [newIsBackup, setNewIsBackup] = useState(false);

  const bandNumberRef = useRef<HTMLInputElement>(null);
  const [stagedBirds, setStagedBirds] = useState<Array<{
    tempId: string; breederId: string; name: string;
    band1: string; band2: string; band3: string; band4: string;
    color: string; sex: string; rfid: string; attention: boolean; isBackup: boolean;
  }>>([]);

  // RFID scanner state
  const [rfidPolling, setRfidPolling] = useState(false);
  const rfidPollRef = useRef<NodeJS.Timeout | null>(null);
  const rfidPollStartRef = useRef<string | null>(null);
  const rfidLastRef = useRef<string | null>(null);

  const startRfidPoll = () => {
    setRfidPolling(true);
    rfidLastRef.current = null;
    rfidPollStartRef.current = new Date().toISOString();
    const poll = async () => {
      try {
        const res = await fetch("/api/scanner/poll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startedAt: rfidPollStartRef.current }),
        });
        const d = await res.json();
        if (d?.length > 0 && d[0].el && d[0].el !== rfidLastRef.current) {
          rfidLastRef.current = d[0].el;
          setNewRfid(d[0].el);
        }
      } catch { /* silent */ }
    };
    poll();
    rfidPollRef.current = setInterval(poll, 2000);
  };

  const stopRfidPoll = () => {
    if (rfidPollRef.current) { clearInterval(rfidPollRef.current); rfidPollRef.current = null; }
    setRfidPolling(false);
  };

  const { isConnected: isSerial, error: serialError, connect: connectSerial, disconnect: disconnectSerial } =
    useWebSerial({ onScan: (scanned) => setNewRfid(scanned) });

  const startSerial = async () => {
    stopRfidPoll();
    await connectSerial();
  };

  const stopSerial = async () => {
    await disconnectSerial();
  };

  useEffect(() => {
    if (!open) { stopRfidPoll(); disconnectSerial(); }
    return () => { stopRfidPoll(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Breeders registered in this event (derived from existing items — no extra fetch)
  const eventBreeders = useMemo(() => {
    const seen = new Map<number, { id: number; firstName: string | null; lastName: string | null }>();
    for (const item of existingItems) {
      const b = (item as any).eventInventory?.breeder;
      if (b?.id && !seen.has(b.id)) seen.set(b.id, b);
    }
    return [...seen.values()].sort((a, b) => (a.lastName || "").localeCompare(b.lastName || ""));
  }, [existingItems]);

  // mode=event state
  const addMutation = useAddBirdsToEvent(eventId);
  const [sourceEventId, setSourceEventId] = useState("");
  const [selectedBirdIds, setSelectedBirdIds] = useState<Set<number>>(new Set());
  const { data: eventsData } = useListEvents({ params: mode === "event" ? {} : undefined });
  const allEvents: any[] = eventsData?.events || [];
  const otherEvents = allEvents.filter((e: any) => String(e.id) !== eventId);
  const { data: sourceEventData, isPending: loadingEventSource } = useListEventInventoryItems(
    sourceEventId || 0
  );
  const sourceEventItems: any[] = sourceEventData?.eventInventoryItems || [];

  // mode=season state
  const [sourceSeasonId, setSourceSeasonId] = useState("");
  const [selectedSeasonBirdIds, setSelectedSeasonBirdIds] = useState<Set<number>>(new Set());
  const { data: seasonsData, isPending: loadingSeasons } = useApiQuery({
    endpoint: "/api/admin/seasons",
    queryKey: ["all-seasons"],
    enabled: mode === "season",
  });
  const allSeasons: any[] = (seasonsData as any)?.seasons || [];
  const { data: sourceSeasonData, isPending: loadingSeasonSource } = useListEventInventoryItemsBySeason(
    sourceSeasonId ? parseInt(sourceSeasonId) : null
  );
  const sourceSeasonItems: any[] = sourceSeasonData?.eventInventoryItems || [];

  const existingBirdIds = useMemo(
    () => new Set(existingItems.map((i) => i.bird?.id).filter(Boolean)),
    [existingItems]
  );

  const availableEventBirds = useMemo(
    () => sourceEventItems.filter((item: any) => item.bird && !existingBirdIds.has(item.bird.id)),
    [sourceEventItems, existingBirdIds]
  );

  const availableSeasonBirds = useMemo(
    () => sourceSeasonItems.filter((item: any) => item.bird && !existingBirdIds.has(item.bird.id)),
    [sourceSeasonItems, existingBirdIds]
  );

  const resetAll = () => {
    stopRfidPoll();
    setMode("");
    setStagedBirds([]);
    setNewBreederId(""); setNewName(""); setNewBand1(""); setNewBand2(String(new Date().getFullYear()).slice(-2)); setNewBand3(""); setNewBand4("");
    setNewColor(""); setNewSex("1"); setNewRfid(""); setNewAttention(false); setNewIsBackup(false);
    setSourceEventId(""); setSelectedBirdIds(new Set());
    setSourceSeasonId(""); setSelectedSeasonBirdIds(new Set());
  };

  const toggleBird = (set: Set<number>, setFn: (s: Set<number>) => void, id: number) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setFn(next);
  };

  const handleStageAndNew = () => {
    if (!newBreederId) { toast.error("Select a breeder"); return; }
    if (!newBand1 || !newBand2 || !newBand3 || !newBand4) { toast.error("All band fields required"); return; }
    if (!newColor) { toast.error("Select a color"); return; }
    const bandKey = `${newBand1}-${newBand2}-${newBand3}-${newBand4}`;
    if (stagedBirds.some(b => `${b.band1}-${b.band2}-${b.band3}-${b.band4}` === bandKey)) {
      toast.error("Band already staged"); return;
    }
    setStagedBirds(prev => [...prev, {
      tempId: crypto.randomUUID(),
      breederId: newBreederId, name: newName,
      band1: newBand1, band2: newBand2, band3: newBand3, band4: newBand4,
      color: newColor, sex: newSex, rfid: newRfid, attention: newAttention, isBackup: newIsBackup,
    }]);
    setNewName(""); setNewRfid(""); setNewAttention(false); setNewIsBackup(false);
    const parsed = parseInt(newBand4);
    setNewBand4(isNaN(parsed) ? "" : String(parsed + 1));
    setTimeout(() => bandNumberRef.current?.focus(), 0);
  };

  const handleSubmitNew = async () => {
    if (!newBreederId) { toast.error("Select a breeder"); return; }
    if (!newBand1 || !newBand2 || !newBand3 || !newBand4) { toast.error("All band fields required"); return; }
    if (!newColor) { toast.error("Select a color"); return; }

    const allBirds = [
      ...stagedBirds.map(b => ({
        breederId: parseInt(b.breederId),
        name: b.name || `${b.band1}-${b.band2}-${b.band3}-${b.band4}`,
        band1: b.band1, band2: b.band2, band3: b.band3, band4: b.band4,
        color: b.color, sex: parseInt(b.sex),
        rfid: b.rfid || undefined, attention: b.attention, isBackup: b.isBackup,
      })),
      {
        breederId: parseInt(newBreederId),
        name: newName || `${newBand1}-${newBand2}-${newBand3}-${newBand4}`,
        band1: newBand1, band2: newBand2, band3: newBand3, band4: newBand4,
        color: newColor, sex: parseInt(newSex),
        rfid: newRfid || undefined, attention: newAttention, isBackup: newIsBackup,
      },
    ];

    try {
      for (const bird of allBirds) {
        await registerMutation.mutateAsync(bird);
      }
      toast.success(allBirds.length > 1 ? `${allBirds.length} birds registered` : "Bird registered");
      resetAll();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error?.message || "Failed to register bird");
    }
  };

  const handleSubmitFromEvent = async () => {
    if (selectedBirdIds.size === 0) { toast.error("Select at least one bird"); return; }
    try {
      const res = await addMutation.mutateAsync({ birdIds: [...selectedBirdIds] });
      toast.success((res as any)?.message || "Birds added");
      resetAll();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error?.message || "Failed to add birds");
    }
  };

  const handleSubmitFromSeason = async () => {
    if (selectedSeasonBirdIds.size === 0) { toast.error("Select at least one bird"); return; }
    try {
      const res = await addMutation.mutateAsync({ birdIds: [...selectedSeasonBirdIds] });
      toast.success((res as any)?.message || "Birds added");
      resetAll();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error?.message || "Failed to add birds");
    }
  };

  const isSubmitting = registerMutation.isPending || addMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetAll(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{mode === "new" && stagedBirds.length > 0 ? `Add Birds (${stagedBirds.length} staged)` : "Add Birds"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 pr-1">
          {/* Mode selector */}
          <div className="space-y-2">
            <Label>How would you like to add birds?</Label>
            <Select value={mode} onValueChange={(v) => { resetAll(); setMode(v as AddMode); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select an option…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Register New Bird</SelectItem>
                <SelectItem value="event">From Past Event</SelectItem>
                <SelectItem value="season">From Past Season</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Mode: Register New Bird */}
          {mode === "new" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Breeder</Label>
                <Select value={newBreederId} onValueChange={setNewBreederId}>
                  <SelectTrigger><SelectValue placeholder="Select breeder" /></SelectTrigger>
                  <SelectContent>
                    {eventBreeders.map((b) => (
                      <SelectItem key={b.id} value={String(b.id)}>
                        {[b.firstName, b.lastName].filter(Boolean).join(" ") || `Breeder #${b.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Bird Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input placeholder="e.g. Blue Arrow" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>

              {/* Band row — inline with separators, same as create-bird-dialog */}
              <div className="flex items-end gap-1">
                <div className="flex-1 space-y-1.5">
                  <Label>Federation</Label>
                  <Select value={newBand1} onValueChange={setNewBand1}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="AU…" /></SelectTrigger>
                    <SelectContent>
                      {FEDERATIONS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <span className="pb-2 text-muted-foreground">-</span>
                <div className="flex-1 space-y-1.5">
                  <Label>Year</Label>
                  <Input className="h-9" placeholder="2024" value={newBand2} onChange={(e) => setNewBand2(e.target.value.replace(/[^0-9]/g, ""))} />
                </div>
                <span className="pb-2 text-muted-foreground">-</span>
                <div className="flex-1 space-y-1.5">
                  <Label>Letters</Label>
                  <Input className="h-9" placeholder="ABC" value={newBand3} onChange={(e) => setNewBand3(e.target.value.toUpperCase())} />
                </div>
                <span className="pb-2 text-muted-foreground">-</span>
                <div className="flex-1 space-y-1.5">
                  <Label>Number</Label>
                  <Input ref={bandNumberRef} className="h-9" placeholder="1234" value={newBand4} onChange={(e) => setNewBand4(e.target.value)} />
                </div>
                <span className="pb-2 text-muted-foreground">-</span>
                <div className="flex-1 space-y-1.5">
                  <Label>Color</Label>
                  <Select value={newColor} onValueChange={setNewColor}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="…" /></SelectTrigger>
                    <SelectContent>
                      {COLORS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <span className="pb-2 text-muted-foreground">-</span>
                <div className="flex-1 space-y-1.5">
                  <Label>Sex</Label>
                  <Select value={newSex} onValueChange={(v) => setNewSex(v as "0" | "1" | "2")}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Cock</SelectItem>
                      <SelectItem value="2">Hen</SelectItem>
                      <SelectItem value="0">Unknown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* RFID with poll + serial scanner buttons */}
              <div className="space-y-1.5">
                <Label>RFID <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <div className="flex gap-1">
                  <Input className="flex-1" placeholder="scan or type…" value={newRfid} onChange={(e) => setNewRfid(e.target.value)} />
                  <Button type="button" variant={rfidPolling ? "default" : "outline"} size="icon"
                    onClick={rfidPolling ? stopRfidPoll : startRfidPoll} title="Poll scanner (python / tipes)">
                    {rfidPolling ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                  </Button>
                  <Button type="button" variant={isSerial ? "default" : "outline"} size="icon"
                    onClick={isSerial ? stopSerial : startSerial} title="Web Serial (Chrome/Edge COM port)">
                    <Usb className="h-4 w-4" />
                  </Button>
                </div>
                {rfidPolling && <p className="text-xs text-green-600 animate-pulse">Poll active — scan a bird</p>}
                {isSerial && <p className="text-xs text-blue-600 animate-pulse">Web Serial active — scan to assign</p>}
                {serialError && <p className="text-xs text-red-600">{serialError}</p>}
              </div>

              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={newAttention} onCheckedChange={(v) => setNewAttention(!!v)} />
                  <span className="text-sm">Pay attention while basketing</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={newIsBackup} onCheckedChange={(v) => setNewIsBackup(!!v)} />
                  <span className="text-sm">Backup bird</span>
                </label>
              </div>
            </div>
          )}

          {/* Mode: From Past Event */}
          {mode === "event" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Source Event</Label>
                <Select value={sourceEventId} onValueChange={(id) => { setSourceEventId(id); setSelectedBirdIds(new Set()); }}>
                  <SelectTrigger><SelectValue placeholder="Select an event" /></SelectTrigger>
                  <SelectContent>
                    {otherEvents.map((e: any) => (
                      <SelectItem key={e.id} value={String(e.id)}>
                        {e.eventName || e.name || `Event #${e.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {sourceEventId && (
                <BirdChecklist
                  items={availableEventBirds}
                  loading={loadingEventSource}
                  selectedBirdIds={selectedBirdIds}
                  onToggle={(id) => toggleBird(selectedBirdIds, setSelectedBirdIds, id)}
                  onToggleAll={() => {
                    if (selectedBirdIds.size === availableEventBirds.length) setSelectedBirdIds(new Set());
                    else setSelectedBirdIds(new Set(availableEventBirds.map((i: any) => i.bird.id)));
                  }}
                  emptyMsg={sourceEventItems.length === 0 ? "No birds in this event" : "All birds already in current event"}
                />
              )}
            </div>
          )}

          {/* Mode: From Past Season */}
          {mode === "season" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Source Season</Label>
                {loadingSeasons ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select value={sourceSeasonId} onValueChange={(id) => { setSourceSeasonId(id); setSelectedSeasonBirdIds(new Set()); }}>
                    <SelectTrigger><SelectValue placeholder="Select a season" /></SelectTrigger>
                    <SelectContent>
                      {allSeasons.map((s: any) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.name} — {s.event?.name || `Event #${s.eventId}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              {sourceSeasonId && (
                <BirdChecklist
                  items={availableSeasonBirds}
                  loading={loadingSeasonSource}
                  selectedBirdIds={selectedSeasonBirdIds}
                  onToggle={(id) => toggleBird(selectedSeasonBirdIds, setSelectedSeasonBirdIds, id)}
                  onToggleAll={() => {
                    if (selectedSeasonBirdIds.size === availableSeasonBirds.length) setSelectedSeasonBirdIds(new Set());
                    else setSelectedSeasonBirdIds(new Set(availableSeasonBirds.map((i: any) => i.bird.id)));
                  }}
                  emptyMsg={sourceSeasonItems.length === 0 ? "No birds in this season" : "All birds already in current event"}
                />
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetAll(); onOpenChange(false); }}>Cancel</Button>
          {mode === "new" && (
            <Button type="button" variant="secondary" onClick={handleStageAndNew}>
              Add Another Bird
            </Button>
          )}
          {mode === "new" && (
            <Button onClick={handleSubmitNew} disabled={isSubmitting}>
              {isSubmitting ? "Registering…" : stagedBirds.length > 0 ? `Register ${stagedBirds.length + 1} Birds` : "Register Bird"}
            </Button>
          )}
          {mode === "event" && (
            <Button onClick={handleSubmitFromEvent} disabled={isSubmitting || selectedBirdIds.size === 0}>
              {isSubmitting ? "Adding…" : `Add ${selectedBirdIds.size} Bird${selectedBirdIds.size !== 1 ? "s" : ""}`}
            </Button>
          )}
          {mode === "season" && (
            <Button onClick={handleSubmitFromSeason} disabled={isSubmitting || selectedSeasonBirdIds.size === 0}>
              {isSubmitting ? "Adding…" : `Add ${selectedSeasonBirdIds.size} Bird${selectedSeasonBirdIds.size !== 1 ? "s" : ""}`}
            </Button>
          )}
          {!mode && <Button disabled>Add Birds</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
