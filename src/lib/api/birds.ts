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

export interface BirdFlight {
  raceId: number;
  eventId?: number;
  raceName?: string;
  raceTypeName: string | null;
  isTraining: boolean;
  date?: string;
  miles?: number;
  status: "RELEASED" | "ARRIVED" | "FOREIGN_BIRD" | "STRAY" | "LOST";
  position?: number;
  fieldSize?: number;
  arrivalTime?: string;
  flightTimeMs?: number;
  ypm?: number;
  toWinMs?: number;
  prizeValue?: number;
}

export interface BirdTransfer {
  fromBreederName: string;
  transferredAt: string;
  eventName?: string;
}

export interface BirdHistoryResponse {
  entries: BirdHistoryEntry[];
  birdInfo: {
    band: string;
    loftName: string;
    breederName: string;
    loftImage: string | null;
    eligible: boolean;
    breederId: number | null;
    color: string | null;
    sex: number | null;
    birdName: string | null;
  };
  flights: BirdFlight[];
  transfers: BirdTransfer[];
  prizeTotal: number;
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
