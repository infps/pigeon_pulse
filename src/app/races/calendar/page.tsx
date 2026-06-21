"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RaceCalendar, type CalendarRace } from "@/components/race-calendar";

export default function GlobalRaceCalendarPage() {
  const router = useRouter();
  const { data, isPending, isError } = useQuery<{ races: CalendarRace[] }>({
    queryKey: ["breeder", "races", "calendar"],
    queryFn: async () => {
      const res = await fetch("/api/breeder/races/calendar");
      if (!res.ok) throw new Error("Failed to load calendar");
      return res.json();
    },
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <Button variant="ghost" onClick={() => router.push("/races")} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Live Races
        </Button>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-blue-600" />
          <h1 className="text-2xl font-bold">Race Calendar</h1>
        </div>
      </div>

      {isPending ? (
        <Skeleton className="h-96 w-full" />
      ) : isError ? (
        <p className="text-red-500 text-center py-8">Failed to load calendar.</p>
      ) : (
        <RaceCalendar races={data?.races ?? []} showEventName />
      )}
    </div>
  );
}
