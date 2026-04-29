"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUploadWithCrop } from "@/components/image-upload-with-crop";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
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
import { COUNTRIES, getCountryFlag, getCountryName, getStatesForCountry } from "@/lib/flag-constants";
import Image from "next/image";

interface AddEditBreederDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingUser?: User | null;
  copyUser?: User | null;
  onSuccess?: (user: any) => void;
}

export function AddEditBreederDialog({
  open,
  onOpenChange,
  editingUser,
  copyUser,
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
    loftName: "",
    note: "",
    timezone: "",
    legalName: "",
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [ssnDocFile, setSsnDocFile] = useState<File | null>(null);
  const [taxDocFile, setTaxDocFile] = useState<File | null>(null);

  const createMutation = useCreateUser({});
  const updateMutation = useUpdateUser({});

  const availableStates = useMemo(
    () => getStatesForCountry(formData.country),
    [formData.country]
  );

  // Update form data when editing/copying user changes
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
        loftName: editingUser.loftName || "",
        note: editingUser.note || "",
        timezone: editingUser.timezone || "",
        legalName: editingUser.legalName || "",
      });
      setImagePreview(editingUser.image || null);
      setImageFile(null);
    } else if (copyUser) {
      setFormData({
        email: "",
        password: "",
        name: copyUser.name,
        lastName: copyUser.lastName || "",
        username: "",
        displayUsername: copyUser.displayUsername || "",
        country: copyUser.country || "",
        state: copyUser.state || "",
        city: copyUser.city || "",
        address: copyUser.address || "",
        postalCode: copyUser.postalCode || "",
        phoneNumber: copyUser.phoneNumber || "",
        webAddress: copyUser.webAddress || "",
        ssn: "",
        status: copyUser.status,
        role: copyUser.role,
        taxNumber: "",
        loftName: copyUser.loftName || "",
        note: copyUser.note || "",
        timezone: copyUser.timezone || "",
        legalName: "",
      });
      setImagePreview(null);
      setImageFile(null);
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
        loftName: "",
        note: "",
        timezone: "",
        legalName: "",
      });
      setImagePreview(null);
      setImageFile(null);
      setSsnDocFile(null);
      setTaxDocFile(null);
    }
  }, [editingUser, copyUser, open]);

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
      const uploadFile = async (file: File, oldKey?: string | null) => {
        const fd = new FormData();
        fd.append("file", file);
        if (oldKey) fd.append("oldKey", oldKey);
        const res = await fetch("/api/admin/users/upload-image", { method: "POST", body: fd });
        if (!res.ok) throw new Error("Upload failed");
        return res.json() as Promise<{ url: string; key: string }>;
      };

      const [uploadedImage, uploadedSsnDoc, uploadedTaxDoc] = await Promise.all([
        imageFile ? uploadFile(imageFile, editingUser?.imageKey) : Promise.resolve(null),
        ssnDocFile ? uploadFile(ssnDocFile, editingUser?.ssnDocKey) : Promise.resolve(null),
        taxDocFile ? uploadFile(taxDocFile, editingUser?.taxDocKey) : Promise.resolve(null),
      ]);

      let result;
      if (editingUser) {
        if (!updateMutation.mutateAsync) return;
        const { email, password, ...updateData } = formData;
        result = await updateMutation.mutateAsync({
          id: editingUser.id,
          ...updateData,
          ...(uploadedImage ? { image: uploadedImage.url, imageKey: uploadedImage.key } : {}),
          ...(uploadedSsnDoc ? { ssnDocKey: uploadedSsnDoc.key } : {}),
          ...(uploadedTaxDoc ? { taxDocKey: uploadedTaxDoc.key } : {}),
        });
        toast.success("Breeder updated successfully");
      } else {
        if (!createMutation.mutateAsync) return;
        result = await createMutation.mutateAsync({
          ...formData,
          ...(uploadedImage ? { image: uploadedImage.url, imageKey: uploadedImage.key } : {}),
          ...(uploadedSsnDoc ? { ssnDocKey: uploadedSsnDoc.key } : {}),
          ...(uploadedTaxDoc ? { taxDocKey: uploadedTaxDoc.key } : {}),
        });
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
      loftName: "",
      note: "",
      timezone: "",
      legalName: "",
    });
    setImagePreview(null);
    setImageFile(null);
    setSsnDocFile(null);
    setTaxDocFile(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingUser ? "Edit Breeder" : copyUser ? "Copy Breeder" : "Add New Breeder"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Profile Picture</Label>
            <ImageUploadWithCrop
              aspect={1}
              value={imagePreview}
              onChange={(url, file) => {
                setImagePreview(url);
                setImageFile(file || null);
              }}
              placeholder="Click or drag to upload profile picture"
            />
          </div>

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
              <Select
                value={formData.country}
                onValueChange={(value) =>
                  setFormData({ ...formData, country: value, state: "" })
                }
              >
                <SelectTrigger id="country">
                  <SelectValue placeholder="Select country">
                    {formData.country && (
                      <div className="flex items-center gap-2">
                        {getCountryFlag(formData.country) && (
                          <Image
                            src={getCountryFlag(formData.country)!}
                            alt={getCountryName(formData.country)}
                            width={20}
                            height={15}
                            className="rounded"
                          />
                        )}
                        <span>{getCountryName(formData.country)}</span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(COUNTRIES).map(([code, name]) => (
                    <SelectItem key={code} value={code}>
                      <div className="flex items-center gap-2">
                        <Image
                          src={`/countryflags/${code}.gif`}
                          alt={name}
                          width={20}
                          height={15}
                          className="rounded"
                        />
                        <span>{name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="state">State</Label>
              <Select
                value={formData.state}
                onValueChange={(value) =>
                  setFormData({ ...formData, state: value })
                }
                disabled={!formData.country || availableStates.length === 0}
              >
                <SelectTrigger id="state">
                  <SelectValue placeholder={formData.country ? "Select state" : "Select country first"} />
                </SelectTrigger>
                <SelectContent>
                  {availableStates.map((s) => (
                    <SelectItem key={s.code} value={s.code}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ssnDoc">SSN Document (PDF/Image)</Label>
              <Input
                id="ssnDoc"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setSsnDocFile(e.target.files?.[0] || null)}
              />
              {editingUser?.ssnDocKey && !ssnDocFile && (
                <p className="text-xs text-muted-foreground mt-1">Document on file</p>
              )}
            </div>
            <div>
              <Label htmlFor="taxDoc">Tax Document (PDF/Image)</Label>
              <Input
                id="taxDoc"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setTaxDocFile(e.target.files?.[0] || null)}
              />
              {editingUser?.taxDocKey && !taxDocFile && (
                <p className="text-xs text-muted-foreground mt-1">Document on file</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Label htmlFor="loftName">Loft Name</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="font-medium mb-1">Why add a loft name?</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Identifies the breeder&apos;s physical loft during basketting (e.g. LB-SMITH-1)</li>
                      <li>Distinguishes breeders with the same last name</li>
                      <li>Used on basket labels and race sheets</li>
                      <li>Common designations: AGN, AS, OLR club tags, or custom names</li>
                      <li>Helpful when one person manages multiple lofts</li>
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="loftName"
                value={formData.loftName}
                onChange={(e) =>
                  setFormData({ ...formData, loftName: e.target.value })
                }
                placeholder="e.g. Smith Loft, AGN-42"
              />
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                value={formData.timezone}
                onValueChange={(value) => setFormData({ ...formData, timezone: value })}
              >
                <SelectTrigger id="timezone">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {(typeof Intl.supportedValuesOf === "function"
                    ? Intl.supportedValuesOf("timeZone")
                    : ["America/New_York","America/Chicago","America/Denver","America/Los_Angeles","America/Phoenix","Pacific/Honolulu","America/Anchorage","Europe/London","Europe/Paris","Asia/Tokyo","Australia/Sydney"]
                  ).map((tz) => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="legalName">Legal Name (for tax purposes)</Label>
              <Input
                id="legalName"
                value={formData.legalName}
                onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                placeholder="Full legal name"
              />
            </div>
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
