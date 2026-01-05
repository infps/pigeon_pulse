"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  useCreateUser,
  useDeleteUser,
  useListUsers,
  useUpdateUser,
} from "@/lib/api/users";
import { useListEvents } from "@/lib/api/events";
import {
  useCreateTeam,
  useDeleteTeam,
  useListTeams,
  useUpdateTeam,
} from "@/lib/api/teams";
import { DataTable } from "@/components/ui/data-table";
import { createColumns } from "./columns";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AddEditBreederDialog } from "@/components/add-edit-breeder-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import type { Event, User, UserRole, UserStatus } from "@/lib/types";

export default function UsersPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [isTeamsDialogOpen, setIsTeamsDialogOpen] = useState(false);
  const [selectedBreeder, setSelectedBreeder] = useState<User | null>(null);
  const [teamFormData, setTeamFormData] = useState({
    name: "",
  });
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [isAddTeamDialogOpen, setIsAddTeamDialogOpen] = useState(false);

  const { data: eventsData } = useListEvents({});
  const events: Event[] = eventsData?.events || [];

  const { data: usersData, isPending, isError } = useListUsers({
    params: eventFilter !== "all" ? { eventId: eventFilter } : {},
  });
  const users: User[] = usersData?.users || [];

  // Filter users by status
  const filteredUsers = statusFilter === "all" 
    ? users 
    : users.filter(user => user.status === statusFilter);

  const createMutation = useCreateUser({});
  const updateMutation = useUpdateUser({});
  const deleteMutation = useDeleteUser({});

  const { data: teamsData } = useListTeams({
    params: selectedBreeder ? { breederId: selectedBreeder.id } : undefined,
  });
  const teams = teamsData?.teams || [];

  const createTeamMutation = useCreateTeam({});
  const updateTeamMutation = useUpdateTeam({});
  const deleteTeamMutation = useDeleteTeam({});

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;

    try {
      if (!deleteMutation.mutateAsync) return;
      await deleteMutation.mutateAsync({ id });
      toast.success("User deleted successfully");
    } catch (error) {
      toast.error("Failed to delete user");
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setEditingUser(null);
  };

  const handleViewTeams = (user: User) => {
    setSelectedBreeder(user);
    setIsTeamsDialogOpen(true);
  };

  const handleTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!teamFormData.name.trim()) {
      toast.error("Team name is required");
      return;
    }

    if (!selectedBreeder) {
      toast.error("No breeder selected");
      return;
    }

    try {
      if (editingTeamId) {
        if (!updateTeamMutation.mutateAsync) return;
        await updateTeamMutation.mutateAsync({ 
          teamId: editingTeamId, 
          name: teamFormData.name 
        });
        toast.success("Team updated successfully");
      } else {
        if (!createTeamMutation.mutateAsync) return;
        await createTeamMutation.mutateAsync({
          name: teamFormData.name,
          breederId: selectedBreeder.id,
        });
        toast.success("Team created successfully");
      }
      setTeamFormData({ name: "" });
      setEditingTeamId(null);
    } catch (error) {
      toast.error(editingTeamId ? "Failed to update team" : "Failed to create team");
    }
  };

  const handleEditTeam = (teamId: string, teamName: string) => {
    setEditingTeamId(teamId);
    setTeamFormData({ name: teamName });
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm("Are you sure you want to delete this team?")) return;

    try {
      if (!deleteTeamMutation.mutateAsync) return;
      await deleteTeamMutation.mutateAsync({ teamId });
      toast.success("Team deleted successfully");
    } catch (error) {
      toast.error("Failed to delete team");
    }
  };

  const handleCloseTeamsDialog = () => {
    setIsTeamsDialogOpen(false);
    setSelectedBreeder(null);
    setTeamFormData({ name: "" });
    setEditingTeamId(null);
  };

  const handleAddTeamClick = () => {
    setEditingTeamId(null);
    setTeamFormData({ name: "" });
    setIsAddTeamDialogOpen(true);
  };

  const handleAddTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!teamFormData.name.trim()) {
      toast.error("Team name is required");
      return;
    }

    if (!selectedBreeder) {
      toast.error("No breeder selected");
      return;
    }

    try {
      if (!createTeamMutation.mutateAsync) return;
      await createTeamMutation.mutateAsync({
        name: teamFormData.name,
        breederId: selectedBreeder.id,
      });
      toast.success("Team created successfully");
      setIsAddTeamDialogOpen(false);
      setTeamFormData({ name: "" });
    } catch (error) {
      toast.error("Failed to create team");
    }
  };

  const columns = createColumns(handleEdit, handleDelete, handleViewTeams);

  if (isPending) {
    return (
      <div className="p-8">
        <div className="space-y-4">
          <Skeleton className="h-8 w-62.5" />
          <Skeleton className="h-100 w-full" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8">
        <div className="text-red-500">Error loading users</div>
      </div>
    );
  }

  return (
    <div className="p-8 w-full mx-auto">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-4">
          <Select
            value={statusFilter}
            onValueChange={setStatusFilter}
          >
            <SelectTrigger className="w-45">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
              <SelectItem value="PROSPECT">Prospect</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={eventFilter}
            onValueChange={setEventFilter}
          >
            <SelectTrigger className="w-60">
              <SelectValue placeholder="Filter by event" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              {events.map((event) => (
                <SelectItem key={event.eventId} value={event.eventId}>
                  {event.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={() => {
          setEditingUser(null);
          setIsOpen(true);
        }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Breeder
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={filteredUsers}
        filterableColumns={[
          { id: "name", title: "Name" },
          { id: "email", title: "Email" },
          { id: "username", title: "Username" },
          { id: "phoneNumber", title: "Phone" },
        ]}
        />

      <AddEditBreederDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        editingUser={editingUser}
        onSuccess={handleClose}
      />

      <Dialog open={isTeamsDialogOpen} onOpenChange={handleCloseTeamsDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Teams for {selectedBreeder?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={handleAddTeamClick}>
                <Plus className="mr-2 h-4 w-4" />
                Add Team
              </Button>
            </div>

            <div className="border rounded-lg">
              {teams.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No teams found. Add a team to get started.
                </div>
              ) : (
                <div className="divide-y">
                  {teams.map((team: any) => (
                    <div key={team.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                      <div>
                        <p className="font-medium">{team.name}</p>
                        <p className="text-sm text-gray-500">
                          Created {new Date(team.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditTeam(team.id, team.name)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteTeam(team.id)}
                          disabled={deleteTeamMutation.isPending}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Team Dialog */}
      <Dialog open={isAddTeamDialogOpen} onOpenChange={setIsAddTeamDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Team</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddTeamSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="team-name">Team Name *</Label>
              <Input
                id="team-name"
                value={teamFormData.name}
                onChange={(e) => setTeamFormData({ name: e.target.value })}
                placeholder="Enter team name"
                required
              />
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddTeamDialogOpen(false);
                  setTeamFormData({ name: "" });
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createTeamMutation.isPending}>
                {createTeamMutation.isPending ? "Creating..." : "Create Team"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
