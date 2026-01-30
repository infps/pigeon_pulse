"use client";

import { useParams } from "next/navigation";
import { useApiQuery } from "@/hooks/useApi";
import { apiEndpoints } from "@/lib/endpoints";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { raceResultsColumns } from "./race-results-columns";
import type { Race, RaceItem } from "@/lib/types";
import Image from "next/image";

export default function PublicRacePage() {
  const params = useParams();
  const raceId = params?.raceId as string;

  const { data: raceData, isPending: raceLoading } = useApiQuery({
    endpoint: apiEndpoints.breeder.races,
    queryKey: ["breeder", "races", "detail", raceId],
    params: { raceId },
  });

  const { data: raceItemsData, isPending: raceItemsLoading } = useApiQuery({
    endpoint: apiEndpoints.breeder.raceItems(raceId),
    queryKey: ["breeder", "raceItems", raceId],
  });

  if (raceLoading || raceItemsLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const race = raceData?.race as Race;
  const raceItems = (raceItemsData?.raceItems || []) as RaceItem[];

  if (!race) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12 text-red-500">
          <p>Race not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      {/* Race Header */}
      <Card>
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row gap-4 md:gap-6">
            {/* Event Logo */}
            <div className="flex-shrink-0">
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center overflow-hidden shadow-lg border-4 border-white">
                {race.event?.logoImage ? (
                  <Image
                    src={race.event.logoImage}
                    alt={race.event.name}
                    width={128}
                    height={128}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <span className="text-2xl md:text-3xl font-bold text-gray-600">
                    {race.name.substring(0, 3).toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            {/* Race Info */}
            <div className="flex-1 min-w-0">
              <div className="space-y-3">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                      {race.name}
                    </h1>
                    <Badge
                      variant={race.isClosed ? "secondary" : "default"}
                      className="text-sm"
                    >
                      {race.isClosed ? "Closed" : "Open"}
                    </Badge>
                    {race.isLive && (
                      <Badge
                        variant="destructive"
                        className="text-sm animate-pulse"
                      >
                        🔴 LIVE
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-sm md:text-base text-gray-600 font-medium">
                      {race.event?.name}
                    </span>
                    <Badge variant={race.isClosed ? "secondary" : "default"}>
                      {race.raceType?.name || "Race"}
                    </Badge>
                  </div>
                  <p className="text-sm md:text-base text-blue-600 mt-1">
                    Release Station:{" "}
                    <span className="font-medium">{race.releaseStation}</span>
                  </p>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4">
                  <div className="border rounded-lg p-2 md:p-3 bg-white text-center">
                    <div className="text-lg md:text-xl font-bold text-gray-900">
                      {new Date(race.releaseDate).toLocaleDateString()}
                    </div>
                    <div className="text-xs md:text-sm text-gray-600">
                      {new Date(race.releaseDate).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Release Date & Time
                    </div>
                  </div>
                  <div className="border rounded-lg p-2 md:p-3 bg-white text-center">
                    <div className="text-lg md:text-xl font-bold text-gray-900">
                      {race.distance}
                    </div>
                    <div className="text-xs md:text-sm text-gray-600">Mi</div>
                    <div className="text-xs text-gray-500 mt-1">Distance</div>
                  </div>
                  <div className="border rounded-lg p-2 md:p-3 bg-white text-center">
                    <div className="text-lg md:text-xl font-bold text-gray-900">
                      {raceItems.length}
                    </div>
                    <div className="text-xs md:text-sm text-gray-600">Birds</div>
                    <div className="text-xs text-gray-500 mt-1">Entered</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Race Results Table */}
      <Card>
        <CardHeader>
          <CardTitle>Race Results ({raceItems.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={raceResultsColumns}
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
  );
}
