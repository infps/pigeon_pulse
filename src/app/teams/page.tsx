"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Pencil, Trash2, Users, Bird, Calendar } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { useApiQuery } from "@/hooks/useApi";
import { useApiMutation } from "@/hooks/useApiMutation";
import { apiEndpoints } from "@/lib/endpoints";

interface TeamBird {
  id: number;
  band: string;
  name: string | null;
  status: string | null;
  position: number | null;
  vaccinated: boolean;
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

  const openEdit = (team: Team) => {
    setEditingTeam(team);
    setTeamName(team.name);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) {
      toast.error("Team name is required");
      return;
    }
    if (editingTeam) {
      await updateMutation.mutateAsync({ teamId: editingTeam.id, name: teamName.trim() });
    } else {
      await createMutation.mutateAsync({ name: teamName.trim() });
    }
  };

  const handleDelete = async (team: Team) => {
    if (!confirm(`Delete team "${team.name}"?`)) return;
    await deleteMutation.mutateAsync({ teamId: team.id });
  };

  if (sessionLoading) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Not Logged In</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Please log in to manage your teams.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Teams</h1>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Add Team
        </Button>
      </div>

      {isPending ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : teams.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No teams yet. Create your first team.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => (
            <Card key={team.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{team.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(team)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(team)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">
                    Registered Events
                  </div>
                  {team.events && team.events.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {team.events.map((ev) => (
                        <Link key={ev.id} href={`/events/${ev.id}`}>
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary hover:bg-primary/20">
                            <Calendar className="h-3 w-3" />
                            {ev.name}
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Not registered to any event
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Bird className="h-4 w-4" />
                    <span>
                      Birds ({team.birdCount ?? team.birds?.length ?? 0})
                    </span>
                  </div>
                  {team.birds && team.birds.length > 0 ? (
                    <div className="max-h-40 space-y-0.5 overflow-y-auto pr-1">
                      {team.birds.map((b) => {
                        const sc = b.status ? STATUS_CONFIG[b.status] : null;
                        return (
                          <div
                            key={b.id}
                            className="flex items-center justify-between rounded px-1.5 py-1 text-xs"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-mono shrink-0">{b.band}</span>
                              {b.name && (
                                <span className="truncate text-muted-foreground">{b.name}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 ml-2 shrink-0">
                              {b.vaccinated && (
                                <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                                  Vaccinated
                                </span>
                              )}
                              {sc && (
                                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${sc.className}`}>
                                  {sc.label}{b.status === "ARRIVED" && b.position ? ` #${b.position}` : ""}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      No birds in this team
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
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
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingTeam ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
