"use client";

import { useListBreederEvents, useListLiveRaces } from "@/lib/api/breeder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image";
import Link from "next/link";
import { Calendar, Trophy, Radio, MapPin } from "lucide-react";
import type { Event, Race } from "@/lib/types";

interface EventWithRaces extends Event {
  races: Race[];
  _count: {
    races: number;
  };
}

interface RaceWithEvent {
  raceId: string;
  name: string;
  releaseStation: string;
  releaseDate: string;
  isLive: boolean;
  isClosed: boolean;
  event: {
    eventId: string;
    name: string;
    shortName: string | null;
    logoImage: string | null;
    bannerImage: string | null;
    isOpen: boolean;
  };
  _count: {
    raceItems: number;
  };
}

export default function Home() {
  const { data: eventsData, isPending: eventsLoading } = useListBreederEvents();
  const { data: liveRacesData, isPending: liveRacesLoading } = useListLiveRaces();

  const events = (eventsData?.events || []) as EventWithRaces[];
  const liveRaces = (liveRacesData?.races || []) as RaceWithEvent[];

  if (eventsLoading || liveRacesLoading) {
    return (
      <div className="container mx-auto p-6 space-y-8">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Events Section */}
      <section>
        <h2 className="text-2xl font-bold mb-4">All Events</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => {
            const liveRacesCount = event.races.filter((r) => r.isLive && !r.isClosed).length;
            
            return (
              <Card key={event.eventId} className="overflow-hidden hover:shadow-lg transition-shadow">
                {/* Banner Image */}
                <div className="relative h-48 bg-linear-to-br from-blue-500 to-purple-500">
                  {event.bannerImage ? (
                    <Image
                      src={event.bannerImage}
                      alt={event.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-4xl font-bold text-white opacity-50">
                        {event.name.substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                  )}
                  {/* Event Status Badge */}
                  <div className="absolute top-2 right-2">
                    <Badge variant={event.isOpen ? "default" : "secondary"}>
                      {event.isOpen ? "Open" : "Closed"}
                    </Badge>
                  </div>
                  {/* Live Indicator */}
                  {liveRacesCount > 0 && (
                    <div className="absolute top-2 left-2">
                      <Badge variant="destructive" className="gap-1">
                        <Radio className="h-3 w-3 animate-pulse" />
                        {liveRacesCount} Live
                      </Badge>
                    </div>
                  )}
                </div>

                <CardHeader>
                  <div className="flex items-start gap-3">
                    {/* Logo */}
                    {event.logoImage && (
                      <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-md shrink-0">
                        <Image
                          src={event.logoImage}
                          alt={event.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <CardTitle className="line-clamp-2">{event.name}</CardTitle>
                      {event.shortName && (
                        <p className="text-sm text-muted-foreground mt-1">{event.shortName}</p>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="space-y-3">
                    {/* Event Info */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {new Date(event.startDate).toLocaleDateString()}
                          {event.endDate && ` - ${new Date(event.endDate).toLocaleDateString()}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Trophy className="h-4 w-4 text-muted-foreground" />
                        <span>{event._count.races} Races</span>
                      </div>
                    </div>

                    {/* Description */}
                    {event.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {event.description}
                      </p>
                    )}

                    {/* Action Button */}
                    <Link
                      href={`/events/${event.eventId}`}
                      className="inline-block w-full text-center bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
                    >
                      View Details
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {events.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No events available at the moment</p>
          </div>
        )}
      </section>

      {/* Live Races Section */}
      {liveRaces.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Radio className="h-6 w-6 text-red-500 animate-pulse" />
            <h2 className="text-2xl font-bold">Live Races</h2>
          </div>
          
          <div className="space-y-3">
            {liveRaces.map((race) => (
              <Link key={race.raceId} href={`/races/${race.raceId}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {/* Event Logo */}
                      {race.event.logoImage ? (
                        <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-red-500 shrink-0">
                          <Image
                            src={race.event.logoImage}
                            alt={race.event.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-linear-to-br from-red-500 to-orange-500 flex items-center justify-center shrink-0">
                          <Radio className="h-8 w-8 text-white animate-pulse" />
                        </div>
                      )}

                      {/* Race Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-semibold line-clamp-1">{race.name}</h3>
                          <Badge variant="destructive" className="gap-1">
                            <Radio className="h-3 w-3" />
                            LIVE
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {race.event.shortName || race.event.name}
                        </p>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            <span>{race.releaseStation}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Trophy className="h-4 w-4" />
                            <span>{race._count.raceItems} Birds</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>{new Date(race.releaseDate).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* View Arrow */}
                      <div className="shrink-0">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-6 w-6 text-muted-foreground"
                        >
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
