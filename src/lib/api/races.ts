import { useApiQuery } from "@/hooks/useApi";
import { apiEndpoints } from "../endpoints";
import { useApiMutation } from "@/hooks/useApiMutation";

export function useListRaces({
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
    endpoint: apiEndpoints.races.base,
    queryKey: ["races", "list", paramKeys],
    params,
  });
}

export function useCreateRace({
  params,
}: {
  params?: Record<string, string>;
} = {}) {
  const res = useApiMutation({
    exact: false,
    method: "POST",
    endpoint: apiEndpoints.races.base,
    queryKey: ["races"],
    params,
  });
  return res;
}

export function useUpdateRace({
  params,
}: {
  params?: Record<string, string>;
} = {}) {
  const res = useApiMutation({
    exact: false,
    method: "PUT",
    endpoint: apiEndpoints.races.base,
    queryKey: ["races"],
    params,
  });
  return res;
}

export function useDeleteRace({
  params,
}: {
  params?: Record<string, string>;
} = {}) {
  const res = useApiMutation({
    exact: false,
    method: "DELETE",
    endpoint: apiEndpoints.races.base,
    queryKey: ["races"],
    params,
  });
  return res;
}
