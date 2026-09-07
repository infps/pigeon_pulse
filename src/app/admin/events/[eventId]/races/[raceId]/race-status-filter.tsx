"use client";

import { useEffect, useState, useCallback } from "react";
import { ListFilter, Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const ALL_STATUSES = [
  { value: "REGISTERED", label: "Registered" },
  { value: "CHECKED_IN", label: "Checked In" },
  { value: "LOFT_BASKETED", label: "Loft Basketed" },
  { value: "RELEASED", label: "Released" },
  { value: "ARRIVED", label: "Arrived" },
  { value: "FOREIGN_BIRD", label: "Foreign Bird" },
] as const;

type StatusValue = (typeof ALL_STATUSES)[number]["value"];

interface Props {
  raceId: string;
  selectedStatuses: string[];
  onSelectedChange: (statuses: string[]) => void;
}

export function RaceStatusFilter({ raceId, selectedStatuses, onSelectedChange }: Props) {
  const [visibility, setVisibility] = useState<Record<StatusValue, boolean>>(
    () => Object.fromEntries(ALL_STATUSES.map((s) => [s.value, true])) as Record<StatusValue, boolean>
  );

  useEffect(() => {
    fetch(`/api/admin/race/${raceId}/status-visibility`)
      .then((r) => r.json())
      .then((data: { visibility: { status: StatusValue; visible: boolean }[] }) => {
        const map = Object.fromEntries(data.visibility.map((v) => [v.status, v.visible]));
        setVisibility(map as Record<StatusValue, boolean>);
      })
      .catch(() => {});
  }, [raceId]);

  const toggleFilter = useCallback(
    (value: string) => {
      const next = selectedStatuses.includes(value)
        ? selectedStatuses.filter((v) => v !== value)
        : [...selectedStatuses, value];
      onSelectedChange(next);
    },
    [selectedStatuses, onSelectedChange]
  );

  const toggleVisibility = useCallback(
    async (status: StatusValue) => {
      const newVisible = !visibility[status];
      setVisibility((prev) => ({ ...prev, [status]: newVisible }));
      try {
        await fetch(`/api/admin/race/${raceId}/status-visibility`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, visible: newVisible }),
        });
      } catch {
        setVisibility((prev) => ({ ...prev, [status]: !newVisible }));
        toast.error("Failed to update visibility");
      }
    },
    [raceId, visibility]
  );

  const hiddenCount = ALL_STATUSES.filter((s) => !visibility[s.value]).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 border-dashed">
          <ListFilter className="h-3.5 w-3.5" />
          Status
          {selectedStatuses.length > 0 && (
            <Badge variant="secondary" className="ml-1 rounded-sm px-1 font-normal">
              {selectedStatuses.length}
            </Badge>
          )}
          {hiddenCount > 0 && (
            <Badge variant="outline" className="ml-1 rounded-sm px-1 font-normal text-muted-foreground">
              <EyeOff className="h-3 w-3 mr-0.5" />{hiddenCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Status</span>
          <span className="text-xs font-normal text-muted-foreground">Breeder view</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ALL_STATUSES.map((s) => {
          const isFiltered = selectedStatuses.includes(s.value);
          const isVisible = visibility[s.value];
          return (
            <div
              key={s.value}
              className="flex items-center justify-between px-2 py-1.5 rounded-sm hover:bg-accent cursor-default"
            >
              <label className="flex items-center gap-2 flex-1 cursor-pointer">
                <Checkbox
                  checked={isFiltered}
                  onCheckedChange={() => toggleFilter(s.value)}
                />
                <span className="text-sm">{s.label}</span>
              </label>
              <button
                type="button"
                title={isVisible ? "Visible to breeders — click to hide" : "Hidden from breeders — click to show"}
                onClick={() => toggleVisibility(s.value)}
                className="ml-2 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
              >
                {isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-destructive" />}
              </button>
            </div>
          );
        })}
        {selectedStatuses.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1">
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground w-full text-left"
                onClick={() => onSelectedChange([])}
              >
                Clear filter
              </button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
