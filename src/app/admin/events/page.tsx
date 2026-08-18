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
import { EventLocationField } from "@/components/map/event-location-field";
import { useRouter } from "next/navigation";

const STEP_LABELS = ["Event Details", "Season Details", "Optional Details"];

export default function EventsPage() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [logoImageFile, setLogoImageFile] = useState<File | null>(null);
  const [bannerImageFile, setBannerImageFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    shortName: "",
    description: "",
    eventDate: "",
    endDate: "",
    isOpen: 1 as number,
    eventTypeId: "" as string,
    feeSchemeId: "",
    finalPrizeSchemeId: "",
    bettingSchemeId: "",
    hotSpot1PrizeSchemeId: "",
    hotSpot2PrizeSchemeId: "",
    hotSpot3PrizeSchemeId: "",
    hotSpotAvgPrizeSchemeId: "",
    latitude: null as number | null,
    longitude: null as number | null,
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
    seasonName: "Season 1",
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

  const validateStep = (s: number) => {
    if (s === 1) {
      if (!formData.name.trim()) { toast.error("Event name is required"); return false; }
      if (!formData.eventTypeId) { toast.error("Event type is required"); return false; }
    }
    if (s === 2) {
      if (!formData.seasonName.trim()) { toast.error("Season name is required"); return false; }
      if (!formData.eventDate) { toast.error("Start date is required"); return false; }
      if (!formData.endDate) { toast.error("End date is required"); return false; }
      if (!formData.feeSchemeId) { toast.error("Fee scheme is required"); return false; }
      if (!formData.bettingSchemeId) { toast.error("Betting scheme is required"); return false; }
      if (!formData.finalPrizeSchemeId) { toast.error("Final prize scheme is required"); return false; }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep(step)) return;
    setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s));
  };

  const handleBack = () => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(step)) return;

    try {
      const submitFormData = new FormData();

      Object.entries(formData).forEach(([key, value]) => {
        if (key !== "logoImage" && key !== "bannerImage" && key !== "seasonName" &&
            !key.startsWith("hotSpot") && key !== "bettingSchemeId" &&
            key !== "feeSchemeId" && key !== "finalPrizeSchemeId" &&
            value !== null && value !== undefined) {
          submitFormData.append(key, value.toString());
        }
      });

      if (logoImageFile) submitFormData.append("logoImage", logoImageFile);
      if (bannerImageFile) submitFormData.append("bannerImage", bannerImageFile);

      if (editingId) {
        if (!updateMutation.mutateAsync) return;
        submitFormData.append("id", editingId.toString());
        await updateMutation.mutateAsync(submitFormData);
        toast.success("Event updated successfully");
      } else {
        if (!createMutation.mutateAsync) return;
        const result = await createMutation.mutateAsync(submitFormData);
        const newEventId = result?.data?.event?.id;

        if (newEventId) {
          await fetch(`/api/admin/event/${newEventId}/seasons`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              name: formData.seasonName,
              startDate: formData.eventDate,
              endDate: formData.endDate,
              feeSchemeId: formData.feeSchemeId || undefined,
              bettingSchemeId: formData.bettingSchemeId || undefined,
              finalPrizeSchemeId: formData.finalPrizeSchemeId || undefined,
              hotSpot1PrizeSchemeId: formData.hotSpot1PrizeSchemeId || undefined,
              hotSpot2PrizeSchemeId: formData.hotSpot2PrizeSchemeId || undefined,
              hotSpot3PrizeSchemeId: formData.hotSpot3PrizeSchemeId || undefined,
              hotSpotAvgPrizeSchemeId: formData.hotSpotAvgPrizeSchemeId || undefined,
            }),
          });
        }

        toast.success("Event created successfully");
      }
      handleClose();
    } catch {
      toast.error(editingId ? "Failed to update event" : "Failed to create event");
    }
  };

  const handleEdit = (event: Event) => {
    router.push(`/admin/events/${event.id}`);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this event?")) return;
    try {
      if (!deleteMutation.mutateAsync) return;
      await deleteMutation.mutateAsync({ eventId: id });
      toast.success("Event deleted successfully");
    } catch {
      toast.error("Failed to delete event");
    }
  };

  const emptyForm = {
    name: "", shortName: "", description: "", eventDate: "", endDate: "",
    isOpen: 1 as number, eventTypeId: "", feeSchemeId: "", finalPrizeSchemeId: "",
    bettingSchemeId: "", hotSpot1PrizeSchemeId: "", hotSpot2PrizeSchemeId: "",
    hotSpot3PrizeSchemeId: "", hotSpotAvgPrizeSchemeId: "",
    latitude: null as number | null, longitude: null as number | null,
    contactName: "", contactEmail: "", contactPhone: "", contactWebsite: "",
    contactAddress: "", socialYt: "", socialFb: "", socialTwitter: "", socialInsta: "",
    logoImage: null as string | null, bannerImage: null as string | null,
    seasonName: "Season 1",
  };

  const handleClose = () => {
    setIsOpen(false);
    setEditingId(null);
    setStep(1);
    setLogoImageFile(null);
    setBannerImageFile(null);
    setFormData(emptyForm);
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

  const fd = formData;
  const set = (patch: Partial<typeof formData>) => setFormData({ ...fd, ...patch });

  return (
    <div className="p-8 w-full mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Events</h1>
        <Button onClick={() => setIsOpen(true)}>Create New Event</Button>
      </div>

      <DataTable
        tableId="admin-events"
        columns={columns}
        data={events}
        filterableColumns={[{ id: "name", title: "Event Name" }]}
      />

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Event" : "Create New Event"}
            </DialogTitle>
          </DialogHeader>

          {!editingId && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground pb-2 border-b">
              {STEP_LABELS.map((label, i) => (
                <span key={i} className={`flex items-center gap-1 ${step === i + 1 ? "text-foreground font-medium" : ""}`}>
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs ${step === i + 1 ? "bg-primary text-primary-foreground" : step > i + 1 ? "bg-primary/40 text-primary-foreground" : "bg-muted"}`}>{i + 1}</span>
                  {label}
                  {i < STEP_LABELS.length - 1 && <span className="mx-1">›</span>}
                </span>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Step 1 — Event Details */}
            {(editingId || step === 1) && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Event Name *</Label>
                    <Input id="name" value={fd.name} onChange={(e) => set({ name: e.target.value })} required />
                  </div>
                  <div>
                    <Label htmlFor="shortName">Short Name</Label>
                    <Input id="shortName" value={fd.shortName} onChange={(e) => set({ shortName: e.target.value })} />
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input id="description" value={fd.description} onChange={(e) => set({ description: e.target.value })} placeholder="Event description..." />
                </div>

                <EventLocationField
                  latitude={fd.latitude}
                  longitude={fd.longitude}
                  onChange={(lat, lng) => set({ latitude: lat, longitude: lng })}
                />

                <div>
                  <Label htmlFor="isOpen">Event Status</Label>
                  <Select value={fd.isOpen.toString()} onValueChange={(v) => set({ isOpen: parseInt(v) })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Open</SelectItem>
                      <SelectItem value="0">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="eventTypeId">Event Type *</Label>
                  <Select value={fd.eventTypeId} onValueChange={(v) => set({ eventTypeId: v })}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select event type" /></SelectTrigger>
                    <SelectContent>
                      {eventTypes.map((et) => (
                        <SelectItem key={et.id} value={String(et.id)}>{et.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Step 2 — Season Details */}
            {(editingId || step === 2) && (
              <div className="space-y-4">
                {!editingId && <h3 className="text-base font-semibold">Season Details</h3>}

                <div>
                  <Label htmlFor="seasonName">Season Name *</Label>
                  <Input id="seasonName" value={fd.seasonName} onChange={(e) => set({ seasonName: e.target.value })} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="eventDate">Start Date *</Label>
                    <Input id="eventDate" type="date" value={fd.eventDate} onChange={(e) => set({ eventDate: e.target.value })} required />
                  </div>
                  <div>
                    <Label htmlFor="endDate">End Date *</Label>
                    <Input id="endDate" type="date" value={fd.endDate} onChange={(e) => set({ endDate: e.target.value })} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="feeSchemeId">Fee Scheme *</Label>
                    <Select value={fd.feeSchemeId} onValueChange={(v) => set({ feeSchemeId: v })}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Select fee scheme" /></SelectTrigger>
                      <SelectContent>
                        {feeSchemes.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="bettingSchemeId">Betting Scheme *</Label>
                    <Select value={fd.bettingSchemeId} onValueChange={(v) => set({ bettingSchemeId: v })}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Select betting scheme" /></SelectTrigger>
                      <SelectContent>
                        {bettingSchemes.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="finalPrizeSchemeId">Final Prize Scheme *</Label>
                  <Select value={fd.finalPrizeSchemeId} onValueChange={(v) => set({ finalPrizeSchemeId: v })}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select final prize scheme" /></SelectTrigger>
                    <SelectContent>
                      {prizeSchemes.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="hotSpot1PrizeSchemeId">HotSpot 1 Prize Scheme</Label>
                    <Select value={fd.hotSpot1PrizeSchemeId} onValueChange={(v) => set({ hotSpot1PrizeSchemeId: v })}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Optional" /></SelectTrigger>
                      <SelectContent>
                        {prizeSchemes.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="hotSpot2PrizeSchemeId">HotSpot 2 Prize Scheme</Label>
                    <Select value={fd.hotSpot2PrizeSchemeId} onValueChange={(v) => set({ hotSpot2PrizeSchemeId: v })}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Optional" /></SelectTrigger>
                      <SelectContent>
                        {prizeSchemes.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="hotSpot3PrizeSchemeId">HotSpot 3 Prize Scheme</Label>
                    <Select value={fd.hotSpot3PrizeSchemeId} onValueChange={(v) => set({ hotSpot3PrizeSchemeId: v })}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Optional" /></SelectTrigger>
                      <SelectContent>
                        {prizeSchemes.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="hotSpotAvgPrizeSchemeId">HotSpot Avg Prize Scheme</Label>
                    <Select value={fd.hotSpotAvgPrizeSchemeId} onValueChange={(v) => set({ hotSpotAvgPrizeSchemeId: v })}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Optional" /></SelectTrigger>
                      <SelectContent>
                        {prizeSchemes.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3 — Optional Details */}
            {(editingId || step === 3) && (
              <div className="space-y-4">
                {!editingId && <h3 className="text-base font-semibold">Optional Details</h3>}

                <div className="space-y-4">
                  <div>
                    <Label>Logo Image (Square)</Label>
                    <div className="flex justify-center">
                      <ImageUploadWithCrop
                        aspect={1}
                        value={fd.logoImage}
                        onChange={(url, file) => { set({ logoImage: url }); setLogoImageFile(file || null); }}
                        className="w-64 h-64"
                        placeholder="Upload logo image (1:1 ratio)"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Banner Image (16:9)</Label>
                    <ImageUploadWithCrop
                      aspect={16 / 9}
                      value={fd.bannerImage}
                      onChange={(url, file) => { set({ bannerImage: url }); setBannerImageFile(file || null); }}
                      className="w-full h-48"
                      placeholder="Upload banner image (16:9 ratio)"
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-base font-semibold mb-4">Contact Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="contactName">Contact Name</Label>
                      <Input id="contactName" value={fd.contactName} onChange={(e) => set({ contactName: e.target.value })} />
                    </div>
                    <div>
                      <Label htmlFor="contactEmail">Contact Email</Label>
                      <Input id="contactEmail" type="email" value={fd.contactEmail} onChange={(e) => set({ contactEmail: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <Label htmlFor="contactPhone">Contact Phone</Label>
                      <Input id="contactPhone" value={fd.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} />
                    </div>
                    <div>
                      <Label htmlFor="contactWebsite">Contact Website</Label>
                      <Input id="contactWebsite" type="url" value={fd.contactWebsite} onChange={(e) => set({ contactWebsite: e.target.value })} placeholder="https://example.com" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <Label htmlFor="contactAddress">Contact Address</Label>
                    <Input id="contactAddress" value={fd.contactAddress} onChange={(e) => set({ contactAddress: e.target.value })} />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-base font-semibold mb-4">Social Media Links</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="socialYt">YouTube</Label>
                      <Input id="socialYt" type="url" value={fd.socialYt} onChange={(e) => set({ socialYt: e.target.value })} placeholder="https://youtube.com/..." />
                    </div>
                    <div>
                      <Label htmlFor="socialFb">Facebook</Label>
                      <Input id="socialFb" type="url" value={fd.socialFb} onChange={(e) => set({ socialFb: e.target.value })} placeholder="https://facebook.com/..." />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <Label htmlFor="socialTwitter">Twitter</Label>
                      <Input id="socialTwitter" type="url" value={fd.socialTwitter} onChange={(e) => set({ socialTwitter: e.target.value })} placeholder="https://twitter.com/..." />
                    </div>
                    <div>
                      <Label htmlFor="socialInsta">Instagram</Label>
                      <Input id="socialInsta" type="url" value={fd.socialInsta} onChange={(e) => set({ socialInsta: e.target.value })} placeholder="https://instagram.com/..." />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-between pt-4 border-t">
              <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              <div className="flex gap-2">
                {!editingId && step > 1 && (
                  <Button type="button" variant="outline" onClick={handleBack}>Back</Button>
                )}
                {!editingId && step < 3 ? (
                  <Button type="button" onClick={handleNext}>Next</Button>
                ) : (
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingId ? "Update" : "Create"}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
