"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Switch } from "@/components/ui/switch";
import {
  Pencil,
  Trash2,
  Plus,
  RefreshCw,
  Download,
  Trophy,
  Search,
} from "lucide-react";
import { useSeasonContext } from "@/lib/season-context";
import {
  useListAverageConfigs,
  useAverageResults,
  useCreateAverageConfig,
  usePatchAverageConfig,
  useDeleteAverageConfig,
} from "@/lib/api/averages";
import { useListRaceTypes } from "@/lib/api/race-types";
import { useListRaces } from "@/lib/api/races";
import { useApiMutation } from "@/hooks/useApiMutation";
import { apiEndpoints } from "@/lib/endpoints";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SEX_LABELS } from "@/lib/bird-constants";

type FilterMode = "ALL" | "BY_TYPE" | "MANUAL" | "COMBINATION";

interface AverageConfig {
  id: number;
  name: string;
  filterMode: FilterMode;
  isPublic: boolean;
  selectedRaceTypes: { raceType: { id: number; name: string } }[];
  selectedRaces: { race: { id: number; name: string } }[];
}

interface AverageResultRow {
  rank: number | null;
  birdId: number;
  band: string;
  color: string | null;
  sex: number | null;
  loft: string | null;
  breederName: string;
  racesFlown: number;
  avgSpeedYPM: number | null;
}

const FILTER_MODE_LABELS: Record<FilterMode, string> = {
  ALL: "All Races",
  BY_TYPE: "By Type",
  MANUAL: "Manual",
  COMBINATION: "Combination",
};

const FILTER_MODE_COLORS: Record<FilterMode, string> = {
  ALL: "bg-blue-100 text-blue-700",
  BY_TYPE: "bg-purple-100 text-purple-700",
  MANUAL: "bg-orange-100 text-orange-700",
  COMBINATION: "bg-green-100 text-green-700",
};

// ── Config form dialog ──────────────────────────────────────────────────────

interface ConfigFormProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  eventId: string;
  seasonId: number;
  editing: AverageConfig | null;
  onSaved: () => void;
}

function ConfigFormDialog({ open, onOpenChange, eventId, seasonId, editing, onSaved }: ConfigFormProps) {
  const isEdit = !!editing;

  const [name, setName] = useState(editing?.name ?? "");
  const [filterMode, setFilterMode] = useState<FilterMode>(editing?.filterMode ?? "ALL");
  const [isPublic, setIsPublic] = useState(editing?.isPublic ?? false);
  const [selectedTypeIds, setSelectedTypeIds] = useState<number[]>(
    editing?.selectedRaceTypes.map((r) => r.raceType.id) ?? []
  );
  const [selectedRaceIds, setSelectedRaceIds] = useState<number[]>(
    editing?.selectedRaces.map((r) => r.race.id) ?? []
  );

  // Reset form when dialog opens with new data
  const resetTo = (cfg: AverageConfig | null) => {
    setName(cfg?.name ?? "");
    setFilterMode(cfg?.filterMode ?? "ALL");
    setIsPublic(cfg?.isPublic ?? false);
    setSelectedTypeIds(cfg?.selectedRaceTypes.map((r) => r.raceType.id) ?? []);
    setSelectedRaceIds(cfg?.selectedRaces.map((r) => r.race.id) ?? []);
  };

  const { data: raceTypesData } = useListRaceTypes();
  const { data: racesData } = useListRaces({ params: { seasonId: String(seasonId) } });
  // races filtered to this season only via seasonId param (admin race route now supports explicit seasonId)

  const raceTypes: { id: number; name: string }[] = raceTypesData?.raceTypes ?? [];
  const races: { id: number; name: string }[] = racesData?.races ?? [];

  const createMutation = useCreateAverageConfig(eventId);
  const patchMutation = usePatchAverageConfig(eventId, editing?.id ?? null);

  const needsTypes = filterMode === "BY_TYPE" || filterMode === "COMBINATION";
  const needsRaces = filterMode === "MANUAL" || filterMode === "COMBINATION";

  const toggleId = (list: number[], id: number): number[] =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Name required"); return; }
    const body = {
      name: name.trim(),
      filterMode,
      isPublic,
      seasonId,
      raceTypeIds: needsTypes ? selectedTypeIds : [],
      raceIds: needsRaces ? selectedRaceIds : [],
    };
    try {
      if (isEdit) {
        await patchMutation.mutateAsync(body);
      } else {
        await createMutation.mutateAsync(body);
      }
      toast.success(isEdit ? "Average updated" : "Average created");
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error("Failed to save");
    }
  };

  const isPending = createMutation.isPending || patchMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetTo(editing); onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Average" : "New Average"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. All-Race Average" />
          </div>

          <div className="space-y-1">
            <Label>Filter Mode</Label>
            <Select value={filterMode} onValueChange={(v) => setFilterMode(v as FilterMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["ALL", "BY_TYPE", "MANUAL", "COMBINATION"] as FilterMode[]).map((m) => (
                  <SelectItem key={m} value={m}>{FILTER_MODE_LABELS[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsTypes && (
            <div className="space-y-1">
              <Label>Race Types</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {raceTypes.map((rt) => (
                  <button
                    key={rt.id}
                    type="button"
                    onClick={() => setSelectedTypeIds((p) => toggleId(p, rt.id))}
                    className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                      selectedTypeIds.includes(rt.id)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border hover:bg-muted"
                    }`}
                  >
                    {rt.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {needsRaces && (
            <div className="space-y-1">
              <Label>Races</Label>
              <div className="flex flex-col gap-1 max-h-48 overflow-y-auto mt-1 border rounded-md p-2">
                {races.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-2">No races found for this season</p>
                ) : races.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 px-2 py-1 rounded">
                    <input
                      type="checkbox"
                      checked={selectedRaceIds.includes(r.id)}
                      onChange={() => setSelectedRaceIds((p) => toggleId(p, r.id))}
                      className="h-4 w-4 accent-primary"
                    />
                    {r.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Switch
              id="isPublic"
              checked={isPublic}
              onCheckedChange={setIsPublic}
            />
            <Label htmlFor="isPublic">Public (visible to breeders)</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main tab ─────────────────────────────────────────────────────────────────

export function AveragesTab({ eventId }: { eventId: string }) {
  const { selectedSeasonId } = useSeasonContext();
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<AverageConfig | null>(null);
  const [selectedAvgId, setSelectedAvgId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const { data: configsData, isPending: configsLoading, refetch: refetchConfigs } =
    useListAverageConfigs(eventId, selectedSeasonId);

  const configs: AverageConfig[] = configsData ?? [];

  // Auto-select first config when list loads
  const firstConfigId = configs[0]?.id ?? null;
  const activeAvgId = selectedAvgId ?? firstConfigId;

  const { data: resultsData, isPending: resultsLoading, refetch: refetchResults } =
    useAverageResults(eventId, activeAvgId, selectedSeasonId);

  const results: AverageResultRow[] = resultsData?.results ?? [];

  // Per-item mutations (need dynamic endpoint)
  const togglePublicMutation = useApiMutation({
    method: "PATCH",
    endpoint: "", // set per-call via body — overridden below
    queryKey: ["averages", "list", eventId],
    exact: false,
    onSuccess: () => refetchConfigs(),
  });

  const deleteMutation = useApiMutation({
    method: "DELETE",
    endpoint: "",
    queryKey: ["averages", "list", eventId],
    exact: false,
    onSuccess: () => {
      refetchConfigs();
      if (activeAvgId === selectedAvgId) setSelectedAvgId(null);
    },
  });

  const handleTogglePublic = async (cfg: AverageConfig) => {
    try {
      const res = await fetch(apiEndpoints.averages.byId(eventId, cfg.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isPublic: !cfg.isPublic }),
      });
      if (!res.ok) throw new Error();
      toast.success(cfg.isPublic ? "Made private" : "Made public");
      refetchConfigs();
      queryClient.invalidateQueries({ queryKey: ["averages", "list", eventId], exact: false });
    } catch {
      toast.error("Failed to update");
    }
  };

  const handleDelete = async (cfg: AverageConfig) => {
    if (!confirm(`Delete "${cfg.name}"?`)) return;
    try {
      const res = await fetch(apiEndpoints.averages.byId(eventId, cfg.id), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      toast.success("Deleted");
      if (activeAvgId === cfg.id) setSelectedAvgId(null);
      refetchConfigs();
      queryClient.invalidateQueries({ queryKey: ["averages", "list", eventId], exact: false });
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleEdit = (cfg: AverageConfig) => {
    setEditingConfig(cfg);
    setFormOpen(true);
  };

  const handleNew = () => {
    setEditingConfig(null);
    setFormOpen(true);
  };

  // Filter results by search
  const filteredResults = useMemo(() => {
    if (!search.trim()) return results;
    const q = search.toLowerCase();
    return results.filter(
      (r) =>
        r.loft?.toLowerCase().includes(q) ||
        r.breederName?.toLowerCase().includes(q) ||
        r.band?.toLowerCase().includes(q)
    );
  }, [results, search]);

  const exportCsv = () => {
    const header = "Rank,Loft,Band,Sex,Color,Races Flown,Avg Speed (YPM)";
    const rows = filteredResults.map((r) =>
      [
        r.rank ?? "DNP",
        r.loft ?? r.breederName,
        r.band,
        SEX_LABELS[r.sex as keyof typeof SEX_LABELS] ?? "",
        r.color ?? "",
        r.racesFlown,
        r.avgSpeedYPM != null ? r.avgSpeedYPM.toFixed(4) : "",
      ].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `average-${activeAvgId}-results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!selectedSeasonId) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        Select a season to view averages.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left — Config Manager */}
      <Card className="lg:col-span-1">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Average Configs</CardTitle>
            <Button size="sm" onClick={handleNew}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              New
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 p-3">
          {configsLoading ? (
            [...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)
          ) : configs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No averages yet. Create one.
            </p>
          ) : (
            configs.map((cfg) => (
              <div
                key={cfg.id}
                onClick={() => setSelectedAvgId(cfg.id)}
                className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                  activeAvgId === cfg.id
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{cfg.name}</p>
                    <span
                      className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 ${
                        FILTER_MODE_COLORS[cfg.filterMode]
                      }`}
                    >
                      {FILTER_MODE_LABELS[cfg.filterMode]}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <div onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={cfg.isPublic}
                        onCheckedChange={() => handleTogglePublic(cfg)}
                        className="scale-75"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={(e) => { e.stopPropagation(); handleEdit(cfg); }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={(e) => { e.stopPropagation(); handleDelete(cfg); }}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {!cfg.isPublic && (
                  <Badge variant="outline" className="text-[10px] mt-1">Private</Badge>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Right — Results */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Results</CardTitle>
              {activeAvgId && (
                <span className="text-sm text-muted-foreground">
                  — {configs.find((c) => c.id === activeAvgId)?.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchResults()}
                disabled={!activeAvgId}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportCsv}
                disabled={!activeAvgId || results.length === 0}
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* Search */}
          {results.length > 0 && (
            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by loft or band…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {!activeAvgId ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              Select an average config to view results.
            </div>
          ) : resultsLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              No results found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b text-xs uppercase text-muted-foreground">
                    <th className="px-4 py-3 text-left w-12">Rank</th>
                    <th className="px-4 py-3 text-left">Loft · Band · Sex · Color</th>
                    <th className="px-4 py-3 text-right">Races</th>
                    <th className="px-4 py-3 text-right">Avg Speed (YPM)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredResults.map((row, i) => {
                    const isDNP = row.avgSpeedYPM === null;
                    return (
                      <tr
                        key={row.birdId}
                        className={`hover:bg-muted/30 transition-colors ${
                          isDNP ? "opacity-50" : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          {isDNP ? (
                            <span className="text-muted-foreground">—</span>
                          ) : row.rank === 1 ? (
                            <Trophy className="h-4 w-4 text-yellow-500" />
                          ) : row.rank === 2 ? (
                            <Trophy className="h-4 w-4 text-slate-400" />
                          ) : row.rank === 3 ? (
                            <Trophy className="h-4 w-4 text-amber-600" />
                          ) : (
                            <span className="font-medium tabular-nums">{row.rank}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{row.loft ?? row.breederName}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {row.band}
                            {row.sex != null && (
                              <span className="ml-2">{SEX_LABELS[row.sex as keyof typeof SEX_LABELS]}</span>
                            )}
                            {row.color && <span className="ml-2">{row.color}</span>}
                          </p>
                          {isDNP && (
                            <span className="text-xs text-muted-foreground italic">Did Not Participate</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.racesFlown}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">
                          {row.avgSpeedYPM != null ? row.avgSpeedYPM.toFixed(4) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form dialog */}
      {formOpen && selectedSeasonId && (
        <ConfigFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          eventId={eventId}
          seasonId={selectedSeasonId}
          editing={editingConfig}
          onSaved={refetchConfigs}
        />
      )}
    </div>
  );
}
