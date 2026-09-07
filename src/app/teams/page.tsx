"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
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
import { Plus, Pencil, Trash2, Users, Bird, Search, Calendar } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { useApiQuery } from "@/hooks/useApi";
import { useApiMutation } from "@/hooks/useApiMutation";
import { apiEndpoints } from "@/lib/endpoints";

interface TeamBird {
  id: number;
  band: string;
  name: string | null;
  note: string | null;
  status: string | null;
  position: number | null;
  vaccinated: boolean;
  color?: string | null;
  sex?: string | null;
  eventId?: number | null;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  REGISTERED:     { label: "Inventory",       className: "bg-gray-100 text-gray-600" },
  LOFT_BASKETED:  { label: "In Loft Basket",  className: "bg-blue-100 text-blue-700" },
  IN_RACE_BASKET: { label: "In Race Basket",  className: "bg-purple-100 text-purple-700" },
  RELEASED:       { label: "Flying",          className: "bg-amber-100 text-amber-700" },
  ARRIVED:        { label: "Arrived",         className: "bg-green-100 text-green-700" },
  FOREIGN_BIRD:   { label: "Did Not Finish",  className: "bg-red-100 text-red-700" },
};

interface TeamEvent {
  id: number;
  name: string;
}

interface Team {
  id: number;
  name: string;
  breederId: number;
  birdCount?: number;
  birds?: TeamBird[];
  events?: TeamEvent[];
  races?: string[];
}

export default function TeamsPage() {
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [teamName, setTeamName] = useState("");
  const [selected, setSelected] = useState<{ teamId: number; eventId: number } | null>(null);
  const [search, setSearch] = useState("");
  const [filterSex, setFilterSex] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  // inline cell editing: key = `${birdId}-name` | `${birdId}-note`
  const [editing, setEditing] = useState<{ key: string; value: string } | null>(null);
  const savingRef = useRef(false);

  const { data, isPending, refetch } = useApiQuery({
    endpoint: apiEndpoints.breeder.teams,
    queryKey: ["breeder", "teams"],
    enabled: !!session?.user,
  });

  const createMutation = useApiMutation({
    endpoint: apiEndpoints.breeder.teams,
    method: "POST",
    queryKey: ["breeder", "teams"],
    onSuccess: () => {
      toast.success("Team created");
      closeDialog();
      refetch();
    },
    onError: () => toast.error("Failed to create team"),
  });

  const updateMutation = useApiMutation({
    endpoint: apiEndpoints.breeder.teams,
    method: "PUT",
    queryKey: ["breeder", "teams"],
    onSuccess: () => {
      toast.success("Team updated");
      closeDialog();
      refetch();
    },
    onError: () => toast.error("Failed to update team"),
  });

  const deleteMutation = useApiMutation({
    endpoint: apiEndpoints.breeder.teams,
    method: "DELETE",
    queryKey: ["breeder", "teams"],
    onSuccess: () => {
      toast.success("Team deleted");
      refetch();
    },
    onError: () => toast.error("Failed to delete team"),
  });

  const teams: Team[] = data?.teams || [];

  // Auto-select first team + first event on load
  const defaultSel = teams.length > 0 && (teams[0].events?.length ?? 0) > 0
    ? { teamId: teams[0].id, eventId: teams[0].events![0].id }
    : teams.length > 0 ? { teamId: teams[0].id, eventId: -1 } : null;
  const activeTeamId = selected?.teamId ?? defaultSel?.teamId ?? null;
  const activeEventId = selected?.eventId ?? defaultSel?.eventId ?? null;
  const selectedTeam = teams.find((t) => t.id === activeTeamId) ?? null;
  const selectedEvent = selectedTeam?.events?.find((e) => e.id === activeEventId) ?? null;

  const filteredBirds = (selectedTeam?.birds ?? []).filter((b) => {
    if (activeEventId !== -1 && b.eventId !== activeEventId) return false;
    if (filterSex !== "all" && (b.sex ?? "Unknown") !== filterSex) return false;
    if (filterStatus !== "all" && (b.status ?? "") !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!b.band.toLowerCase().includes(q) && !(b.name ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const saveBirdField = async (birdId: number, field: "name" | "note", value: string) => {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      const res = await fetch(`/api/breeder/birds/${birdId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(field === "name" ? { name: value } : { note: value }),
      });
      if (!res.ok) throw new Error();
      refetch();
    } catch {
      toast.error(`Failed to save ${field}`);
    } finally {
      savingRef.current = false;
      setEditing(null);
    }
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingTeam(null);
    setTeamName("");
  };

  const openAdd = () => {
    setEditingTeam(null);
    setTeamName("");
    setDialogOpen(true);
  };

  const openEdit = (team: Team, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTeam(team);
    setTeamName(team.name);
    setDialogOpen(true);
  };

  const handleDelete = async (team: Team, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete team "${team.name}"?`)) return;
    await deleteMutation.mutateAsync({ teamId: team.id });
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!teamName.trim()) { toast.error("Team name is required"); return; }
    if (editingTeam) {
      await updateMutation.mutateAsync({ teamId: editingTeam.id, name: teamName.trim() });
    } else {
      await createMutation.mutateAsync({ name: teamName.trim() });
    }
  };

  if (sessionLoading) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="flex gap-4">
          <Skeleton className="h-64 w-64" />
          <Skeleton className="h-64 flex-1" />
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-muted-foreground">Please log in to manage your teams.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Teams</h1>
          <p className="text-sm text-muted-foreground">Your teams and their registered birds.</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Add Team
        </Button>
      </div>

      {isPending ? (
        <div className="flex gap-4">
          <Skeleton className="h-64 w-64 shrink-0" />
          <Skeleton className="h-64 flex-1" />
        </div>
      ) : teams.length === 0 ? (
        <div className="rounded-lg border py-16 text-center">
          <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No teams yet. Create your first team.</p>
        </div>
      ) : (
        <div className="flex gap-4 items-start">
          {/* Left panel — team list */}
          <div className="w-64 shrink-0 rounded-lg border bg-card shadow-sm overflow-hidden">
            {/* ponytail: static header, teams don't have a parent "loft" entity in schema */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4 text-muted-foreground" />
                Teams
              </div>
            </div>
            <div className="divide-y">
              {teams.map((team) => {
                const birdCount = team.birdCount ?? team.birds?.length ?? 0;
                const events = team.events ?? [];
                return (
                  <div key={team.id}>
                    {/* Team header row */}
                    <div className="group flex items-center gap-2 px-4 py-2.5 bg-muted/30">
                      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <span className="text-sm font-semibold flex-1 truncate">{team.name}</span>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => openEdit(team, e)} className="p-1 rounded hover:bg-muted text-muted-foreground">
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button onClick={(e) => handleDelete(team, e)} className="p-1 rounded hover:bg-muted text-red-400">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    {/* Event sub-rows */}
                    {events.length === 0 ? (
                      <div className="pl-10 pr-4 py-2 text-xs text-muted-foreground">
                        No events registered
                      </div>
                    ) : (
                      events.map((ev) => {
                        const isSelected = activeTeamId === team.id && activeEventId === ev.id;
                        const evBirdCount = (team.birds ?? []).filter((b) => b.eventId === ev.id).length;
                        return (
                          <div
                            key={ev.id}
                            onClick={() => setSelected({ teamId: team.id, eventId: ev.id })}
                            className={`flex items-center gap-2 pl-10 pr-4 py-2.5 cursor-pointer transition-colors ${
                              isSelected
                                ? "bg-primary/5 border-l-2 border-l-primary"
                                : "hover:bg-muted/40"
                            }`}
                          >
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-medium truncate">{ev.name}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {evBirdCount} bird{evBirdCount !== 1 ? "s" : ""}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right panel — bird table */}
          {selectedTeam && (
            <div className="flex-1 rounded-lg border bg-card shadow-sm overflow-hidden">
              {/* Table header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b flex-wrap">
                <div className="relative w-48">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search band or name"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
                <select
                  value={filterSex}
                  onChange={(e) => setFilterSex(e.target.value)}
                  className="h-8 rounded-md border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="all">All Sexes</option>
                  <option value="Cock">Cock</option>
                  <option value="Hen">Hen</option>
                </select>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="h-8 rounded-md border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="all">All Statuses</option>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
                <span className="text-sm font-semibold ml-auto">
                  {selectedTeam.name}{selectedEvent ? ` — ${selectedEvent.name}` : ""} · Birds
                </span>
              </div>

              {/* Table */}
              {filteredBirds.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  {search ? "No birds match your search." : "No birds in this team."}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                      <th className="px-4 py-2 text-left w-8">#</th>
                      <th className="px-4 py-2 text-left">Bird Band ID</th>
                      <th className="px-4 py-2 text-left">Sex</th>
                      <th className="px-4 py-2 text-left">Color</th>
                      <th className="px-4 py-2 text-left">Name</th>
                      <th className="px-4 py-2 text-left">Note</th>
                      <th className="px-4 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredBirds.map((bird, idx) => {
                      const sc = bird.status ? STATUS_CONFIG[bird.status] : null;
                      const nameKey = `${bird.id}-name`;
                      const noteKey = `${bird.id}-note`;
                      return (
                        <tr key={bird.id} className="hover:bg-muted/20 transition-colors group/row">
                          <td className="px-4 py-2 text-muted-foreground">{idx + 1}</td>
                          <td className="px-4 py-2 font-mono text-primary font-medium">
                            {bird.band}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {bird.sex ?? "—"}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {bird.color ?? "—"}
                          </td>
                          {/* Inline-editable Name */}
                          <td className="px-4 py-2">
                            {editing?.key === nameKey ? (
                              <input
                                autoFocus
                                className="w-full border rounded px-1.5 py-0.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                                value={editing.value}
                                onChange={(e) => setEditing({ key: nameKey, value: e.target.value })}
                                onBlur={() => saveBirdField(bird.id, "name", editing.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveBirdField(bird.id, "name", editing.value);
                                  if (e.key === "Escape") setEditing(null);
                                }}
                              />
                            ) : (
                              <div className="flex items-center gap-1 group/cell">
                                <span className={bird.name ? "" : "text-muted-foreground"}>
                                  {bird.name ?? "—"}
                                </span>
                                <button
                                  onClick={() => setEditing({ key: nameKey, value: bird.name ?? "" })}
                                  className="opacity-0 group-hover/row:opacity-100 p-0.5 rounded hover:bg-muted text-muted-foreground transition-opacity"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </td>
                          {/* Inline-editable Note */}
                          <td className="px-4 py-2 max-w-[200px]">
                            {editing?.key === noteKey ? (
                              <input
                                autoFocus
                                className="w-full border rounded px-1.5 py-0.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                                value={editing.value}
                                onChange={(e) => setEditing({ key: noteKey, value: e.target.value })}
                                onBlur={() => saveBirdField(bird.id, "note", editing.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveBirdField(bird.id, "note", editing.value);
                                  if (e.key === "Escape") setEditing(null);
                                }}
                              />
                            ) : (
                              <div className="flex items-center gap-1">
                                <span className={`truncate ${bird.note ? "" : "text-muted-foreground"}`}>
                                  {bird.note ?? "—"}
                                </span>
                                <button
                                  onClick={() => setEditing({ key: noteKey, value: bird.note ?? "" })}
                                  className="opacity-0 group-hover/row:opacity-100 shrink-0 p-0.5 rounded hover:bg-muted text-muted-foreground transition-opacity"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            {sc ? (
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${sc.className}`}>
                                {sc.label}{bird.status === "ARRIVED" && bird.position ? ` #${bird.position}` : ""}
                              </span>
                            ) : bird.vaccinated ? (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                                Vaccinated
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {/* Footer count */}
              <div className="flex justify-end px-4 py-2 border-t text-xs text-muted-foreground">
                1 – {filteredBirds.length} of {filteredBirds.length}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTeam ? "Edit Team" : "Add Team"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="teamName">Team Name</Label>
                <Input
                  id="teamName"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Enter team name"
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingTeam ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
