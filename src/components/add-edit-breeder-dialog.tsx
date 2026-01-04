"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import { useCreateUser, useUpdateUser } from "@/lib/api/users";
import type { User, UserRole, UserStatus } from "@/lib/types";

interface AddEditBreederDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingUser?: User | null;
  onSuccess?: (user: any) => void;
}

export function AddEditBreederDialog({
  open,
  onOpenChange,
  editingUser,
  onSuccess,
}: AddEditBreederDialogProps) {
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

  const createMutation = useCreateUser({});
  const updateMutation = useUpdateUser({});

  // Update form data when editing user changes
  useEffect(() => {
    if (editingUser) {
      setFormData({
        email: editingUser.email,
        password: "",
        name: editingUser.name,
        lastName: editingUser.lastName || "",
        username: editingUser.username || "",
        displayUsername: editingUser.displayUsername || "",
        country: editingUser.country || "",
        state: editingUser.state || "",
        city: editingUser.city || "",
        address: editingUser.address || "",
        postalCode: editingUser.postalCode || "",
        phoneNumber: editingUser.phoneNumber || "",
        webAddress: editingUser.webAddress || "",
        ssn: editingUser.ssn || "",
        status: editingUser.status,
        role: editingUser.role,
        taxNumber: editingUser.taxNumber || "",
        note: editingUser.note || "",
      });
    } else {
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
    }
  }, [editingUser, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    if (!editingUser && !formData.email.trim()) {
      toast.error("Email is required");
      return;
    }

    if (!editingUser && !formData.password.trim()) {
      toast.error("Password is required");
      return;
    }

    try {
      let result;
      if (editingUser) {
        if (!updateMutation.mutateAsync) return;
        const { email, password, ...updateData } = formData;
        result = await updateMutation.mutateAsync({ id: editingUser.id, ...updateData });
        toast.success("Breeder updated successfully");
      } else {
        if (!createMutation.mutateAsync) return;
        result = await createMutation.mutateAsync(formData);
        toast.success("Breeder created successfully");
      }
      
      if (onSuccess) {
        onSuccess(result);
      }
      
      handleClose();
    } catch (error) {
      toast.error(editingUser ? "Failed to update breeder" : "Failed to create breeder");
    }
  };

  const handleClose = () => {
    onOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingUser ? "Edit Breeder" : "Add New Breeder"}
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

          {!editingUser && (
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
                <SelectTrigger className="w-full">
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
                <SelectTrigger className="w-full">
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
                : editingUser
                ? "Update"
                : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
