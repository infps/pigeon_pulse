import { useQuery } from "@tanstack/react-query";

export interface Station {
  id: number;
  eventId: number;
  name: string;
  miles: number | null;
  km: number | null;
  latitude: number | null;
  longitude: number | null;
  isActive: boolean;
  stationRaceTypes: { raceTypeId: number; raceType: { id: number; name: string | null; color: string | null } }[];
  createdAt: string;
  updatedAt: string;
}

export function useStations(eventId: string) {
  return useQuery<{ stations: Station[] }>({
    queryKey: ["admin", "stations", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/event/${eventId}/stations`);
      if (!res.ok) throw new Error("Failed to load stations");
      return res.json();
    },
  });
}
