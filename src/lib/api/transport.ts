import { useApiQuery } from "@/hooks/useApi";
import { useApiMutation } from "@/hooks/useApiMutation";

export function useStartTransport(raceId: string | number) {
  return useApiMutation({
    exact: false,
    method: "POST",
    endpoint: `/api/admin/race/${raceId}/transport/start`,
    queryKey: ["transport", "track", String(raceId)],
  });
}

export function useStopTransport(raceId: string | number) {
  return useApiMutation({
    exact: false,
    method: "POST",
    endpoint: `/api/admin/race/${raceId}/transport/stop`,
    queryKey: ["transport", "track", String(raceId)],
  });
}

export function useSendPings(raceId: string | number) {
  return useApiMutation({
    exact: false,
    method: "POST",
    endpoint: `/api/admin/race/${raceId}/ping`,
    queryKey: ["transport", "track", String(raceId)],
  });
}

export function usePublicTrack(
  raceId: string | number,
  { refetchInterval }: { refetchInterval?: number | false } = {}
) {
  return useApiQuery({
    endpoint: `/api/public/race/${raceId}/track`,
    queryKey: ["transport", "public-track", String(raceId)],
    enabled: !!raceId,
    refetchInterval,
  });
}

export function useAdminTrack(raceId: string | number) {
  return useApiQuery({
    endpoint: `/api/admin/race/${raceId}/track`,
    queryKey: ["transport", "track", String(raceId)],
    enabled: !!raceId,
  });
}
