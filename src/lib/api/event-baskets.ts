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

export function useEventBaskets(eventId: string | number, phase?: string) {
  const params: Record<string, string> = {};
  if (phase) params.phase = phase;
  return useApiQuery({
    endpoint: apiEndpoints.eventBaskets.list(eventId),
    queryKey: ["event-baskets", String(eventId), phase ?? "all"],
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

export function useGenerateRaceBaskets(eventId: string | number) {
  return useApiMutation({
    method: "POST",
    endpoint: apiEndpoints.eventBaskets.generateRace(eventId),
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

export function useCreateLoftBasket(eventId: string | number) {
  return useApiMutation({
    method: "POST",
    endpoint: apiEndpoints.eventBaskets.list(eventId),
    queryKey: ["event-baskets"],
    exact: false,
  });
}

export function useDeleteLoftBasket(eventId: string | number) {
  return useApiMutation({
    method: "DELETE",
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
