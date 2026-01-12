"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  useCreateEvent,
  useDeleteEvent,
  useListEvents,
  useUpdateEvent,
} from "@/lib/api/events";
import { useListEventTypes } from "@/lib/api/event-types";
import { useListFeeSchemes } from "@/lib/api/fee-schemes";
import { useListPrizeSchemes } from "@/lib/api/prize-schemes";
import { useListBettingSchemes } from "@/lib/api/betting-schemes";
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
import type { BettingScheme, Event, EventType, FeeScheme, PrizeScheme } from "@/lib/types";
import { ImageUploadWithCrop } from "@/components/image-upload-with-crop";
import { useRouter } from "next/navigation";

export default function EventsPage() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [logoImageFile, setLogoImageFile] = useState<File | null>(null);
  const [bannerImageFile, setBannerImageFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    shortName: "",
    description: "",
    startDate: "",
    endDate: "",
    isOpen: true,
    typeId: "",
    feeSchemeId: "",
    prizeSchemeId: "",
    bettingSchemeId: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    contactWebsite: "",
    contactAddress: "",
    socialYt: "",
    socialFb: "",
    socialTwitter: "",
    socialInsta: "",
    logoImage: null as string | null,
    bannerImage: null as string | null,
  });

  const { data: eventsData, isPending, isError } = useListEvents({});
  const { data: eventTypesData } = useListEventTypes({});
  const { data: feeSchemesData } = useListFeeSchemes({});
  const { data: prizeSchemesData } = useListPrizeSchemes({});
  const { data: bettingSchemesData } = useListBettingSchemes({});

  const events: Event[] = eventsData?.events || [];
  const eventTypes: EventType[] = eventTypesData?.eventTypes || [];
  const feeSchemes: FeeScheme[] = feeSchemesData?.feeSchemes || [];
  const prizeSchemes: PrizeScheme[] = prizeSchemesData?.prizeSchemes || [];
  const bettingSchemes: BettingScheme[] = bettingSchemesData?.bettingSchemes || [];

  const createMutation = useCreateEvent({});
  const updateMutation = useUpdateEvent({});
  const deleteMutation = useDeleteEvent({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Event name is required");
      return;
    }

    if (!formData.startDate) {
      toast.error("Start date is required");
      return;
    }

    if (!formData.typeId) {
      toast.error("Event type is required");
      return;
    }

    if (!formData.feeSchemeId) {
      toast.error("Fee scheme is required");
      return;
    }

    if (!formData.prizeSchemeId) {
      toast.error("Prize scheme is required");
      return;
    }

    if (!formData.bettingSchemeId) {
      toast.error("Betting scheme is required");
      return;
    }

    try {
      const submitFormData = new FormData();
      
      // Add all text fields
      Object.entries(formData).forEach(([key, value]) => {
        if (key !== 'logoImage' && key !== 'bannerImage' && value !== null && value !== undefined) {
          submitFormData.append(key, value.toString());
        }
      });

      // Add images if they exist
      if (logoImageFile) {
        submitFormData.append('logoImage', logoImageFile);
      }
      if (bannerImageFile) {
        submitFormData.append('bannerImage', bannerImageFile);
      }

      if (editingId) {
        if (!updateMutation.mutateAsync) return;
        submitFormData.append('eventId', editingId);
        await updateMutation.mutateAsync(submitFormData);
        toast.success("Event updated successfully");
      } else {
        if (!createMutation.mutateAsync) return;
        await createMutation.mutateAsync(submitFormData);
        toast.success("Event created successfully");
      }
      handleClose();
    } catch (error) {
      toast.error(editingId ? "Failed to update event" : "Failed to create event");
    }
  };

  const handleEdit = (event: Event) => {
    router.push(`/admin/events/${event.eventId}`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this event?")) return;

    try {
      if (!deleteMutation.mutateAsync) return;
      await deleteMutation.mutateAsync({ eventId: id });
      toast.success("Event deleted successfully");
    } catch (error) {
      toast.error("Failed to delete event");
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setEditingId(null);
    setLogoImageFile(null);
    setBannerImageFile(null);
    setFormData({
      name: "",
      shortName: "",
      description: "",
      startDate: "",
      endDate: "",
      isOpen: true,
      typeId: "",
      feeSchemeId: "",
      prizeSchemeId: "",
      bettingSchemeId: "",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      contactWebsite: "",
      contactAddress: "",
      socialYt: "",
      socialFb: "",
      socialTwitter: "",
      socialInsta: "",
      logoImage: null,
      bannerImage: null,
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
        <div className="text-red-500">Error loading events</div>
      </div>
    );
  }

  return (
    <div className="p-8 w-full mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Events</h1>
        <Button onClick={() => setIsOpen(true)}>Create New Event</Button>
      </div>

      <DataTable
        columns={columns}
        data={events}
        filterableColumns={[
          { id: "name", title: "Event Name" },
          { id: "type", title: "Type" },
        ]}
      />

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Event" : "Create New Event"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label>Logo Image (Square)</Label>
                <div className="flex justify-center">
                  <ImageUploadWithCrop
                    aspect={1}
                    value={formData.logoImage}
                    onChange={(url, file) => {
                      setFormData({ ...formData, logoImage: url });
                      setLogoImageFile(file || null);
                    }}
                    className="w-64 h-64"
                    placeholder="Upload logo image (1:1 ratio)"
                  />
                </div>
              </div>

              <div>
                <Label>Banner Image (16:9)</Label>
                <ImageUploadWithCrop
                  aspect={16 / 9}
                  value={formData.bannerImage}
                  onChange={(url, file) => {
                    setFormData({ ...formData, bannerImage: url });
                    setBannerImageFile(file || null);
                  }}
                  className="w-full h-48"
                  placeholder="Upload banner image (16:9 ratio)"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Event Name *</Label>
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
                <Label htmlFor="shortName">Short Name</Label>
                <Input
                  id="shortName"
                  value={formData.shortName}
                  onChange={(e) =>
                    setFormData({ ...formData, shortName: e.target.value })
                  }
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Event description..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData({ ...formData, startDate: e.target.value })
                  }
                  required
                />
              </div>

              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) =>
                    setFormData({ ...formData, endDate: e.target.value })
                  }
                />
              </div>
            </div>

            <div>
              <Label htmlFor="isOpen">Event Status</Label>
              <Select
                value={formData.isOpen.toString()}
                onValueChange={(value) =>
                  setFormData({ ...formData, isOpen: value === "true" })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Open</SelectItem>
                  <SelectItem value="false">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="typeId">Event Type *</Label>
                <Select
                  value={formData.typeId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, typeId: value })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select event type" />
                  </SelectTrigger>
                  <SelectContent>
                    {eventTypes.map((type: any) => (
                      <SelectItem key={type.eventTypeId} value={type.eventTypeId}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="feeSchemeId">Fee Scheme *</Label>
                <Select
                  value={formData.feeSchemeId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, feeSchemeId: value })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select fee scheme" />
                  </SelectTrigger>
                  <SelectContent>
                    {feeSchemes.map((scheme: any) => (
                      <SelectItem key={scheme.id} value={scheme.id}>
                        {scheme.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="prizeSchemeId">Prize Scheme *</Label>
                <Select
                  value={formData.prizeSchemeId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, prizeSchemeId: value })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select prize scheme" />
                  </SelectTrigger>
                  <SelectContent>
                    {prizeSchemes.map((scheme: any) => (
                      <SelectItem key={scheme.prizeSchemeId} value={scheme.prizeSchemeId}>
                        {scheme.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="bettingSchemeId">Betting Scheme *</Label>
                <Select
                  value={formData.bettingSchemeId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, bettingSchemeId: value })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select betting scheme" />
                  </SelectTrigger>
                  <SelectContent>
                    {bettingSchemes.map((scheme: any) => (
                      <SelectItem key={scheme.bettingSchemeId} value={scheme.bettingSchemeId}>
                        {scheme.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold mb-4">Contact Information</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contactName">Contact Name</Label>
                  <Input
                    id="contactName"
                    value={formData.contactName}
                    onChange={(e) =>
                      setFormData({ ...formData, contactName: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="contactEmail">Contact Email</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) =>
                      setFormData({ ...formData, contactEmail: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <Label htmlFor="contactPhone">Contact Phone</Label>
                  <Input
                    id="contactPhone"
                    value={formData.contactPhone}
                    onChange={(e) =>
                      setFormData({ ...formData, contactPhone: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="contactWebsite">Contact Website</Label>
                  <Input
                    id="contactWebsite"
                    type="url"
                    value={formData.contactWebsite}
                    onChange={(e) =>
                      setFormData({ ...formData, contactWebsite: e.target.value })
                    }
                    placeholder="https://example.com"
                  />
                </div>
              </div>

              <div className="mt-4">
                <Label htmlFor="contactAddress">Contact Address</Label>
                <Input
                  id="contactAddress"
                  value={formData.contactAddress}
                  onChange={(e) =>
                    setFormData({ ...formData, contactAddress: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold mb-4">Social Media Links</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="socialYt">YouTube</Label>
                  <Input
                    id="socialYt"
                    type="url"
                    value={formData.socialYt}
                    onChange={(e) =>
                      setFormData({ ...formData, socialYt: e.target.value })
                    }
                    placeholder="https://youtube.com/..."
                  />
                </div>

                <div>
                  <Label htmlFor="socialFb">Facebook</Label>
                  <Input
                    id="socialFb"
                    type="url"
                    value={formData.socialFb}
                    onChange={(e) =>
                      setFormData({ ...formData, socialFb: e.target.value })
                    }
                    placeholder="https://facebook.com/..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <Label htmlFor="socialTwitter">Twitter</Label>
                  <Input
                    id="socialTwitter"
                    type="url"
                    value={formData.socialTwitter}
                    onChange={(e) =>
                      setFormData({ ...formData, socialTwitter: e.target.value })
                    }
                    placeholder="https://twitter.com/..."
                  />
                </div>

                <div>
                  <Label htmlFor="socialInsta">Instagram</Label>
                  <Input
                    id="socialInsta"
                    type="url"
                    value={formData.socialInsta}
                    onChange={(e) =>
                      setFormData({ ...formData, socialInsta: e.target.value })
                    }
                    placeholder="https://instagram.com/..."
                  />
                </div>
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
