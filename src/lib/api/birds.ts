import { useApiQuery } from "@/hooks/useApi";
import { apiEndpoints } from "../endpoints";

export type BirdLocationStatus = "LOST" | "ARRIVED" | "BASKETED" | "HELD";

export interface BirdLocation {
  status: BirdLocationStatus;
  label: string;
  eventName?: string;
  raceName?: string;
  basketLabel?: string;
  phase?: "LOFT" | "RACE";
  since?: string;
}

export type BirdHistoryEntryType =
  | "REGISTERED"
  | "BASKETED"
  | "RELEASED"
  | "ARRIVED"
  | "FOREIGN_BIRD"
  | "LOST";

export interface BirdHistoryEntry {
  type: BirdHistoryEntryType;
  date: string;
  eventId?: number;
  eventName?: string;
  raceId?: number;
  raceName?: string;
  basketLabel?: string;
  phase?: "LOFT" | "RACE";
  position?: number;
  prizeValue?: number;
}

export function useBirdLocation(birdId: number | string) {
  return useApiQuery({
    endpoint: apiEndpoints.birds.location(birdId),
    queryKey: ["bird", "location", String(birdId)],
    enabled: !!birdId,
  });
}

export function useBirdHistory(birdId: number | string) {
  return useApiQuery({
    endpoint: apiEndpoints.birds.history(birdId),
    queryKey: ["bird", "history", String(birdId)],
    enabled: !!birdId,
  });
}
