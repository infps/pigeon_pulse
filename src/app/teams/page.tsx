"use client";

import { useState } from "react";
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
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { useApiQuery } from "@/hooks/useApi";
import { useApiMutation } from "@/hooks/useApiMutation";
import { apiEndpoints } from "@/lib/endpoints";

interface Team {
  id: number;
  name: string;
  breederId: number;
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
              <CardContent className="p-4 flex items-center justify-between">
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
