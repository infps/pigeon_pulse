"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Calendar, MapPin, Radio } from "lucide-react";
import type { Event, Race } from "@/lib/types";

interface EventRacesTabProps {
  event: Event;
  eventId: string;
}

export function EventRacesTab({ event }: EventRacesTabProps) {
  const races = (event.races || []) as Race[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Races ({races.length})</h3>
      </div>

      {races.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            No races scheduled yet
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {races.map((race) => (
            <Link key={race.raceId} href={`/races/${race.raceId}`}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-lg font-semibold line-clamp-1">{race.name}</h4>
                        {race.isLive && !race.isClosed && (
                          <Badge variant="destructive" className="gap-1">
                            <Radio className="h-3 w-3 animate-pulse" />
                            LIVE
                          </Badge>
                        )}
                        {race.isClosed && (
                          <Badge variant="secondary">Closed</Badge>
                        )}
                        {!race.isClosed && !race.isLive && (
                          <Badge variant="default">Open</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          <span>{race.releaseStation}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {new Date(race.releaseDate).toLocaleDateString()} at{" "}
                            {new Date(race.releaseDate).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline">{race.raceType?.name || "Race"}</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
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
      )}
    </div>
  );
}
