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
import { DataTable } from "@/components/ui/data-table";
import { createColumns } from "./columns";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Event, User, UserRole, UserStatus } from "@/lib/types";

export default function UsersPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    lastName: "",
    username: "",
    displayUsername: "",
    country: "",
    state: "",
    city: "",
    address: "",
    postalCode: "",
    phoneNumber: "",
    webAddress: "",
    ssn: "",
    status: "ACTIVE" as UserStatus,
    role: "BREEDER" as UserRole,
    taxNumber: "",
    note: "",
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    if (!editingId && !formData.email.trim()) {
      toast.error("Email is required");
      return;
    }

    if (!editingId && !formData.password.trim()) {
      toast.error("Password is required");
      return;
    }

    try {
      if (editingId) {
        if (!updateMutation.mutateAsync) return;
        const { email, password, ...updateData } = formData;
        await updateMutation.mutateAsync({ id: editingId, ...updateData });
        toast.success("User updated successfully");
      } else {
        if (!createMutation.mutateAsync) return;
        await createMutation.mutateAsync(formData);
        toast.success("User created successfully");
      }
      handleClose();
    } catch (error) {
      toast.error(editingId ? "Failed to update user" : "Failed to create user");
    }
  };

  const handleEdit = (user: User) => {
    setEditingId(user.id);
    setFormData({
      email: user.email,
      password: "",
      name: user.name,
      lastName: user.lastName || "",
      username: user.username || "",
      displayUsername: user.displayUsername || "",
      country: user.country || "",
      state: user.state || "",
      city: user.city || "",
      address: user.address || "",
      postalCode: user.postalCode || "",
      phoneNumber: user.phoneNumber || "",
      webAddress: user.webAddress || "",
      ssn: user.ssn || "",
      status: user.status,
      role: user.role,
      taxNumber: user.taxNumber || "",
      note: user.note || "",
    });
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
    setEditingId(null);
    setFormData({
      email: "",
      password: "",
      name: "",
      lastName: "",
      username: "",
      displayUsername: "",
      country: "",
      state: "",
      city: "",
      address: "",
      postalCode: "",
      phoneNumber: "",
      webAddress: "",
      ssn: "",
      status: "ACTIVE" as UserStatus,
      role: "BREEDER" as UserRole,
      taxNumber: "",
      note: "",
    });
  };

  const columns = createColumns(handleEdit, handleDelete);

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
      <div className="flex items-center gap-4 mb-4">
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

      <DataTable
        columns={columns}
        data={filteredUsers}
        searchKey="name"
        searchPlaceholder="Search users..."
        />

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit User" : "Create New User"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>

              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData({ ...formData, lastName: e.target.value })
                  }
                />
              </div>
            </div>

            {!editingId && (
              <>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    required
                    minLength={8}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Minimum 8 characters
                  </p>
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                />
              </div>

              <div>
                <Label htmlFor="displayUsername">Display Username</Label>
                <Input
                  id="displayUsername"
                  value={formData.displayUsername}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      displayUsername: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="role">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) =>
                    setFormData({ ...formData, role: value as UserRole })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BREEDER">Breeder</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="SUPERADMIN">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData({ ...formData, status: value as UserStatus })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                    <SelectItem value="PROSPECT">Prospect</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) =>
                    setFormData({ ...formData, country: e.target.value })
                  }
                />
              </div>

              <div>
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) =>
                    setFormData({ ...formData, state: e.target.value })
                  }
                />
              </div>

              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) =>
                    setFormData({ ...formData, city: e.target.value })
                  }
                />
              </div>
            </div>

            <div>
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="postalCode">Postal Code</Label>
                <Input
                  id="postalCode"
                  value={formData.postalCode}
                  onChange={(e) =>
                    setFormData({ ...formData, postalCode: e.target.value })
                  }
                />
              </div>

              <div>
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Input
                  id="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, phoneNumber: e.target.value })
                  }
                />
              </div>
            </div>

            <div>
              <Label htmlFor="webAddress">Website</Label>
              <Input
                id="webAddress"
                type="url"
                value={formData.webAddress}
                onChange={(e) =>
                  setFormData({ ...formData, webAddress: e.target.value })
                }
                placeholder="https://example.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ssn">SSN</Label>
                <Input
                  id="ssn"
                  value={formData.ssn}
                  onChange={(e) =>
                    setFormData({ ...formData, ssn: e.target.value })
                  }
                />
              </div>

              <div>
                <Label htmlFor="taxNumber">Tax Number</Label>
                <Input
                  id="taxNumber"
                  value={formData.taxNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, taxNumber: e.target.value })
                  }
                />
              </div>
            </div>

            <div>
              <Label htmlFor="note">Note</Label>
              <Input
                id="note"
                value={formData.note}
                onChange={(e) =>
                  setFormData({ ...formData, note: e.target.value })
                }
                placeholder="Additional notes..."
              />
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : editingId
                  ? "Update"
                  : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
