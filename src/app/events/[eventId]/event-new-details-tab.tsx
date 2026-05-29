"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Event } from "@/lib/types";
import {
  CheckCircle2,
  Facebook,
  Globe,
  ImageIcon,
  Instagram,
  Mail,
  MapPin,
  Phone,
  Twitter,
  User,
  Youtube,
} from "lucide-react";

interface EventDetailsTabProps {
  event: Event;
  stats?: { breeders: number; birds: number; races: number };
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function EventDetailsTab({ event, stats }: EventDetailsTabProps) {
  const isActive = event.isOpen === 1;
  const breederCount = stats?.breeders ?? event.eventInventories?.length ?? 0;
  const birdCount = stats?.birds ?? 0;
  const raceCount = stats?.races ?? event.races?.length ?? 0;
  const year = event.eventDate ? new Date(event.eventDate).getFullYear() : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-3xl font-bold">{event.name}</h1>
          <CheckCircle2 className="h-6 w-6 text-blue-500 fill-blue-100" />
        </div>
        <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground flex-wrap">
          {event.contactName && (
            <span className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              {event.contactName}
            </span>
          )}
          {event.contactPhone && (
            <span className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              {event.contactPhone}
            </span>
          )}
          {event.contactWebsite && (
            <a
              href={event.contactWebsite}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-primary transition-colors"
            >
              <Globe className="h-3.5 w-3.5" />
              {event.contactWebsite.replace(/^https?:\/\//, "")}
            </a>
          )}
        </div>
      </div>

      {/* Main 2-col layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Event Overview */}
        <Card className="lg:col-span-2">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Event Overview</h2>
              <Badge
                variant="outline"
                className={
                  isActive
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-gray-50 text-gray-600 border-gray-200"
                }
              >
                {isActive ? "✦ Active" : "Closed"}
              </Badge>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Location</p>
                <p className="text-sm font-semibold leading-tight line-clamp-2">
                  {event.contactAddress || "—"}
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Race Date</p>
                <p className="text-sm font-semibold leading-tight">
                  {formatDate(event.eventDate)}
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">End Date</p>
                <p className="text-sm font-semibold leading-tight">
                  {formatDate(event.endDate)}
                </p>
              </div>
            </div>

            <Separator />

            {/* Contact list */}
            <div className="space-y-4">
              {event.contactName && (
                <div className="flex items-start gap-3">
                  <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{event.contactName}</p>
                    <p className="text-xs text-muted-foreground">Contact Name</p>
                  </div>
                </div>
              )}
              {event.contactPhone && (
                <div className="flex items-start gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <a
                      href={`tel:${event.contactPhone}`}
                      className="text-sm font-medium hover:text-primary"
                    >
                      {event.contactPhone}
                    </a>
                    <p className="text-xs text-muted-foreground">Primary Phone</p>
                  </div>
                </div>
              )}
              {event.contactEmail && (
                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <a
                      href={`mailto:${event.contactEmail}`}
                      className="text-sm font-medium text-blue-500 hover:underline"
                    >
                      {event.contactEmail}
                    </a>
                    <p className="text-xs text-muted-foreground">Email</p>
                  </div>
                </div>
              )}
              {event.contactWebsite && (
                <div className="flex items-start gap-3">
                  <Globe className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <a
                      href={event.contactWebsite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-500 hover:underline"
                    >
                      {event.contactWebsite.replace(/^https?:\/\//, "")}
                    </a>
                    <p className="text-xs text-muted-foreground">Website</p>
                  </div>
                </div>
              )}
              {event.contactAddress && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{event.contactAddress}</p>
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(event.contactAddress)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline"
                    >
                      Open In Maps
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Social */}
            {(event.socialYt ||
              event.socialFb ||
              event.socialInsta ||
              event.socialTwitter) && (
              <>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3">
                    Social
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {event.socialYt && (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                      >
                        <a
                          href={event.socialYt}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Youtube className="h-3.5 w-3.5" />
                          YouTube
                        </a>
                      </Button>
                    )}
                    {event.socialFb && (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                      >
                        <a
                          href={event.socialFb}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Facebook className="h-3.5 w-3.5" />
                          facebook
                        </a>
                      </Button>
                    )}
                    {event.socialInsta && (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="gap-1.5 text-pink-600 border-pink-200 hover:bg-pink-50 hover:text-pink-700"
                      >
                        <a
                          href={event.socialInsta}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Instagram className="h-3.5 w-3.5" />
                          Instagram
                        </a>
                      </Button>
                    )}
                    {event.socialTwitter && (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="gap-1.5 text-gray-800 border-gray-200 hover:bg-gray-50"
                      >
                        <a
                          href={event.socialTwitter}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Twitter className="h-3.5 w-3.5" />
                          X-Twitter
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Right: Banner + About */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <h2 className="text-xl font-semibold">Our Facility</h2>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground gap-1.5 text-xs"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                Latest Photo
              </Button>
            </div>
            {event.bannerImage ? (
              <div className="relative h-64 w-full">
                <img
                  src={event.bannerImage}
                  alt={event.name ?? "Event banner"}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/70 via-black/20 to-transparent p-5">
                  <p className="text-white font-bold text-lg leading-tight">
                    {event.name}
                  </p>
                  {event.contactAddress && (
                    <p className="text-white/80 text-sm mt-0.5">
                      {event.contactAddress}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-64 bg-muted flex items-center justify-center border-t">
                <div className="text-center text-muted-foreground">
                  <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No banner image</p>
                </div>
              </div>
            )}
          </Card>

          {event.description && (
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-3">About the Event</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {event.description}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Season at a Glance */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-lg font-semibold">Season at a Glance</h3>
            {year && (
              <span className="text-muted-foreground text-sm">({year})</span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-muted/50 rounded-lg p-5 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                Breeders
              </p>
              <p className="text-4xl font-bold">{breederCount}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-5 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                Active Birds
              </p>
              <p className="text-4xl font-bold">{birdCount}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-5 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                Total Races
              </p>
              <p className="text-4xl font-bold">{raceCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
