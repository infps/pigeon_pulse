"use client";

/**
 * The Entries pane — HayLoft's `TraceItemsFr` grid inside `TeditRaceF`.
 *
 * Column set, order and captions are the originals: Breeder, Band, EID, Color,
 * Lost, Loft basket, Loft basketed, Race basket, Race basket time, Pullings.
 * So is the footer (Total birds / Loft basketed birds / Race basketed birds) and
 * the "Entry fee not paid" legend, which in HayLoft was a coloured panel beside
 * the totals explaining the red rows that `itemsGCustomDrawCell` painted.
 *
 * HayLoft's cxTreeList gave the operator per-column filtering, sorting and
 * incremental search for free. Those are built explicitly here: a filter row
 * under the headers, sortable headers, and a column chooser standing in for the
 * tree list's customisation dialog.
 */

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
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
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  Columns3,
  FilterX,
  Search,
} from "lucide-react";
import type { RaceItem } from "@/lib/types";

export type EntryColumnKey =
  | "breeder"
  | "band"
  | "eid"
  | "color"
  | "lost"
  | "loftBasket"
  | "loftBasketed"
  | "raceBasket"
  | "raceBasketTime"
  | "pullings";

type SortDir = "asc" | "desc";

/** Caption and alignment per column, straight off the DFM. */
const COLUMNS: {
  key: EntryColumnKey;
  label: string;
  align?: "right" | "center";
  width?: string;
}[] = [
  { key: "breeder", label: "Breeder" },
  { key: "band", label: "Band" },
  { key: "eid", label: "EID" },
  { key: "color", label: "Color" },
  { key: "lost", label: "Lost", align: "center", width: "w-16" },
  { key: "loftBasket", label: "Loft basket", align: "right" },
  { key: "loftBasketed", label: "Loft basketed", align: "center" },
  { key: "raceBasket", label: "Race basket", align: "right" },
  { key: "raceBasketTime", label: "Race basket time", align: "right" },
  { key: "pullings", label: "Pullings", align: "right", width: "w-20" },
];

type TriState = "all" | "yes" | "no";

export interface EntryFilters {
  search: string;
  lost: TriState;
  loftBasketed: TriState;
  entryFee: "all" | "paid" | "unpaid";
  loftBasketNo: string;
  raceBasketNo: string;
}

export const EMPTY_ENTRY_FILTERS: EntryFilters = {
  search: "",
  lost: "all",
  loftBasketed: "all",
  entryFee: "all",
  loftBasketNo: "all",
  raceBasketNo: "all",
};

export function entryFilterCount(f: EntryFilters): number {
  let n = 0;
  if (f.search.trim()) n++;
  if (f.lost !== "all") n++;
  if (f.loftBasketed !== "all") n++;
  if (f.entryFee !== "all") n++;
  if (f.loftBasketNo !== "all") n++;
  if (f.raceBasketNo !== "all") n++;
  return n;
}

const cellValue = (item: RaceItem, key: EntryColumnKey): string | number | null => {
  switch (key) {
    case "breeder":
      return item.breederName ?? item.bird?.breeder?.lastName ?? null;
    case "band":
      return item.bird?.band ?? null;
    case "eid":
      return item.bird?.rfid ?? null;
    case "color":
      return item.bird?.color ?? null;
    case "lost":
      return item.isLost ? 1 : 0;
    case "loftBasket":
      return item.loftBasketNo ?? null;
    case "loftBasketed":
      return item.isLoftBasketed ? 1 : 0;
    case "raceBasket":
      return item.raceBasketNo ?? null;
    case "raceBasketTime":
      return item.raceBasketTime ?? null;
    case "pullings":
      return item.pullingCount ?? 0;
  }
};

export function applyEntryFilters(items: RaceItem[], f: EntryFilters): RaceItem[] {
  const q = f.search.trim().toLowerCase();
  return items.filter((item) => {
    if (q) {
      const haystack = [
        item.breederName,
        item.bird?.band,
        item.bird?.birdName,
        item.bird?.rfid,
        item.loft,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (f.lost !== "all" && (f.lost === "yes") !== !!item.isLost) return false;
    if (f.loftBasketed !== "all" && (f.loftBasketed === "yes") !== !!item.isLoftBasketed) {
      return false;
    }
    if (f.entryFee !== "all") {
      const paid = !!item.entryFeePaid;
      if ((f.entryFee === "paid") !== paid) return false;
    }
    if (f.loftBasketNo !== "all") {
      if (f.loftBasketNo === "none") {
        if (item.loftBasketNo != null) return false;
      } else if (String(item.loftBasketNo ?? "") !== f.loftBasketNo) {
        return false;
      }
    }
    if (f.raceBasketNo !== "all") {
      if (f.raceBasketNo === "none") {
        if (item.raceBasketNo != null) return false;
      } else if (String(item.raceBasketNo ?? "") !== f.raceBasketNo) {
        return false;
      }
    }
    return true;
  });
}

function SortIcon({
  col,
  sortKey,
  sortDir,
}: {
  col: EntryColumnKey;
  sortKey: EntryColumnKey;
  sortDir: SortDir;
}) {
  if (col !== sortKey) return <ChevronsUpDown className="h-3 w-3 opacity-40" />;
  return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
}

const YesNo = ({ value }: { value: boolean }) => (
  <span className={value ? "font-medium" : "text-muted-foreground"}>{value ? "Yes" : "No"}</span>
);

export function EntriesPane({
  items,
  isPending,
  filters,
  onFiltersChange,
  selectedIds,
  onSelectedChange,
  loftBasketNos,
  raceBasketNos,
  toolbar,
}: {
  items: RaceItem[];
  isPending: boolean;
  filters: EntryFilters;
  onFiltersChange: (f: EntryFilters) => void;
  selectedIds: number[];
  onSelectedChange: (ids: number[]) => void;
  loftBasketNos: number[];
  raceBasketNos: number[];
  toolbar?: React.ReactNode;
}) {
  const [sortKey, setSortKey] = useState<EntryColumnKey>("breeder");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [hidden, setHidden] = useState<Set<EntryColumnKey>>(new Set());

  const visibleColumns = COLUMNS.filter((c) => !hidden.has(c.key));

  const handleSort = (key: EntryColumnKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => applyEntryFilters(items, filters), [items, filters]);

  const rows = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => {
      const av = cellValue(a, sortKey);
      const bv = cellValue(b, sortKey);
      // HayLoft's nullsLast ordering: an unbasketed bird sorts after basketed ones.
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [filtered, sortKey, sortDir]);

  // Footer totals are over the whole race, not the filtered view — the operator
  // needs to know how many birds are still out regardless of what is on screen.
  const totalBirds = items.length;
  const loftBasketedTotal = items.filter((i) => i.isLoftBasketed).length;
  const raceBasketedTotal = items.filter((i) => i.raceBasketNo != null).length;
  const unpaidCount = items.filter((i) => !i.entryFeePaid).length;

  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.includes(r.id));
  const toggleAll = () => {
    if (allSelected) {
      const visible = new Set(rows.map((r) => r.id));
      onSelectedChange(selectedIds.filter((id) => !visible.has(id)));
    } else {
      onSelectedChange([...new Set([...selectedIds, ...rows.map((r) => r.id)])]);
    }
  };
  const toggleOne = (id: number) => {
    onSelectedChange(
      selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]
    );
  };

  const activeFilters = entryFilterCount(filters);

  return (
    <div className="flex flex-col min-h-0 h-full border rounded-lg overflow-hidden bg-card">
      {/* birdsCaprionP — the pane caption */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/40 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Entries</span>
          <Badge variant="secondary" className="tabular-nums">
            {activeFilters > 0 ? `${rows.length} / ${totalBirds}` : totalBirds}
          </Badge>
          {selectedIds.length > 0 && (
            <Badge variant="outline" className="tabular-nums">
              {selectedIds.length} selected
            </Badge>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
              <Columns3 className="h-3.5 w-3.5" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {COLUMNS.map((c) => (
              <DropdownMenuCheckboxItem
                key={c.key}
                checked={!hidden.has(c.key)}
                onCheckedChange={(checked) =>
                  setHidden((prev) => {
                    const next = new Set(prev);
                    if (checked) next.delete(c.key);
                    else next.add(c.key);
                    return next;
                  })
                }
              >
                {c.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* BirdsToolBar */}
      {toolbar && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b shrink-0">{toolbar}</div>
      )}

      {/* Filter row — the tree list's filter box, made explicit */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b bg-muted/20 shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={filters.search}
            placeholder="Breeder, band, EID, loft"
            className="h-7 w-56 pl-7 text-xs"
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          />
        </div>

        <FilterSelect
          label="Lost"
          value={filters.lost}
          onChange={(v) => onFiltersChange({ ...filters, lost: v as TriState })}
          options={[
            { value: "all", label: "Lost: All" },
            { value: "no", label: "Lost: No" },
            { value: "yes", label: "Lost: Yes" },
          ]}
        />

        <FilterSelect
          label="Loft basketed"
          value={filters.loftBasketed}
          onChange={(v) => onFiltersChange({ ...filters, loftBasketed: v as TriState })}
          options={[
            { value: "all", label: "Loft basketed: All" },
            { value: "yes", label: "Loft basketed: Yes" },
            { value: "no", label: "Loft basketed: No" },
          ]}
        />

        <FilterSelect
          label="Loft basket"
          value={filters.loftBasketNo}
          onChange={(v) => onFiltersChange({ ...filters, loftBasketNo: v })}
          options={[
            { value: "all", label: "Loft basket: All" },
            { value: "none", label: "Loft basket: None" },
            ...loftBasketNos.map((n) => ({ value: String(n), label: `Loft basket ${n}` })),
          ]}
        />

        <FilterSelect
          label="Race basket"
          value={filters.raceBasketNo}
          onChange={(v) => onFiltersChange({ ...filters, raceBasketNo: v })}
          options={[
            { value: "all", label: "Race basket: All" },
            { value: "none", label: "Race basket: None" },
            ...raceBasketNos.map((n) => ({ value: String(n), label: `Race basket ${n}` })),
          ]}
        />

        <FilterSelect
          label="Entry fee"
          value={filters.entryFee}
          onChange={(v) => onFiltersChange({ ...filters, entryFee: v as "all" | "paid" | "unpaid" })}
          options={[
            { value: "all", label: "Entry fee: All" },
            { value: "paid", label: "Entry fee: Paid" },
            { value: "unpaid", label: "Entry fee: Not paid" },
          ]}
        />

        {activeFilters > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => onFiltersChange(EMPTY_ENTRY_FILTERS)}
          >
            <FilterX className="h-3.5 w-3.5" />
            Clear ({activeFilters})
          </Button>
        )}
      </div>

      {/* itemsG */}
      <div className="flex-1 min-h-0 overflow-auto">
        {isPending ? (
          <div className="p-3 space-y-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted text-muted-foreground z-10">
              <tr>
                <th className="w-8 px-2 py-1.5">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all entries"
                  />
                </th>
                {visibleColumns.map((c) => (
                  <th
                    key={c.key}
                    className={`px-2 py-1.5 font-bold whitespace-nowrap ${c.width ?? ""} ${
                      c.align === "right"
                        ? "text-right"
                        : c.align === "center"
                        ? "text-center"
                        : "text-left"
                    }`}
                  >
                    <button
                      className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${
                        c.align === "right" ? "flex-row-reverse" : ""
                      }`}
                      onClick={() => handleSort(c.key)}
                    >
                      {c.label}
                      <SortIcon col={c.key} sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleColumns.length + 1}
                    className="px-3 py-8 text-center text-muted-foreground"
                  >
                    {totalBirds === 0 ? "No birds in this race" : "No entries match the filters"}
                  </td>
                </tr>
              ) : (
                rows.map((item, i) => {
                  const unpaid = !item.entryFeePaid;
                  const selected = selectedIds.includes(item.id);
                  return (
                    <tr
                      key={item.id}
                      onClick={() => toggleOne(item.id)}
                      className={`cursor-pointer ${
                        selected
                          ? "bg-primary/10 font-medium"
                          : unpaid
                          ? "bg-red-50 hover:bg-red-100/70"
                          : i % 2 === 1
                          ? "bg-muted/30 hover:bg-muted/60"
                          : "hover:bg-muted/40"
                      }`}
                    >
                      <td className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected}
                          onCheckedChange={() => toggleOne(item.id)}
                          aria-label={`Select ${item.bird?.band ?? item.id}`}
                        />
                      </td>
                      {visibleColumns.map((c) => (
                        <td
                          key={c.key}
                          className={`px-2 py-1 whitespace-nowrap ${
                            c.align === "right"
                              ? "text-right tabular-nums"
                              : c.align === "center"
                              ? "text-center"
                              : ""
                          }`}
                        >
                          {renderCell(item, c.key)}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* totalP — notPaidP legend plus the three totals */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-3 py-2 border-t bg-muted/40 text-xs shrink-0">
        {unpaidCount > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm bg-red-100 border border-red-300" />
            <span className="text-muted-foreground">
              Entry fee not paid <strong className="text-foreground tabular-nums">{unpaidCount}</strong>
            </span>
          </span>
        )}
        <span className="ml-auto font-bold text-muted-foreground">Totals</span>
        <span className="text-muted-foreground">
          Total birds <strong className="text-foreground tabular-nums ml-0.5">{totalBirds}</strong>
        </span>
        <span className="text-muted-foreground">
          Loft basketed birds{" "}
          <strong className="text-foreground tabular-nums ml-0.5">{loftBasketedTotal}</strong>
        </span>
        <span className="text-muted-foreground">
          Race basketed birds{" "}
          <strong className="text-foreground tabular-nums ml-0.5">{raceBasketedTotal}</strong>
        </span>
      </div>
    </div>
  );
}

function renderCell(item: RaceItem, key: EntryColumnKey) {
  switch (key) {
    case "breeder":
      return <span className="font-semibold">{item.breederName ?? "—"}</span>;
    case "band":
      return <span className="font-mono font-semibold">{item.bird?.band ?? "—"}</span>;
    case "eid":
      return <span className="font-mono">{item.bird?.rfid ?? "—"}</span>;
    case "color":
      return item.bird?.color ?? "—";
    case "lost":
      return item.isLost ? (
        <Badge variant="destructive" className="text-[10px] px-1 py-0">Yes</Badge>
      ) : (
        <span className="text-muted-foreground">No</span>
      );
    case "loftBasket":
      return item.loftBasketNo ?? <span className="text-muted-foreground">—</span>;
    case "loftBasketed":
      return <YesNo value={!!item.isLoftBasketed} />;
    case "raceBasket":
      return item.raceBasketNo ?? <span className="text-muted-foreground">—</span>;
    case "raceBasketTime":
      return item.raceBasketTime ? (
        new Date(item.raceBasketTime).toLocaleString([], {
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    case "pullings":
      return item.pullingCount ?? 0;
  }
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        className={`h-7 text-xs w-auto min-w-[9rem] ${
          value !== "all" ? "border-primary text-primary" : ""
        }`}
        aria-label={label}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-xs">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Column captions and extractors, reused by the grid exports. */
export const ENTRY_EXPORT_COLUMNS = COLUMNS.map((c) => ({
  key: c.key,
  label: c.label,
  value: (item: RaceItem) => {
    const v = cellValue(item, c.key);
    if (c.key === "lost" || c.key === "loftBasketed") return v ? "Yes" : "No";
    if (c.key === "raceBasketTime" && v) return new Date(String(v)).toLocaleString();
    return v ?? "";
  },
}));
