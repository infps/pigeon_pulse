import { useApiQuery } from "@/hooks/useApi";
import { apiEndpoints } from "../endpoints";

export function useListBreederEvents({
  params,
}: {
  params?: Record<string, string>;
} = {}) {
  return useApiQuery({
    endpoint: apiEndpoints.breeder.events,
    queryKey: ["breeder", "events"],
    params,
  });
}

export function useGetBreederEvent({
  eventId,
}: {
  eventId: number | string;
}) {
  return useApiQuery({
    endpoint: apiEndpoints.breeder.eventDetails(eventId),
    queryKey: ["breeder", "events", "detail", String(eventId)],
  });
}

export function useListLiveRaces() {
  return useApiQuery({
    endpoint: apiEndpoints.breeder.liveRaces,
    queryKey: ["breeder", "liveRaces"],
  });
}
