"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import type { Event } from "@/lib/types";
import { Calendar, MapPin, Mail, Phone, Globe, Facebook, Twitter, Youtube, Instagram } from "lucide-react";

interface EventDetailsTabProps {
  event: Event;
}

export function EventDetailsTab({ event }: EventDetailsTabProps) {
  return (
    <div className="space-y-6">
      {/* Two Column Layout - Banner Left, Info Right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Banner */}
        {event.bannerImage && (
          <div className="relative w-full h-96 rounded-lg overflow-hidden">
            <Image
              src={event.bannerImage}
              alt={event.name}
              fill
              className="object-cover"
            />
          </div>
        )}

        {/* Right Column - Event Information */}
        <Card className="h-fit">
        <CardHeader>
          <CardTitle>Event Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Event Name</p>
              <p className="text-lg font-semibold">{event.name}</p>
            </div>
            {event.shortName && (
              <div>
                <p className="text-sm text-muted-foreground">Short Name</p>
                <p className="text-lg font-semibold">{event.shortName}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Type</p>
              <p className="text-lg font-semibold">{event.type?.name || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={event.isOpen ? "default" : "secondary"}>
                {event.isOpen ? "Open" : "Closed"}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Start Date
              </p>
              <p className="text-lg font-semibold">
                {new Date(event.startDate).toLocaleDateString()}
              </p>
            </div>
            {event.endDate && (
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  End Date
                </p>
                <p className="text-lg font-semibold">
                  {new Date(event.endDate).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
          {event.description && (
            <div>
              <p className="text-sm text-muted-foreground">Description</p>
              <p className="mt-1">{event.description}</p>
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      {/* Contact Information */}
      {(event.contactName || event.contactEmail || event.contactPhone || event.contactWebsite || event.contactAddress) && (
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {event.contactName && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{event.contactName}</span>
              </div>
            )}
            {event.contactEmail && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${event.contactEmail}`} className="text-blue-600 hover:underline">
                  {event.contactEmail}
                </a>
              </div>
            )}
            {event.contactPhone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${event.contactPhone}`} className="text-blue-600 hover:underline">
                  {event.contactPhone}
                </a>
              </div>
            )}
            {event.contactWebsite && (
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <a href={event.contactWebsite} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  {event.contactWebsite}
                </a>
              </div>
            )}
            {event.contactAddress && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{event.contactAddress}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Social Media */}
      {(event.socialYt || event.socialFb || event.socialTwitter || event.socialInsta) && (
        <Card>
          <CardHeader>
            <CardTitle>Social Media</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {event.socialYt && (
              <div className="flex items-center gap-2">
                <Youtube className="h-4 w-4 text-red-600" />
                <a href={event.socialYt} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  YouTube
                </a>
              </div>
            )}
            {event.socialFb && (
              <div className="flex items-center gap-2">
                <Facebook className="h-4 w-4 text-blue-600" />
                <a href={event.socialFb} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  Facebook
                </a>
              </div>
            )}
            {event.socialTwitter && (
              <div className="flex items-center gap-2">
                <Twitter className="h-4 w-4 text-sky-500" />
                <a href={event.socialTwitter} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  Twitter
                </a>
              </div>
            )}
            {event.socialInsta && (
              <div className="flex items-center gap-2">
                <Instagram className="h-4 w-4 text-pink-600" />
                <a href={event.socialInsta} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  Instagram
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
