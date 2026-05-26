"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, MapPin, Radio } from "lucide-react";
import type { Event, Race } from "@/lib/types";

interface EventResultTabProps {
  event: Event;
  eventId: string;
}

function isTraining(r: Race): boolean {
  return (r.raceType?.name ?? "").toUpperCase() === "T";
}

function RaceList({ races }: { races: Race[] }) {
  if (races.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground">
          No races in this category.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {races.map((race) => (
        <Link key={race.id} href={`/races/${race.id}`}>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h4 className="text-lg font-semibold line-clamp-1">
                      {race.description ?? race.name ?? "Race"}
                    </h4>
                    {race.status === "STARTED" && (
                      <Badge variant="destructive" className="gap-1">
                        <Radio className="h-3 w-3 animate-pulse" /> LIVE
                      </Badge>
                    )}
                    {race.status === "ENDED" && (
                      <Badge variant="secondary">Ended</Badge>
                    )}
                    {race.raceType?.name && (
                      <Badge variant="outline" className="text-xs">
                        {race.raceType.name}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    {race.startTime && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(race.startTime).toLocaleString()}
                      </span>
                    )}
                    {race.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {race.location}
                      </span>
                    )}
                    {race.distance != null && (
                      <span>{race.distance} mi</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export function EventResultTab({ event }: EventResultTabProps) {
  const races = (event.races || []) as Race[];
  const trainingRaces = useMemo(() => races.filter(isTraining), [races]);
  const competitionRaces = useMemo(() => races.filter((r) => !isTraining(r)), [races]);

  return (
    <Tabs defaultValue="races" className="w-full">
      <TabsList>
        <TabsTrigger value="races">Races ({competitionRaces.length})</TabsTrigger>
        <TabsTrigger value="training">Training ({trainingRaces.length})</TabsTrigger>
        <TabsTrigger value="average">Average</TabsTrigger>
      </TabsList>

      <TabsContent value="races" className="mt-4">
        <RaceList races={competitionRaces} />
      </TabsContent>

      <TabsContent value="training" className="mt-4">
        <RaceList races={trainingRaces} />
      </TabsContent>

      <TabsContent value="average" className="mt-4">
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <p>Bird-level average speed leaderboard (Long / Sprint).</p>
            <p className="text-xs mt-2">Endpoint pending — coming next.</p>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
