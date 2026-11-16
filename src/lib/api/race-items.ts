import { useApiQuery } from "@/hooks/useApi";
import { apiEndpoints } from "../endpoints";

export function useListRaceItems({
  params,
  refetchInterval,
}: {
  params?: Record<string, string>;
  refetchInterval?: number | false;
} = {}) {
  const paramKeys = params
    ? Object.keys(params)
        .sort()
        .map((key) => `${key}-${params[key]}`)
        .join("_")
    : "all";
  return useApiQuery({
    endpoint: apiEndpoints.raceItems.base,
    queryKey: ["raceItems", "list", paramKeys],
    params,
    refetchInterval,
  });
}
