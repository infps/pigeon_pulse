import { useApiQuery } from "@/hooks/useApi";
import { useApiMutation } from "@/hooks/useApiMutation";
import { apiEndpoints } from "../endpoints";

export function useListAverageConfigs(eventId: string | number, seasonId: number | null) {
  return useApiQuery({
    endpoint: apiEndpoints.averages.list(eventId),
    queryKey: ["averages", "list", String(eventId), String(seasonId)],
    params: seasonId ? { seasonId: String(seasonId) } : undefined,
    enabled: !!eventId && !!seasonId,
  });
}

export function useAverageResults(
  eventId: string | number,
  avgId: string | number | null,
  seasonId: number | null
) {
  return useApiQuery({
    endpoint: avgId ? apiEndpoints.averages.results(eventId, avgId) : "",
    queryKey: ["averages", "results", String(eventId), String(avgId), String(seasonId)],
    params: seasonId ? { seasonId: String(seasonId) } : undefined,
    enabled: !!avgId && !!seasonId,
  });
}

export function useCreateAverageConfig(eventId: string | number) {
  return useApiMutation({
    method: "POST",
    endpoint: apiEndpoints.averages.list(eventId),
    queryKey: ["averages", "list", String(eventId)],
    exact: false,
  });
}

export function usePatchAverageConfig(eventId: string | number, avgId: string | number | null) {
  return useApiMutation({
    method: "PATCH",
    endpoint: avgId ? apiEndpoints.averages.byId(eventId, avgId) : "",
    queryKey: ["averages", "list", String(eventId)],
    exact: false,
  });
}

export function useDeleteAverageConfig(eventId: string | number) {
  return useApiMutation({
    method: "DELETE",
    endpoint: apiEndpoints.averages.list(eventId),
    queryKey: ["averages", "list", String(eventId)],
    exact: false,
  });
}
