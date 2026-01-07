"use client";

import { useParams } from "next/navigation";
import { useApiQuery } from "@/hooks/useApi";
import { apiEndpoints } from "@/lib/endpoints";
import { useListRaceItems } from "@/lib/api/race-items";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { BasketTabs } from "./basket-tabs";
import { raceItemsColumns } from "./race-items-columns";
import type { Race, Event, RaceItem } from "@/lib/types";

export default function RaceDetailsPage() {
  const params = useParams();
  const eventId = params?.eventId as string;
  const raceId = params?.raceId as string;

  // Fetch race details
  const { data: raceData, isPending: raceLoading } = useApiQuery({
    endpoint: apiEndpoints.races.base,
    queryKey: ["races", "detail", raceId],
    params: { raceId },
  });

  // Fetch event details
  const { data: eventData, isPending: eventLoading } = useApiQuery({
    endpoint: apiEndpoints.events.base,
    queryKey: ["events", "detail", eventId],
    params: { eventId },
  });

  // Fetch race items
  const { data: raceItemsData, isPending: raceItemsLoading } = useListRaceItems({
    params: { raceId },
  });

  if (raceLoading || eventLoading || raceItemsLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-[70%_30%] gap-6">
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
          <div>
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    );
  }

  const race = raceData?.race as Race | undefined;
  const event = eventData?.event as Event | undefined;
  const raceItems = (raceItemsData?.raceItems || []) as RaceItem[];

  if (!race || !event) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12 text-red-500">
          <p>Race or Event not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{race.name}</h1>
        <p className="text-muted-foreground">{event.name}</p>
      </div>

      {/* Main Layout: 70% - 30% */}
      <div className="grid grid-cols-1 lg:grid-cols-[70%_30%] gap-6">
        {/* Left Side - 70% */}
        <div className="space-y-6">
          {/* Race Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>Race Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Race Type
                  </label>
                  <p className="text-base">{race.raceType?.name || "-"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Status
                  </label>
                  <div>
                    <Badge variant={race.isClosed ? "secondary" : "default"}>
                      {race.isClosed ? "Closed" : "Open"}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Distance
                  </label>
                  <p className="text-base">{race.distance} miles</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Release Station
                  </label>
                  <p className="text-base">{race.releaseStation}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Release Date
                  </label>
                  <p className="text-base">
                    {new Date(race.releaseDate).toLocaleString()}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Sunrise Time
                  </label>
                  <p className="text-base">
                    {new Date(race.sunriseTime).toLocaleTimeString()}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Sunset Time
                  </label>
                  <p className="text-base">
                    {new Date(race.sunsetTime).toLocaleTimeString()}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Arrival Temperature
                  </label>
                  <p className="text-base">
                    {race.arrivalTemperature ? `${race.arrivalTemperature}°` : "-"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Arrival Wind
                  </label>
                  <p className="text-base">{race.arrivalWind || "-"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Arrival Weather
                  </label>
                  <p className="text-base">{race.arrivalWeather || "-"}</p>
                </div>
              </div>
              {race.description && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Description
                  </label>
                  <p className="text-base">{race.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Race Items Table */}
          <Card>
            <CardHeader>
              <CardTitle>Race Items ({raceItems.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={raceItemsColumns}
                data={raceItems}
                filterableColumns={[
                  { id: "band", title: "Band" },
                  { id: "birdName", title: "Bird Name" },
                  { id: "breeder", title: "Breeder" },
                ]}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Side - 30% */}
        <div>
          <BasketTabs raceId={raceId} />
        </div>
      </div>
    </div>
  );
}
