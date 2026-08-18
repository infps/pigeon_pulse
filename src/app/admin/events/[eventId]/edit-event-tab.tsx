"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useUpdateEvent } from "@/lib/api/events";
import { useListEventTypes } from "@/lib/api/event-types";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUploadWithCrop } from "@/components/image-upload-with-crop";
import { EventLocationField } from "@/components/map/event-location-field";
import type { BettingScheme, Event, EventType, FeeScheme, PrizeScheme } from "@/lib/types";
import type { Season } from "@/lib/season-context";

interface EditEventTabProps {
  event: Event;
  eventId: string;
  feeSchemes: FeeScheme[];
  prizeSchemes: PrizeScheme[];
  bettingSchemes: BettingScheme[];
}

export function EditEventTab({
  event,
  eventId,
  feeSchemes,
  prizeSchemes,
  bettingSchemes,
}: EditEventTabProps) {
  const [logoImageFile, setLogoImageFile] = useState<File | null>(null);
  const [bannerImageFile, setBannerImageFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    name: event.name ?? "",
    shortName: event.shortName || "",
    description: event.description || "",
    eventDate: event.eventDate ? new Date(event.eventDate).toISOString().split("T")[0] : "",
    endDate: event.endDate ? new Date(event.endDate).toISOString().split("T")[0] : "",
    isOpen: event.isOpen ?? 1,
    eventTypeId: event.eventTypeId?.toString() || "",
    latitude: event.latitude ?? (null as number | null),
    longitude: event.longitude ?? (null as number | null),
    locationAddress: event.locationAddress || "",
    contactName: event.contactName || "",
    contactEmail: event.contactEmail || "",
    contactPhone: event.contactPhone || "",
    contactWebsite: event.contactWebsite || "",
    contactAddress: event.contactAddress || "",
    socialYt: event.socialYt || "",
    socialFb: event.socialFb || "",
    socialTwitter: event.socialTwitter || "",
    socialInsta: event.socialInsta || "",
    logoImage: event.logoImage || null,
    bannerImage: event.bannerImage || null,
  });

  const { data: eventTypesData } = useListEventTypes({});
  const eventTypes: EventType[] = eventTypesData?.eventTypes || [];
  const updateMutation = useUpdateEvent({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Event name is required");
      return;
    }

    if (!formData.eventDate) {
      toast.error("Event date is required");
      return;
    }

    if (!formData.eventTypeId) {
      toast.error("Event type is required");
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

      submitFormData.append('eventId', eventId);

      if (!updateMutation.mutateAsync) return;
      await updateMutation.mutateAsync(submitFormData);
      toast.success("Event updated successfully");
    } catch (error) {
      toast.error("Failed to update event");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto">
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
            className="w-full h-64"
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

      <div>
        <Label htmlFor="locationAddress">Liberation Point Address</Label>
        <Input
          id="locationAddress"
          value={formData.locationAddress}
          onChange={(e) =>
            setFormData({ ...formData, locationAddress: e.target.value })
          }
          placeholder="e.g. 123 Main St, Springfield, IL 62701"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Human-readable address shown to breeders. Pin the exact coordinates below.
        </p>
      </div>

      <EventLocationField
        latitude={formData.latitude}
        longitude={formData.longitude}
        onChange={(lat, lng) =>
          setFormData({ ...formData, latitude: lat, longitude: lng })
        }
      />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="eventDate">Event Date *</Label>
          <Input
            id="eventDate"
            type="date"
            value={formData.eventDate}
            onChange={(e) =>
              setFormData({ ...formData, eventDate: e.target.value })
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
            setFormData({ ...formData, isOpen: parseInt(value) })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Open</SelectItem>
            <SelectItem value="0">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="eventTypeId">Event Type *</Label>
          <Select
            value={formData.eventTypeId}
            onValueChange={(value) =>
              setFormData({ ...formData, eventTypeId: value })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select event type" />
            </SelectTrigger>
            <SelectContent>
              {eventTypes.map((et) => (
                <SelectItem key={et.id} value={String(et.id)}>
                  {et.name}
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

      <SeasonSettingsCard
        eventId={eventId}
        feeSchemes={feeSchemes}
        prizeSchemes={prizeSchemes}
        bettingSchemes={bettingSchemes}
      />

      <div className="flex gap-2 justify-end pt-4 border-t">
        <Button
          type="submit"
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}

// ── Season Settings ────────────────────────────────────────────────────────────

type SeasonForm = {
  name: string;
  startDate: string;
  endDate: string;
  feeSchemeId: string;
  bettingSchemeId: string;
  finalPrizeSchemeId: string;
  hotSpot1PrizeSchemeId: string;
  hotSpot2PrizeSchemeId: string;
  hotSpot3PrizeSchemeId: string;
  hotSpotAvgPrizeSchemeId: string;
};

const emptySF = (): SeasonForm => ({
  name: "", startDate: "", endDate: "", feeSchemeId: "", bettingSchemeId: "",
  finalPrizeSchemeId: "", hotSpot1PrizeSchemeId: "", hotSpot2PrizeSchemeId: "",
  hotSpot3PrizeSchemeId: "", hotSpotAvgPrizeSchemeId: "",
});

function seasonToForm(s: Season): SeasonForm {
  return {
    name: s.name,
    startDate: s.startDate ? new Date(s.startDate).toISOString().split("T")[0] : "",
    endDate: s.endDate ? new Date(s.endDate).toISOString().split("T")[0] : "",
    feeSchemeId: s.feeSchemeId ? String(s.feeSchemeId) : "",
    bettingSchemeId: s.bettingSchemeId ? String(s.bettingSchemeId) : "",
    finalPrizeSchemeId: s.finalPrizeSchemeId ? String(s.finalPrizeSchemeId) : "",
    hotSpot1PrizeSchemeId: s.hotSpot1PrizeSchemeId ? String(s.hotSpot1PrizeSchemeId) : "",
    hotSpot2PrizeSchemeId: s.hotSpot2PrizeSchemeId ? String(s.hotSpot2PrizeSchemeId) : "",
    hotSpot3PrizeSchemeId: s.hotSpot3PrizeSchemeId ? String(s.hotSpot3PrizeSchemeId) : "",
    hotSpotAvgPrizeSchemeId: s.hotSpotAvgPrizeSchemeId ? String(s.hotSpotAvgPrizeSchemeId) : "",
  };
}

interface SeasonSettingsCardProps {
  eventId: string;
  feeSchemes: FeeScheme[];
  prizeSchemes: PrizeScheme[];
  bettingSchemes: BettingScheme[];
}

function SeasonSettingsCard({ eventId, feeSchemes, prizeSchemes, bettingSchemes }: SeasonSettingsCardProps) {
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);
  const [seasonForm, setSeasonForm] = useState<SeasonForm>(emptySF());
  const [saving, setSaving] = useState(false);
  const [newSeasonOpen, setNewSeasonOpen] = useState(false);
  const [newForm, setNewForm] = useState<SeasonForm>({ ...emptySF(), name: "Season" });
  const [creatingNew, setCreatingNew] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["seasons", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/event/${eventId}/seasons`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch seasons");
      return res.json() as Promise<{ seasons: Season[]; activeSeasonId: number | null }>;
    },
    staleTime: 30_000,
  });

  const seasons = data?.seasons ?? [];

  const handleSeasonSelect = (id: string) => {
    const sid = parseInt(id);
    setSelectedSeasonId(sid);
    const s = seasons.find((x) => x.id === sid);
    if (s) setSeasonForm(seasonToForm(s));
  };

  const handleSaveSeason = async () => {
    if (!selectedSeasonId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/event/${eventId}/seasons/${selectedSeasonId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: seasonForm.name,
          startDate: seasonForm.startDate,
          endDate: seasonForm.endDate,
          feeSchemeId: seasonForm.feeSchemeId || null,
          bettingSchemeId: seasonForm.bettingSchemeId || null,
          finalPrizeSchemeId: seasonForm.finalPrizeSchemeId || null,
          hotSpot1PrizeSchemeId: seasonForm.hotSpot1PrizeSchemeId || null,
          hotSpot2PrizeSchemeId: seasonForm.hotSpot2PrizeSchemeId || null,
          hotSpot3PrizeSchemeId: seasonForm.hotSpot3PrizeSchemeId || null,
          hotSpotAvgPrizeSchemeId: seasonForm.hotSpotAvgPrizeSchemeId || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Season updated");
      refetch();
    } catch {
      toast.error("Failed to update season");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLastSchemes = () => {
    const last = seasons[0]; // ordered by startDate desc
    if (!last) return;
    setNewForm((f) => ({
      ...f,
      feeSchemeId: last.feeSchemeId ? String(last.feeSchemeId) : f.feeSchemeId,
      bettingSchemeId: last.bettingSchemeId ? String(last.bettingSchemeId) : f.bettingSchemeId,
      finalPrizeSchemeId: last.finalPrizeSchemeId ? String(last.finalPrizeSchemeId) : f.finalPrizeSchemeId,
      hotSpot1PrizeSchemeId: last.hotSpot1PrizeSchemeId ? String(last.hotSpot1PrizeSchemeId) : f.hotSpot1PrizeSchemeId,
      hotSpot2PrizeSchemeId: last.hotSpot2PrizeSchemeId ? String(last.hotSpot2PrizeSchemeId) : f.hotSpot2PrizeSchemeId,
      hotSpot3PrizeSchemeId: last.hotSpot3PrizeSchemeId ? String(last.hotSpot3PrizeSchemeId) : f.hotSpot3PrizeSchemeId,
      hotSpotAvgPrizeSchemeId: last.hotSpotAvgPrizeSchemeId ? String(last.hotSpotAvgPrizeSchemeId) : f.hotSpotAvgPrizeSchemeId,
    }));
  };

  const handleCreateSeason = async () => {
    if (!newForm.name || !newForm.startDate || !newForm.endDate) {
      toast.error("Name, start date, and end date are required");
      return;
    }
    setCreatingNew(true);
    try {
      const res = await fetch(`/api/admin/event/${eventId}/seasons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: newForm.name,
          startDate: newForm.startDate,
          endDate: newForm.endDate,
          feeSchemeId: newForm.feeSchemeId || undefined,
          bettingSchemeId: newForm.bettingSchemeId || undefined,
          finalPrizeSchemeId: newForm.finalPrizeSchemeId || undefined,
          hotSpot1PrizeSchemeId: newForm.hotSpot1PrizeSchemeId || undefined,
          hotSpot2PrizeSchemeId: newForm.hotSpot2PrizeSchemeId || undefined,
          hotSpot3PrizeSchemeId: newForm.hotSpot3PrizeSchemeId || undefined,
          hotSpotAvgPrizeSchemeId: newForm.hotSpotAvgPrizeSchemeId || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Season created");
      setNewSeasonOpen(false);
      setNewForm({ ...emptySF(), name: "Season" });
      refetch();
    } catch {
      toast.error("Failed to create season");
    } finally {
      setCreatingNew(false);
    }
  };

  const sf = seasonForm;
  const setSF = (patch: Partial<SeasonForm>) => setSeasonForm({ ...sf, ...patch });
  const nf = newForm;
  const setNF = (patch: Partial<SeasonForm>) => setNewForm({ ...nf, ...patch });

  const SchemeSelects = ({
    form,
    onChange,
  }: {
    form: SeasonForm;
    onChange: (patch: Partial<SeasonForm>) => void;
  }) => (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Fee Scheme</Label>
          <Select value={form.feeSchemeId} onValueChange={(v) => onChange({ feeSchemeId: v })}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select fee scheme" /></SelectTrigger>
            <SelectContent>
              {feeSchemes.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Betting Scheme</Label>
          <Select value={form.bettingSchemeId} onValueChange={(v) => onChange({ bettingSchemeId: v })}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select betting scheme" /></SelectTrigger>
            <SelectContent>
              {bettingSchemes.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Final Prize Scheme</Label>
        <Select value={form.finalPrizeSchemeId} onValueChange={(v) => onChange({ finalPrizeSchemeId: v })}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Select final prize scheme" /></SelectTrigger>
          <SelectContent>
            {prizeSchemes.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>HotSpot 1</Label>
          <Select value={form.hotSpot1PrizeSchemeId} onValueChange={(v) => onChange({ hotSpot1PrizeSchemeId: v })}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Optional" /></SelectTrigger>
            <SelectContent>
              {prizeSchemes.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>HotSpot 2</Label>
          <Select value={form.hotSpot2PrizeSchemeId} onValueChange={(v) => onChange({ hotSpot2PrizeSchemeId: v })}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Optional" /></SelectTrigger>
            <SelectContent>
              {prizeSchemes.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>HotSpot 3</Label>
          <Select value={form.hotSpot3PrizeSchemeId} onValueChange={(v) => onChange({ hotSpot3PrizeSchemeId: v })}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Optional" /></SelectTrigger>
            <SelectContent>
              {prizeSchemes.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>HotSpot Avg</Label>
          <Select value={form.hotSpotAvgPrizeSchemeId} onValueChange={(v) => onChange({ hotSpotAvgPrizeSchemeId: v })}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Optional" /></SelectTrigger>
            <SelectContent>
              {prizeSchemes.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    </>
  );

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Season Settings</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => { handleCopyLastSchemes(); setNewSeasonOpen(true); }}>
            New Season
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {seasons.length === 0 ? (
            <p className="text-sm text-muted-foreground">No seasons yet.</p>
          ) : (
            <>
              <div>
                <Label>Season</Label>
                <Select value={selectedSeasonId ? String(selectedSeasonId) : ""} onValueChange={handleSeasonSelect}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select a season" /></SelectTrigger>
                  <SelectContent>
                    {seasons.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name} ({new Date(s.startDate).getFullYear()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedSeasonId && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Season Name</Label>
                      <Input value={sf.name} onChange={(e) => setSF({ name: e.target.value })} />
                    </div>
                    <div />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Start Date</Label>
                      <Input type="date" value={sf.startDate} onChange={(e) => setSF({ startDate: e.target.value })} />
                    </div>
                    <div>
                      <Label>End Date</Label>
                      <Input type="date" value={sf.endDate} onChange={(e) => setSF({ endDate: e.target.value })} />
                    </div>
                  </div>
                  <SchemeSelects form={sf} onChange={setSF} />
                  <div className="flex justify-end">
                    <Button type="button" onClick={handleSaveSeason} disabled={saving}>
                      {saving ? "Saving..." : "Save Season"}
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={newSeasonOpen} onOpenChange={setNewSeasonOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Season</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Season Name *</Label>
              <Input value={nf.name} onChange={(e) => setNF({ name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date *</Label>
                <Input type="date" value={nf.startDate} onChange={(e) => setNF({ startDate: e.target.value })} />
              </div>
              <div>
                <Label>End Date *</Label>
                <Input type="date" value={nf.endDate} onChange={(e) => setNF({ endDate: e.target.value })} />
              </div>
            </div>
            <SchemeSelects form={nf} onChange={setNF} />
            <div className="flex gap-2 justify-end pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setNewSeasonOpen(false)}>Cancel</Button>
              <Button type="button" onClick={handleCreateSeason} disabled={creatingNew}>
                {creatingNew ? "Creating..." : "Create Season"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
