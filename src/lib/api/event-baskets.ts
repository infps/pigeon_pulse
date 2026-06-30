import { useApiQuery } from "@/hooks/useApi";
import { useApiMutation } from "@/hooks/useApiMutation";
import { apiEndpoints } from "../endpoints";

export function useCheckinStatus(eventId: string | number) {
  return useApiQuery({
    endpoint: apiEndpoints.eventBaskets.checkinStatus(eventId),
    queryKey: ["checkin-status", String(eventId)],
    enabled: !!eventId,
  });
}

export function useCheckinBird(eventId: string | number) {
  return useApiMutation({
    method: "POST",
    endpoint: apiEndpoints.eventBaskets.checkin(eventId),
    queryKey: ["checkin-status"],
    exact: false,
  });
}

export function useUncheckBird(eventId: string | number) {
  return useApiMutation({
    method: "DELETE",
    endpoint: apiEndpoints.eventBaskets.checkin(eventId),
    queryKey: ["checkin-status"],
    exact: false,
  });
}

export function useEventBaskets(
  eventId: string | number,
  phase?: string,
  raceId?: string | number | null
) {
  const params: Record<string, string> = {};
  if (phase) params.phase = phase;
  if (raceId !== undefined && raceId !== null && raceId !== "") {
    params.raceId = String(raceId);
  }
  return useApiQuery({
    endpoint: apiEndpoints.eventBaskets.list(eventId),
    queryKey: [
      "event-baskets",
      String(eventId),
      phase ?? "all",
      raceId !== undefined && raceId !== null && raceId !== "" ? String(raceId) : "no-race",
    ],
    params,
    enabled: !!eventId,
  });
}

export function useGenerateLoftBaskets(eventId: string | number) {
  return useApiMutation({
    method: "POST",
    endpoint: apiEndpoints.eventBaskets.generateLoft(eventId),
    queryKey: ["event-baskets"],
    exact: false,
  });
}

export function useScanLoftBasket(eventId: string | number) {
  return useApiMutation({
    method: "POST",
    endpoint: apiEndpoints.eventBaskets.scanLoft(eventId),
    queryKey: ["checkin-status"],
    exact: false,
  });
}

export function useCreateBasket(eventId: string | number) {
  return useApiMutation({
    method: "POST",
    endpoint: apiEndpoints.eventBaskets.list(eventId),
    queryKey: ["event-baskets"],
    exact: false,
  });
}

export function useDeleteBasket(eventId: string | number) {
  return useApiMutation({
    method: "DELETE",
    endpoint: apiEndpoints.eventBaskets.list(eventId),
    queryKey: ["event-baskets"],
    exact: false,
  });
}

export function useUpdateBasket(eventId: string | number) {
  return useApiMutation({
    method: "PATCH",
    endpoint: apiEndpoints.eventBaskets.list(eventId),
    queryKey: ["event-baskets"],
    exact: false,
  });
}

export function useClearBasket(eventId: string | number) {
  return useApiMutation({
    method: "PATCH",
    endpoint: apiEndpoints.eventBaskets.list(eventId),
    queryKey: ["event-baskets"],
    exact: false,
  });
}

export function useAssignBaskets(eventId: string | number) {
  return useApiMutation({
    method: "POST",
    endpoint: apiEndpoints.eventBaskets.assign(eventId),
    queryKey: ["event-baskets"],
    exact: false,
  });
}

export function useAssignRaceBaskets(eventId: string | number) {
  return useApiMutation({
    method: "POST",
    endpoint: apiEndpoints.eventBaskets.assignRace(eventId),
    queryKey: ["event-baskets"],
    exact: false,
  });
}
