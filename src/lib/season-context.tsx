"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

export type Season = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
};

interface SeasonContextValue {
  selectedSeasonId: number | null;
  setSelectedSeasonId: (id: number) => void;
  seasons: Season[];
  activeSeason: Season | null;
  refetchSeasons: () => void;
}

const SeasonContext = createContext<SeasonContextValue>({
  selectedSeasonId: null,
  setSelectedSeasonId: () => {},
  seasons: [],
  activeSeason: null,
  refetchSeasons: () => {},
});

export function SeasonProvider({ eventId, children }: { eventId: string; children: ReactNode }) {
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);

  const { data, refetch } = useQuery({
    queryKey: ["seasons", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/event/${eventId}/seasons`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch seasons");
      return res.json() as Promise<{ seasons: Season[]; activeSeasonId: number | null }>;
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (data && selectedSeasonId === null) {
      setSelectedSeasonId(data.activeSeasonId ?? data.seasons[0]?.id ?? null);
    }
  }, [data, selectedSeasonId]);

  const seasons = data?.seasons ?? [];
  const activeSeason = seasons.find((s) => s.id === selectedSeasonId) ?? null;

  return (
    <SeasonContext.Provider value={{ selectedSeasonId, setSelectedSeasonId, seasons, activeSeason, refetchSeasons: refetch }}>
      {children}
    </SeasonContext.Provider>
  );
}

export function useSeasonContext() {
  return useContext(SeasonContext);
}
