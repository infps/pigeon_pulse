"use client";

import type { Event, EventInventoryItem } from "@/lib/types";
import { useState, useMemo, useRef, useCallback } from "react";
import { useListEventInventoryItems, useAddBirdsToEvent } from "@/lib/api/event-inventory-items";
import { useSeasonContext } from "@/lib/season-context";
import { useListEvents } from "@/lib/api/events";
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
import { Plus, Wifi, Square } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { createBirdsColumns } from "./birds-columns";
import { EditBirdDialog } from "@/components/edit-bird-dialog";
import { BirdDetailDialog } from "@/components/bird-detail-dialog";

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
          { id: "band", title: "Full Band" },
          { id: "birdName", title: "Bird Name" },
          { id: "breeder", title: "Breeder" },
          { id: "color", title: "Color" },
          { id: "rfid", title: "RFID" },
        ]}
        externalFilterValue={rfidFilter || undefined}
        externalFilterColumn={rfidFilter ? "rfid" : undefined}
        emptyState={emptyState}
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
    </div>
  );
}

// ============================================================
// ADD BIRDS DIALOG — Event-based flow
// ============================================================

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
  const addMutation = useAddBirdsToEvent(eventId);

  const [sourceEventId, setSourceEventId] = useState("");
  const [selectedBirdIds, setSelectedBirdIds] = useState<Set<number>>(new Set());

  // Load all events (to pick source)
  const { data: eventsData } = useListEvents({});
  const allEvents: any[] = eventsData?.events || [];
  const otherEvents = allEvents.filter((e: any) => String(e.id) !== eventId);

  // Load birds from source event
  const { data: sourceData, isPending: loadingSource } = useListEventInventoryItems(
    sourceEventId || 0
  );
  const sourceItems: any[] = sourceData?.eventInventoryItems || [];

  // Bird IDs already in current event
  const existingBirdIds = useMemo(() => {
    return new Set(existingItems.map((i) => i.bird?.id).filter(Boolean));
  }, [existingItems]);

  // Available = source event birds minus already in current event
  const availableBirds = useMemo(() => {
    return sourceItems.filter((item: any) => item.bird && !existingBirdIds.has(item.bird.id));
  }, [sourceItems, existingBirdIds]);

  const resetForm = () => {
    setSourceEventId("");
    setSelectedBirdIds(new Set());
  };

  const handleEventChange = (id: string) => {
    setSourceEventId(id);
    setSelectedBirdIds(new Set());
  };

  const toggleBird = (birdId: number) => {
    setSelectedBirdIds((prev) => {
      const next = new Set(prev);
      if (next.has(birdId)) next.delete(birdId);
      else next.add(birdId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedBirdIds.size === availableBirds.length) {
      setSelectedBirdIds(new Set());
    } else {
      setSelectedBirdIds(new Set(availableBirds.map((item: any) => item.bird.id)));
    }
  };

  const handleSubmit = async () => {
    if (selectedBirdIds.size === 0) { toast.error("Select at least one bird"); return; }

    try {
      const res = await addMutation.mutateAsync({ birdIds: [...selectedBirdIds] });
      const result = res as any;
      toast.success(result?.message || "Birds added");
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error?.message || "Failed to add birds");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Birds from Event</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 pr-1">
          {/* Source Event */}
          <div className="space-y-2">
            <Label>Source Event</Label>
            <Select value={sourceEventId} onValueChange={handleEventChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select an event" />
              </SelectTrigger>
              <SelectContent>
                {otherEvents.map((e: any) => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    {e.eventName || e.name || `Event #${e.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Bird selection */}
          {sourceEventId && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  Birds{" "}
                  <span className="text-muted-foreground font-normal">
                    ({selectedBirdIds.size} selected)
                  </span>
                </Label>
                {availableBirds.length > 0 && (
                  <Button type="button" variant="ghost" size="sm" onClick={toggleAll}>
                    {selectedBirdIds.size === availableBirds.length ? "Deselect All" : "Select All"}
                  </Button>
                )}
              </div>

              {loadingSource ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : availableBirds.length === 0 ? (
                <p className="text-sm text-muted-foreground border rounded-lg p-4 text-center">
                  {sourceItems.length === 0
                    ? "No birds in this event"
                    : "All birds already in current event"}
                </p>
              ) : (
                <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
                  {availableBirds.map((item: any) => {
                    const bird = item.bird;
                    const breeder = item.eventInventory?.breeder;
                    const breederName = [breeder?.firstName, breeder?.lastName].filter(Boolean).join(" ");
                    return (
                      <label
                        key={bird.id}
                        className="flex items-center gap-3 p-2.5 hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedBirdIds.has(bird.id)}
                          onCheckedChange={() => toggleBird(bird.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {bird.birdName || "Unnamed"}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono truncate">
                            {bird.band || [bird.band1, bird.band2, bird.band3, bird.band4].filter(Boolean).join("-")}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs text-muted-foreground">{bird.color || ""}</span>
                          {breederName && (
                            <p className="text-xs text-muted-foreground">{breederName}</p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={addMutation.isPending || selectedBirdIds.size === 0}
          >
            {addMutation.isPending ? "Adding..." : `Add ${selectedBirdIds.size} Bird${selectedBirdIds.size !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
