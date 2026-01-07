import { useApiQuery } from "@/hooks/useApi";
import { apiEndpoints } from "../endpoints";

export function useListRaceItems({
  params,
}: {
  params?: Record<string, string>;
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
  });
}
