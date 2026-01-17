"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useApiQuery } from "@/hooks/useApi";
import { useApiMutation } from "@/hooks/useApiMutation";
import { apiEndpoints } from "@/lib/endpoints";
import { useListRaceItems } from "@/lib/api/race-items";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { BasketTabs } from "./basket-tabs";
import { BasketRaceItemsDialog } from "./basket-race-items-dialog";
import { raceItemsColumns } from "./race-items-columns";
import { getWeatherIcon } from "@/lib/weather-constants";
import type { Race, Event, RaceItem } from "@/lib/types";
import type { RowSelectionState } from "@tanstack/react-table";
import Image from "next/image";
import { Package, Play } from "lucide-react";
import { toast } from "sonner";

export default function RaceDetailsPage() {
  const params = useParams();
  const eventId = params?.eventId as string;
  const raceId = params?.raceId as string;

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [basketDialogOpen, setBasketDialogOpen] = useState(false);

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

  // Start race mutation
  const { mutate: startRace, isPending: isStartingRace } = useApiMutation({
    method: "POST",
    endpoint: apiEndpoints.races.start(raceId),
    onSuccess: () => {
      toast.success("Race started successfully!");
    },
    onError: (error) => {
      toast.error(error?.message || "Failed to start race");
    },
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

  const race = raceData?.race as Race;
  const event = eventData?.event as Event;
  const raceItems = (raceItemsData?.raceItems || []) as RaceItem[];
  
  // Get selected race items
  const selectedRaceItems = raceItems.filter((_, index) => rowSelection[index]);

  const handleBasketSuccess = () => {
    setRowSelection({});
  };

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
    <div className="w-full p-4 md:p-6 space-y-4 max-w-[100vw] overflow-x-hidden">
      {/* Compact Race Header */}
      <Card className="overflow-hidden">
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row gap-4 md:gap-6">
            {/* Event Logo */}
            <div className="flex-shrink-0">
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center overflow-hidden shadow-lg border-4 border-white">
                {event.logoImage ? (
                  <Image
                    src={event.logoImage}
                    alt={event.name}
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
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{race.name}</h1>
                    <Badge variant={race.isClosed ? "secondary" : "default"} className="text-sm">
                      {race.isClosed ? "Closed" : "Open"}
                    </Badge>
                    {race.isLive && (
                      <Badge variant="destructive" className="text-sm animate-pulse">
                        🔴 LIVE
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-sm md:text-base text-gray-600 font-medium">{event.name}</span>
                    <Badge variant={race.isClosed ? "secondary" : "default"}>
                      {race.raceType?.name || "Race"}
                    </Badge>
                    {!race.isLive && !race.isClosed && (
                      <Button
                        onClick={() => startRace({})}
                        disabled={isStartingRace}
                        size="sm"
                        className="gap-2 bg-green-600 hover:bg-green-700"
                      >
                        <Play className="h-4 w-4" />
                        {isStartingRace ? "Starting..." : "Start Race"}
                      </Button>
                    )}
                  </div>
                  <p className="text-sm md:text-base text-blue-600 mt-1">
                    Release Station: <span className="font-medium">{race.releaseStation}</span>
                  </p>
                </div>

                {/* Weather & Conditions - Compact Layout */}
                <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
                  {/* Release Conditions */}
                  <div className="flex flex-wrap items-center gap-3 text-sm md:text-base">
                    <div className="flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 md:w-5 md:h-5 text-gray-600">
                        <path d="M14 18V6a4 4 0 0 0-8 0v12"/>
                        <path d="M10 2v4"/>
                        <path d="M10 18h4"/>
                        <path d="M10 22v-4"/>
                        <path d="M14 6h4"/>
                      </svg>
                    </div>
                    {race.releaseWeather && (
                      <div className="flex items-center gap-1.5">
                        {getWeatherIcon(race.releaseWeather)}
                        <span className="text-gray-700">{race.releaseWeather}</span>
                      </div>
                    )}
                    {race.releaseTemperature && (
                      <div className="flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-orange-500">
                          <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/>
                        </svg>
                        <span className="font-medium text-gray-900">{race.releaseTemperature}°F</span>
                      </div>
                    )}
                    {race.releaseWind && (
                      <div className="flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-blue-500">
                          <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/>
                          <path d="M9.6 4.6A2 2 0 1 1 11 8H2"/>
                          <path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>
                        </svg>
                        <span className="text-gray-700">{race.releaseWind}</span>
                      </div>
                    )}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-blue-600">
                      <path d="m3 8 4-4 4 4"/>
                      <path d="M7 4v16"/>
                      <path d="M11 12h4"/>
                      <path d="M11 16h7"/>
                      <path d="M11 20h10"/>
                    </svg>
                  </div>

                  {/* Arrival Conditions */}
                  <div className="flex flex-wrap items-center gap-3 text-sm md:text-base">
                    <div className="flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 md:w-5 md:h-5 text-gray-600">
                        <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/>
                        <path d="M3 9V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4"/>
                        <path d="M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6"/>
                      </svg>
                    </div>
                    {race.arrivalWeather && (
                      <div className="flex items-center gap-1.5">
                        {getWeatherIcon(race.arrivalWeather)}
                        <span className="text-gray-700">{race.arrivalWeather}</span>
                      </div>
                    )}
                    {race.arrivalTemperature && (
                      <div className="flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-orange-500">
                          <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/>
                        </svg>
                        <span className="font-medium text-gray-900">{race.arrivalTemperature}°F</span>
                      </div>
                    )}
                    {race.arrivalWind && (
                      <div className="flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-blue-500">
                          <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/>
                          <path d="M9.6 4.6A2 2 0 1 1 11 8H2"/>
                          <path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>
                        </svg>
                        <span className="text-gray-700">{race.arrivalWind}</span>
                      </div>
                    )}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-blue-600">
                      <path d="m3 8 4-4 4 4"/>
                      <path d="M7 4v16"/>
                      <path d="M11 12h4"/>
                      <path d="M11 16h7"/>
                      <path d="M11 20h10"/>
                    </svg>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4">
                  <div className="border rounded-lg p-2 md:p-3 bg-white text-center">
                    <div className="text-lg md:text-xl font-bold text-gray-900">
                      {new Date(race.releaseDate).toLocaleDateString()}
                    </div>
                    <div className="text-xs md:text-sm text-gray-600">
                      {new Date(race.releaseDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Release Date & Time</div>
                  </div>
                  <div className="border rounded-lg p-2 md:p-3 bg-white text-center">
                    <div className="text-lg md:text-xl font-bold text-gray-900">{race.distance}</div>
                    <div className="text-xs md:text-sm text-gray-600">Mi</div>
                    <div className="text-xs text-gray-500 mt-1">Distance</div>
                  </div>
                  <div className="border rounded-lg p-2 md:p-3 bg-white text-center">
                    <div className="text-lg md:text-xl font-bold text-gray-900">
                      {new Date(race.sunriseTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="text-xs md:text-sm text-gray-600">
                      {new Date(race.sunsetTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Sunrise / Sunset</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[70%_30%] gap-4 md:gap-6">
        {/* Left Side */}
        <div className="space-y-4 md:space-y-6 min-w-0">

          {/* Race Items Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Race Items ({raceItems.length})</CardTitle>
              {selectedRaceItems.length > 0 && (
                <Button
                  onClick={() => setBasketDialogOpen(true)}
                  size="sm"
                  className="gap-2"
                >
                  <Package className="h-4 w-4" />
                  Basket ({selectedRaceItems.length})
                </Button>
              )}
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <DataTable
                columns={raceItemsColumns}
                data={raceItems}
                filterableColumns={[
                  { id: "band", title: "Band" },
                  { id: "birdName", title: "Bird Name" },
                  { id: "breeder", title: "Breeder" },
                ]}
                rowSelection={rowSelection}
                onRowSelectionChange={setRowSelection}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Side - 30% */}
        <div className="min-w-0">
          <BasketTabs raceId={raceId} />
        </div>
      </div>

      {/* Basket Dialog */}
      <BasketRaceItemsDialog
        open={basketDialogOpen}
        onOpenChange={setBasketDialogOpen}
        selectedItems={selectedRaceItems}
        raceId={raceId}
        onSuccess={handleBasketSuccess}
      />
    </div>
  );
}
