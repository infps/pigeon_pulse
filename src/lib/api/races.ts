import useApiRequest from "@/hooks/useApi";
import { apiEndpoints } from "../endpoints";

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
  return useApiRequest({
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
  const res = useApiRequest({
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
  const res = useApiRequest({
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
  const res = useApiRequest({
    exact: false,
    method: "DELETE",
    endpoint: apiEndpoints.races.base,
    queryKey: ["races"],
    params,
  });
  return res;
}
