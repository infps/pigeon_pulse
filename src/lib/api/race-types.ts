import { useApiQuery } from "@/hooks/useApi";
import { apiEndpoints } from "../endpoints";
import { useApiMutation } from "@/hooks/useApiMutation";

export function useListRaceTypes({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiQuery({
    endpoint: apiEndpoints.raceTypes.base,
    queryKey: ["raceTypes", "list"],
    params,
  });
  return res;
}

export function useCreateRaceType({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiMutation({
    exact: false,
    method: "POST",
    endpoint: apiEndpoints.raceTypes.base,
    queryKey: ["raceTypes"],
    params,
  });
  return res;
}

export function useUpdateRaceType({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiMutation({
    exact: false,
    method: "PUT",
    endpoint: apiEndpoints.raceTypes.base,
    queryKey: ["raceTypes"],
    params,
  });
  return res;
}

export function useDeleteRaceType({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiMutation({
    exact: false,
    method: "DELETE",
    endpoint: apiEndpoints.raceTypes.base,
    queryKey: ["raceTypes"],
    params,
  });
  return res;
}