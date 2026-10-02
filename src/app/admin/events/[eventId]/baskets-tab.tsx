"use client";

/**
 * The basketing workspace.
 *
 * This is a port of HayLoft's `TeditRaceF` — the screen where basketing actually
 * happened. Its structure is the point, so it is reproduced rather than
 * reinterpreted:
 *
 *   race header (raceP)
 *   ├── left column (birdsP)          ── splitter ──  right column (basketsP)
 *   │   ├── "Entries"      toolbar + grid + totals     "Baskets" toolbar
 *   │   ├── ── splitter ──                             tabs: Loft / Race baskets
 *   │   └── "Ignore birds list" grid                   grid + capacity totals
 *
 * Both splitters drag, as the originals did. Everything the operator can reach
 * lives on one screen, which is what made the old program workable at a
 * basketing table: entries on the left, baskets on the right, and the basket
 * numbers never more than a glance away.
 *
 * The previous version of this screen was three sibling tabs (Loft Baskets /
 * Race Baskets / Bird Prescan) with a race selector repeated in each. Loft and
 * race baskets are now the two tabs of the baskets pane, as in `basketPC`, and
 * prescan is a toolbar action opening a modal, as in `ActionPreScan`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSeasonContext } from "@/lib/season-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Ban,
  Boxes,
  Download,
  Eraser,
  MoveRight,
  Pencil,
  Plus,
  Scan,
  Search,
  Trash2,
  Undo2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import {
  useAssignBaskets,
  useAssignRaceBaskets,
  useCreateBasket,
  useDeleteBasket,
  useEventBaskets,
  useUpdateBasket,
} from "@/lib/api/event-baskets";
import { useListRaces } from "@/lib/api/races";
import { useListRaceItems } from "@/lib/api/race-items";
import type { EventBasketItem, Race, RaceItem } from "@/lib/types";
import {
  EMPTY_ENTRY_FILTERS,
  ENTRY_EXPORT_COLUMNS,
  EntriesPane,
  applyEntryFilters,
  type EntryFilters,
} from "./basketing/entries-pane";
import { BasketsPane, basketCount, type BasketPhase } from "./basketing/baskets-pane";
import { IgnoreListPane, type IgnoredBirdRow } from "./basketing/ignore-list-pane";
import {
  BasketFormDialog,
  ScannerBasketingDialog,
} from "./basketing/basket-scanner-dialog";
import { PrescanDialog } from "./basketing/scan-dialogs";

interface BasketsTabProps {
  eventId: string;
}

// ============================================================
// SPLITTERS  (HayLoft basketSpliter / ignoreBirdSplliter)
// ============================================================

/** Drag handle between the two columns. Width is a percentage of the workspace. */
function VerticalSplitter({ onDrag }: { onDrag: (deltaX: number) => void }) {
  const dragging = useRef(false);
  const lastX = useRef(0);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      onDrag(e.clientX - lastX.current);
      lastX.current = e.clientX;
    };
    const up = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [onDrag]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      className="w-1.5 shrink-0 cursor-col-resize rounded-full bg-border hover:bg-primary/60 transition-colors"
      onMouseDown={(e) => {
        dragging.current = true;
        lastX.current = e.clientX;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
      }}
    />
  );
}

/** Drag handle between the entries grid and the ignore list. */
function HorizontalSplitter({ onDrag }: { onDrag: (deltaY: number) => void }) {
  const dragging = useRef(false);
  const lastY = useRef(0);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      onDrag(e.clientY - lastY.current);
      lastY.current = e.clientY;
    };
    const up = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [onDrag]);

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      className="h-1.5 shrink-0 cursor-row-resize rounded-full bg-border hover:bg-primary/60 transition-colors"
      onMouseDown={(e) => {
        dragging.current = true;
        lastY.current = e.clientY;
        document.body.style.cursor = "row-resize";
        document.body.style.userSelect = "none";
      }}
    />
  );
}

// ============================================================
// WORKSPACE
// ============================================================

export function BasketsTab({ eventId }: BasketsTabProps) {
  const { selectedSeasonId } = useSeasonContext();

  const { data: racesData } = useListRaces({ params: { eventId } });
  const races: Race[] = useMemo(
    () => (racesData as { races?: Race[] })?.races ?? [],
    [racesData]
  );
  const [selectedRaceId, setSelectedRaceId] = useState<string>("");

  useEffect(() => {
    if (!selectedRaceId && races.length > 0) setSelectedRaceId(String(races[0].id));
  }, [races, selectedRaceId]);

  const race = races.find((r) => String(r.id) === selectedRaceId) ?? null;

  // Layout — the splitter positions.
  const [leftPercent, setLeftPercent] = useState(64);
  const [ignoreHeight, setIgnoreHeight] = useState(150);
  const workspaceRef = useRef<HTMLDivElement>(null);

  const dragColumns = useCallback((deltaX: number) => {
    const width = workspaceRef.current?.clientWidth ?? 1200;
    setLeftPercent((p) => Math.min(85, Math.max(35, p + (deltaX / width) * 100)));
  }, []);
  const dragIgnore = useCallback((deltaY: number) => {
    setIgnoreHeight((h) => Math.min(480, Math.max(44, h - deltaY)));
  }, []);

  // ---- Data ----------------------------------------------------------------

  const {
    data: raceItemsData,
    isPending: entriesPending,
    refetch: refetchEntries,
  } = useListRaceItems({ params: selectedRaceId ? { raceId: selectedRaceId } : undefined });
  const entries: RaceItem[] = useMemo(
    () => (selectedRaceId ? (raceItemsData as { raceItems?: RaceItem[] })?.raceItems ?? [] : []),
    [raceItemsData, selectedRaceId]
  );

  const [basketPhase, setBasketPhase] = useState<BasketPhase>("LOFT");
  const {
    data: basketsData,
    isPending: basketsPending,
    refetch: refetchBaskets,
  } = useEventBaskets(eventId, basketPhase, selectedRaceId || undefined, selectedSeasonId);
  const baskets: EventBasketItem[] = useMemo(
    () => basketsData?.baskets ?? [],
    [basketsData]
  );


  // Basket numbers for the entries filters — both phases, not just the open tab.
  const { data: loftBasketsData } = useEventBaskets(
    eventId,
    "LOFT",
    selectedRaceId || undefined,
    selectedSeasonId
  );
  const { data: raceBasketsData } = useEventBaskets(
    eventId,
    "RACE",
    selectedRaceId || undefined,
    selectedSeasonId
  );
  const loftBasketNos = useMemo(
    () =>
      ((loftBasketsData?.baskets ?? []) as EventBasketItem[])
        .map((b) => b.basketNo)
        .sort((a, b) => a - b),
    [loftBasketsData]
  );
  const raceBasketNos = useMemo(
    () =>
      ((raceBasketsData?.baskets ?? []) as EventBasketItem[])
        .map((b) => b.basketNo)
        .sort((a, b) => a - b),
    [raceBasketsData]
  );

  // Ignore list.
  const [ignored, setIgnored] = useState<IgnoredBirdRow[]>([]);
  const [ignoredPending, setIgnoredPending] = useState(false);

  const loadIgnored = useCallback(async () => {
    if (!selectedRaceId) {
      setIgnored([]);
      return;
    }
    setIgnoredPending(true);
    try {
      const res = await fetch(`/api/admin/race/${selectedRaceId}/ignore-birds`);
      const d = await res.json();
      type ApiIgnored = {
        id: number;
        note: string | null;
        inventoryItem?: {
          id: number;
          bird?: { band?: string | null; rfid?: string | null; color?: string | null } | null;
          eventInventory?: {
            breeder?: { firstName?: string | null; lastName?: string | null } | null;
          } | null;
        } | null;
      };
      setIgnored(
        ((d?.ignored ?? []) as ApiIgnored[]).map((row) => {
          const breeder = row.inventoryItem?.eventInventory?.breeder ?? null;
          return {
            id: row.id,
            inventoryItemId: row.inventoryItem?.id ?? null,
            note: row.note,
            breeder: breeder
              ? [breeder.lastName, breeder.firstName].filter(Boolean).join(", ") || null
              : null,
            band: row.inventoryItem?.bird?.band ?? null,
            eid: row.inventoryItem?.bird?.rfid ?? null,
            color: row.inventoryItem?.bird?.color ?? null,
          };
        })
      );
    } catch {
      toast.error("Failed to load the ignore list");
    } finally {
      setIgnoredPending(false);
    }
  }, [selectedRaceId]);

  useEffect(() => {
    loadIgnored();
  }, [loadIgnored]);

  // ---- Mutations -----------------------------------------------------------

  const createMutation = useCreateBasket(eventId);
  const updateMutation = useUpdateBasket(eventId);
  const deleteMutation = useDeleteBasket(eventId);
  const assignLoftMutation = useAssignBaskets(eventId);
  const assignRaceMutation = useAssignRaceBaskets(eventId);

  // ---- Selection and filters ----------------------------------------------

  const [filters, setFilters] = useState<EntryFilters>(EMPTY_ENTRY_FILTERS);
  const [selectedEntryIds, setSelectedEntryIds] = useState<number[]>([]);
  const [selectedBasketId, setSelectedBasketId] = useState<number | null>(null);

  // Changing race invalidates everything that referenced the old one.
  useEffect(() => {
    setSelectedEntryIds([]);
    setSelectedBasketId(null);
    setFilters(EMPTY_ENTRY_FILTERS);
  }, [selectedRaceId]);

  const selectedBasket = baskets.find((b) => b.id === selectedBasketId) ?? null;
  const selectedEntries = entries.filter((e) => selectedEntryIds.includes(e.id));

  // ---- Dialog state --------------------------------------------------------

  const [basketForm, setBasketForm] = useState<{
    mode: "create" | "edit";
    basketNo: number;
    capacity: string;
    label: string;
    basketId?: number;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EventBasketItem | null>(null);
  const [clearTarget, setClearTarget] = useState<EventBasketItem | null>(null);
  const [scannerPhase, setScannerPhase] = useState<BasketPhase | null>(null);
  const [prescanOpen, setPrescanOpen] = useState(false);
  const [ignoreDialogOpen, setIgnoreDialogOpen] = useState(false);
  const [ignoreNote, setIgnoreNote] = useState("");
  const [autoAssignPreview, setAutoAssignPreview] = useState<{
    mode: string;
    lines: string[];
    warning: string | null;
  } | null>(null);
  const [autoAssignBusy, setAutoAssignBusy] = useState(false);

  const nextBasketNo = useMemo(
    () => (baskets.length > 0 ? Math.max(...baskets.map((b) => b.basketNo)) + 1 : 1),
    [baskets]
  );

  const openNewBasket = useCallback(() => {
    if (basketPhase === "RACE" && !selectedRaceId) {
      toast.error("Select a race first");
      return;
    }
    setBasketForm({ mode: "create", basketNo: nextBasketNo, capacity: "", label: "" });
  }, [basketPhase, selectedRaceId, nextBasketNo]);

  const openEditBasket = useCallback(() => {
    if (!selectedBasket) {
      toast.info("Select a basket first");
      return;
    }
    setBasketForm({
      mode: "edit",
      basketNo: selectedBasket.basketNo,
      capacity: String(selectedBasket.capacity),
      label: selectedBasket.label ?? "",
      basketId: selectedBasket.id,
    });
  }, [selectedBasket]);

  // HayLoft bound New to Ins and Edit basket to F2.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (basketForm || deleteTarget || clearTarget || scannerPhase || prescanOpen) return;
      if (e.key === "Insert") {
        e.preventDefault();
        openNewBasket();
      } else if (e.key === "F2") {
        e.preventDefault();
        openEditBasket();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    basketForm,
    deleteTarget,
    clearTarget,
    scannerPhase,
    prescanOpen,
    openNewBasket,
    openEditBasket,
  ]);

  const searchRef = useRef<HTMLDivElement>(null);
  const focusSearch = () => {
    const input = searchRef.current?.querySelector<HTMLInputElement>('input[type="text"]');
    input?.focus();
    input?.select();
  };

  // ---- Handlers ------------------------------------------------------------

  const saveBasket = async (keepOpen: boolean) => {
    if (!basketForm) return;
    const cap = parseInt(basketForm.capacity);
    if (isNaN(cap) || cap < 1) {
      toast.error("Capacity must be a positive number");
      return;
    }
    try {
      if (basketForm.mode === "edit" && basketForm.basketId) {
        await updateMutation.mutateAsync({
          basketId: basketForm.basketId,
          label: basketForm.label,
          capacity: cap,
        });
        toast.success(`Basket #${basketForm.basketNo} updated`);
        setBasketForm(null);
      } else {
        await createMutation.mutateAsync({
          capacity: cap,
          phase: basketPhase,
          ...(selectedRaceId ? { raceId: parseInt(selectedRaceId) } : {}),
        });
        toast.success(`Basket #${basketForm.basketNo} created`);
        if (keepOpen) {
          setBasketForm({
            mode: "create",
            basketNo: basketForm.basketNo + 1,
            capacity: "",
            label: "",
          });
        } else {
          setBasketForm(null);
        }
      }
      refetchBaskets();
    } catch (error: unknown) {
      toast.error((error as Error)?.message || "Failed to save the basket");
    }
  };

  const confirmDeleteBasket = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync({ basketId: deleteTarget.id });
      toast.success(`Basket #${deleteTarget.basketNo} deleted`);
      if (selectedBasketId === deleteTarget.id) setSelectedBasketId(null);
      setDeleteTarget(null);
      refetchBaskets();
      refetchEntries();
    } catch (error: unknown) {
      toast.error((error as Error)?.message || "Failed to delete the basket");
    }
  };

  const confirmClearBasket = async () => {
    if (!clearTarget) return;
    try {
      await updateMutation.mutateAsync({ basketId: clearTarget.id, action: "clear" });
      toast.success(`Basket #${clearTarget.basketNo} cleared`);
      setClearTarget(null);
      refetchBaskets();
      refetchEntries();
    } catch (error: unknown) {
      toast.error((error as Error)?.message || "Failed to clear the basket");
    }
  };

  /** ActionSetBasket — put the selected entries into the selected basket. */
  const setBasketForSelection = async () => {
    if (!selectedBasket) {
      toast.info("Select a basket on the right first");
      return;
    }
    if (selectedEntries.length === 0) {
      toast.info("Select one or more entries first");
      return;
    }
    const inventoryItemIds = selectedEntries
      .map((e) => e.inventoryItemId)
      .filter((id): id is number => id != null);
    if (inventoryItemIds.length === 0) {
      toast.error("The selected entries have no registration to basket");
      return;
    }
    try {
      await updateMutation.mutateAsync({
        basketId: selectedBasket.id,
        action: "set-birds",
        inventoryItemIds,
      });
      toast.success(
        `${inventoryItemIds.length} bird(s) set to basket #${selectedBasket.basketNo}`
      );
      setSelectedEntryIds([]);
      refetchBaskets();
      refetchEntries();
    } catch (error: unknown) {
      toast.error((error as Error)?.message || "Failed to set the basket");
    }
  };

  /** The automatic allocation — BFD for loft baskets, redistribution for race. */
  const previewAutoAssign = async () => {
    if (baskets.length === 0) {
      toast.info("Create some baskets first");
      return;
    }
    setAutoAssignBusy(true);
    try {
      if (basketPhase === "LOFT") {
        const res = await assignLoftMutation.mutateAsync({
          preview: true,
          mode: "shuffle",
          ...(selectedRaceId ? { raceId: parseInt(selectedRaceId) } : {}),
          ...(selectedSeasonId ? { seasonId: selectedSeasonId } : {}),
        });
        const r = ((res as { data?: unknown })?.data ?? res) as {
          assigned?: { lastName: string; basketNo: number; birdCount: number }[];
          unassigned?: { lastName: string; birdCount: number }[];
          message?: string;
        };
        if (!r.assigned?.length && !r.unassigned?.length) {
          toast.info(r.message || "No birds to assign");
          return;
        }
        setAutoAssignPreview({
          mode: "shuffle",
          lines: (r.assigned ?? []).map(
            (a) => `${a.lastName} — ${a.birdCount} bird(s) → basket #${a.basketNo}`
          ),
          warning: r.unassigned?.length
            ? `${r.unassigned.length} breeder(s) do not fit: ${r.unassigned
                .map((u) => `${u.lastName} (${u.birdCount})`)
                .join(", ")}`
            : null,
        });
      } else {
        if (!selectedRaceId) {
          toast.error("Select a race first");
          return;
        }
        const res = await assignRaceMutation.mutateAsync({
          preview: true,
          raceId: parseInt(selectedRaceId),
          mode: "reset",
        });
        const r = ((res as { data?: unknown })?.data ?? res) as {
          baskets?: { basketNo: number; birdCount: number; capacity: number }[];
          message?: string;
        };
        if (!r.baskets?.length) {
          toast.info(r.message || "No loft-basketed birds found");
          return;
        }
        setAutoAssignPreview({
          mode: "reset",
          lines: r.baskets.map(
            (b) => `Basket #${b.basketNo} — ${b.birdCount} / ${b.capacity} bird(s)`
          ),
          warning: null,
        });
      }
    } catch (error: unknown) {
      toast.error((error as Error)?.message || "Failed to preview the allocation");
    } finally {
      setAutoAssignBusy(false);
    }
  };

  const confirmAutoAssign = async () => {
    if (!autoAssignPreview) return;
    setAutoAssignBusy(true);
    try {
      if (basketPhase === "LOFT") {
        await assignLoftMutation.mutateAsync({
          preview: false,
          mode: "shuffle",
          ...(selectedRaceId ? { raceId: parseInt(selectedRaceId) } : {}),
          ...(selectedSeasonId ? { seasonId: selectedSeasonId } : {}),
        });
      } else {
        await assignRaceMutation.mutateAsync({
          preview: false,
          raceId: parseInt(selectedRaceId),
          mode: "reset",
        });
      }
      toast.success("Birds allocated to baskets");
      setAutoAssignPreview(null);
      refetchBaskets();
      refetchEntries();
    } catch (error: unknown) {
      toast.error((error as Error)?.message || "Failed to allocate baskets");
    } finally {
      setAutoAssignBusy(false);
    }
  };

  /** ActionIgnoreBird — exclude the selected entries from this race's results. */
  const confirmIgnore = async () => {
    const items = selectedEntries
      .map((e) => e.inventoryItemId)
      .filter((id): id is number => id != null);
    if (items.length === 0) return;
    let ok = 0;
    for (const inventoryItemId of items) {
      try {
        const res = await fetch(`/api/admin/race/${selectedRaceId}/ignore-birds`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inventoryItemId,
            ...(ignoreNote.trim() ? { note: ignoreNote.trim() } : {}),
          }),
        });
        if (res.ok) ok++;
      } catch {
        /* counted as a failure below */
      }
    }
    if (ok > 0) {
      toast.success(`${ok} bird(s) excluded — recalculate the race to apply it`);
    }
    if (ok < items.length) {
      toast.warning(`${items.length - ok} bird(s) could not be excluded`);
    }
    setIgnoreDialogOpen(false);
    setIgnoreNote("");
    setSelectedEntryIds([]);
    loadIgnored();
  };

  /** ActionRestoreBird. */
  const restoreIgnored = async (row: IgnoredBirdRow) => {
    if (!row.inventoryItemId) return;
    try {
      const res = await fetch(
        `/api/admin/race/${selectedRaceId}/ignore-birds?inventoryItemId=${row.inventoryItemId}`,
        { method: "DELETE" }
      );
      const d = await res.json();
      if (!res.ok) {
        toast.error(d?.message ?? "Failed to restore the bird");
        return;
      }
      toast.success(d?.message ?? "Bird re-included");
      loadIgnored();
    } catch {
      toast.error("Failed to restore the bird");
    }
  };

  /** ActionExportToExcel / ActionExportToCsv — the grid as it stands. */
  const exportEntries = async (format: "xlsx" | "csv") => {
    const rows = applyEntryFilters(entries, filters);
    if (rows.length === 0) {
      toast.info("Nothing to export");
      return;
    }
    const header = ENTRY_EXPORT_COLUMNS.map((c) => c.label);
    const body = rows.map((r) => ENTRY_EXPORT_COLUMNS.map((c) => c.value(r)));
    const stamp = new Date().toISOString().slice(0, 10);
    const name = `entries-race-${race?.raceNumber ?? selectedRaceId}-${stamp}`;

    if (format === "csv") {
      const escape = (v: unknown) => {
        const s = String(v ?? "");
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const csv = [header, ...body].map((r) => r.map(escape).join(",")).join("\r\n");
      download(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }), `${name}.csv`);
    } else {
      const XLSX = await import("xlsx");
      const sheet = XLSX.utils.aoa_to_sheet([header, ...body]);
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Entries");
      const out = XLSX.write(book, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
      download(
        new Blob([out], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        `${name}.xlsx`
      );
    }
    toast.success(`${rows.length} row(s) exported`);
  };

  // ---- Totals for the scanner dialogs --------------------------------------

  const totalBirds = entries.length;
  const nonBasketed =
    scannerPhase === "RACE"
      ? entries.filter((e) => e.raceBasketNo == null).length
      : entries.filter((e) => !e.isLoftBasketed).length;

  // ---- Render --------------------------------------------------------------

  if (races.length === 0) {
    return (
      <div className="border rounded-lg py-12 text-center text-sm text-muted-foreground">
        This event has no races yet. Basketing works per race.
      </div>
    );
  }

  const entriesToolbar = (
    <>
      <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={focusSearch}>
        <Search className="h-3.5 w-3.5" />
        Find
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={() => setPrescanOpen(true)}
        disabled={!selectedRaceId}
      >
        <Scan className="h-3.5 w-3.5" />
        Bird prescan
      </Button>
      <span className="mx-0.5 h-5 w-px bg-border" />
      <Button
        variant="secondary"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={() => setScannerPhase("LOFT")}
        disabled={!selectedRaceId}
      >
        <Boxes className="h-3.5 w-3.5" />
        Loft basketing
      </Button>
      <Button
        variant="secondary"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={() => setScannerPhase("RACE")}
        disabled={!selectedRaceId}
      >
        <Boxes className="h-3.5 w-3.5" />
        Race basketing
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={setBasketForSelection}
        disabled={!selectedBasket || selectedEntries.length === 0}
        title={
          !selectedBasket
            ? "Select a basket on the right"
            : selectedEntries.length === 0
            ? "Select entries to move"
            : `Move ${selectedEntries.length} bird(s) into basket #${selectedBasket.basketNo}`
        }
      >
        <MoveRight className="h-3.5 w-3.5" />
        Set basket
      </Button>
      <span className="mx-0.5 h-5 w-px bg-border" />
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={() => setIgnoreDialogOpen(true)}
        disabled={selectedEntries.length === 0}
      >
        <Ban className="h-3.5 w-3.5" />
        Ignore bird
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={() => {
          if (ignored.length === 0) toast.info("The ignore list is empty");
          else toast.info("Use the restore button on a row in the ignore birds list");
        }}
        disabled={ignored.length === 0}
      >
        <Undo2 className="h-3.5 w-3.5" />
        Restore bird
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs ml-auto">
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Export the grid as shown</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => exportEntries("xlsx")}>Excel (.xlsx)</DropdownMenuItem>
          <DropdownMenuItem onClick={() => exportEntries("csv")}>CSV (.csv)</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );

  const basketsToolbar = (
    <>
      <Button variant="default" size="sm" className="h-7 gap-1.5 text-xs" onClick={openNewBasket}>
        <Plus className="h-3.5 w-3.5" />
        New <span className="text-[10px] opacity-70">(Ins)</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={openEditBasket}
        disabled={!selectedBasket}
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit <span className="text-[10px] opacity-70">(F2)</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={() => selectedBasket && setClearTarget(selectedBasket)}
        disabled={!selectedBasket || basketCount(selectedBasket) === 0}
      >
        <Eraser className="h-3.5 w-3.5" />
        Clear
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive"
        onClick={() => selectedBasket && setDeleteTarget(selectedBasket)}
        disabled={!selectedBasket}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </Button>
      <Button
        variant="secondary"
        size="sm"
        className="h-7 gap-1.5 text-xs ml-auto"
        onClick={previewAutoAssign}
        disabled={autoAssignBusy || baskets.length === 0}
        title="Allocate every bird to a basket automatically"
      >
        <Wand2 className="h-3.5 w-3.5" />
        {autoAssignBusy ? "Working..." : "Set baskets"}
      </Button>
    </>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* raceP — the race header */}
      <div className="border rounded-lg bg-card">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3 px-4 py-3">
          <div className="space-y-1">
            <Label className="text-[11px] font-bold text-muted-foreground">Race No</Label>
            <Select value={selectedRaceId} onValueChange={setSelectedRaceId}>
              <SelectTrigger className="h-8 w-[240px] text-sm">
                <SelectValue placeholder="Select a race" />
              </SelectTrigger>
              <SelectContent>
                {races.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.raceNumber != null ? `#${r.raceNumber} — ` : ""}
                    {r.name ?? `Race ${r.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <HeaderField label="Type" value={race?.raceType?.name ?? null} />
          <HeaderField label="Liberation" value={race?.location ?? null} />
          <HeaderField
            label="Distance (miles)"
            value={race?.distance != null ? String(race.distance) : null}
          />
          <HeaderField
            label="Start date"
            value={race?.startTime ? new Date(race.startTime).toLocaleDateString() : null}
          />
          <HeaderField
            label="Start time"
            value={
              race?.startTime
                ? new Date(race.startTime).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : null
            }
          />
          <HeaderField
            label="Arrival date"
            value={race?.endTime ? new Date(race.endTime).toLocaleDateString() : null}
          />

          <div className="ml-auto space-y-1">
            <Label className="text-[11px] font-bold text-muted-foreground">Status</Label>
            <div>
              <Badge
                variant={
                  race?.status === "ENDED"
                    ? "secondary"
                    : race?.status === "STARTED"
                    ? "default"
                    : "outline"
                }
                className="text-xs"
              >
                {race?.status === "REGISTERING" ? "OPEN" : race?.status ?? "—"}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* raceItemP — the two columns */}
      <div ref={workspaceRef} className="flex gap-0 items-stretch h-[calc(100vh-18rem)] min-h-[32rem]">
        {/* birdsP */}
        <div className="flex flex-col min-w-0" style={{ width: `${leftPercent}%` }}>
          <div className="flex-1 min-h-0" ref={searchRef}>
            <EntriesPane
              items={entries}
              isPending={entriesPending}
              filters={filters}
              onFiltersChange={setFilters}
              selectedIds={selectedEntryIds}
              onSelectedChange={setSelectedEntryIds}
              loftBasketNos={loftBasketNos}
              raceBasketNos={raceBasketNos}
              toolbar={entriesToolbar}
            />
          </div>

          <div className="py-1">
            <HorizontalSplitter onDrag={dragIgnore} />
          </div>

          {/* ignoreBirdP */}
          <div style={{ height: ignoreHeight }} className="shrink-0 min-h-0">
            <IgnoreListPane
              rows={ignored}
              isPending={ignoredPending}
              isRestoring={false}
              onRestore={restoreIgnored}
            />
          </div>
        </div>

        <div className="px-1 flex items-stretch">
          <VerticalSplitter onDrag={dragColumns} />
        </div>

        {/* basketsP */}
        <div className="flex-1 min-w-0">
          <BasketsPane
            phase={basketPhase}
            onPhaseChange={setBasketPhase}
            baskets={baskets}
            isPending={basketsPending}
            selectedBasketId={selectedBasketId}
            onSelectBasket={setSelectedBasketId}
            toolbar={basketsToolbar}
          />
        </div>
      </div>

      {/* ---- Dialogs ---- */}

      {basketForm && (
        <BasketFormDialog
          open
          mode={basketForm.mode}
          basketNo={basketForm.basketNo}
          capacity={basketForm.capacity}
          label={basketForm.label}
          isSaving={createMutation.isPending || updateMutation.isPending}
          onCapacityChange={(v) => setBasketForm({ ...basketForm, capacity: v })}
          onLabelChange={(v) => setBasketForm({ ...basketForm, label: v })}
          onSave={() => saveBasket(false)}
          onSaveAndNew={() => saveBasket(true)}
          onClose={() => setBasketForm(null)}
        />
      )}

      {scannerPhase && selectedRaceId && (
        <ScannerBasketingDialog
          eventId={eventId}
          raceId={selectedRaceId}
          phase={scannerPhase}
          totalBirds={totalBirds}
          nonBasketedBirds={nonBasketed}
          onScanned={() => {
            refetchEntries();
            refetchBaskets();
          }}
          onClose={() => {
            setScannerPhase(null);
            refetchEntries();
            refetchBaskets();
          }}
        />
      )}

      {prescanOpen && selectedRaceId && (
        <PrescanDialog
          eventId={eventId}
          raceId={selectedRaceId}
          onClose={() => {
            setPrescanOpen(false);
            refetchEntries();
            refetchBaskets();
          }}
        />
      )}

      {/* Ignore bird — the note HayLoft stored on RACE_IGNORE_BIRD */}
      <Dialog open={ignoreDialogOpen} onOpenChange={setIgnoreDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ignore {selectedEntries.length} bird(s)</DialogTitle>
            <DialogDescription>
              They stay in the race but are excluded from the position and hotspot rankings.
              Recalculate the race afterwards for it to take effect.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ignore-note" className="text-xs font-bold">
              Note <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="ignore-note"
              value={ignoreNote}
              rows={3}
              placeholder="e.g. went back to the loft, scanned in error"
              onChange={(e) => setIgnoreNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIgnoreDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmIgnore}>Ignore</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set baskets preview */}
      <Dialog open={!!autoAssignPreview} onOpenChange={(o) => !o && setAutoAssignPreview(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Allocation preview — {basketPhase === "LOFT" ? "loft" : "race"} baskets
            </DialogTitle>
            <DialogDescription>
              Nothing is saved until you confirm. Existing assignments in this phase are replaced.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto space-y-1 text-sm">
            {autoAssignPreview?.lines.map((line, i) => (
              <div key={i} className="rounded border px-3 py-1.5">
                {line}
              </div>
            ))}
            {autoAssignPreview?.warning && (
              <div className="flex items-start gap-2 rounded border border-destructive/40 bg-destructive/5 px-3 py-2 text-destructive">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{autoAssignPreview.warning}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAutoAssignPreview(null)}>
              Discard
            </Button>
            <Button onClick={confirmAutoAssign} disabled={autoAssignBusy}>
              {autoAssignBusy ? "Saving..." : "Confirm & Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear basket */}
      <AlertDialog open={!!clearTarget} onOpenChange={(o) => !o && setClearTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear basket #{clearTarget?.basketNo}?</AlertDialogTitle>
            <AlertDialogDescription>
              {clearTarget && basketCount(clearTarget) > 0
                ? `${basketCount(clearTarget)} bird(s) will be unassigned and need to be basketed again.`
                : "The basket is already empty."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClearBasket} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Clearing..." : "Clear basket"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete basket */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete basket #{deleteTarget?.basketNo}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && basketCount(deleteTarget) > 0
                ? `${basketCount(deleteTarget)} bird(s) will be unassigned and need to be basketed again. `
                : ""}
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={confirmDeleteBasket}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete basket"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function HeaderField({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] font-bold text-muted-foreground">{label}</Label>
      <p className="text-sm h-8 flex items-center">{value || <span className="text-muted-foreground">—</span>}</p>
    </div>
  );
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
