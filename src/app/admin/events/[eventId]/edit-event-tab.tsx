"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useUpdateEvent } from "@/lib/api/events";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUploadWithCrop } from "@/components/image-upload-with-crop";
import type { BettingScheme, Event, EventType, FeeScheme, PrizeScheme } from "@/lib/types";

interface EditEventTabProps {
  event: Event;
  eventId: string;
  eventTypes: EventType[];
  feeSchemes: FeeScheme[];
  prizeSchemes: PrizeScheme[];
  bettingSchemes: BettingScheme[];
}

export function EditEventTab({
  event,
  eventId,
  eventTypes,
  feeSchemes,
  prizeSchemes,
  bettingSchemes,
}: EditEventTabProps) {
  const [logoImageFile, setLogoImageFile] = useState<File | null>(null);
  const [bannerImageFile, setBannerImageFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    name: event.name,
    shortName: event.shortName || "",
    description: event.description || "",
    startDate: new Date(event.startDate).toISOString().split("T")[0],
    endDate: event.endDate ? new Date(event.endDate).toISOString().split("T")[0] : "",
    isOpen: event.isOpen,
    typeId: event.typeId,
    feeSchemeId: event.feeSchemeId,
    prizeSchemeId: event.prizeSchemeId,
    bettingSchemeId: event.bettingSchemeId,
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

  const updateMutation = useUpdateEvent({});

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
              {eventTypes.map((type) => (
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
              {feeSchemes.map((scheme) => (
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
              {prizeSchemes.map((scheme) => (
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
              {bettingSchemes.map((scheme) => (
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
