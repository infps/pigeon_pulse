import { useApiQuery } from "@/hooks/useApi";
import { apiEndpoints } from "../endpoints";
import { useApiMutation } from "@/hooks/useApiMutation";

export function useListBaskets({
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
    endpoint: apiEndpoints.baskets.base,
    queryKey: ["baskets", "list", paramKeys],
    params,
  });
}

export function useCreateBasket({
  params,
}: {
  params?: Record<string, string>;
} = {}) {
  const res = useApiMutation({
    exact: false,
    method: "POST",
    endpoint: apiEndpoints.baskets.base,
    queryKey: ["baskets"],
    params,
  });
  return res;
}

export function useDeleteBasket({
  params,
}: {
  params?: Record<string, string>;
} = {}) {
  const res = useApiMutation({
    exact: false,
    method: "DELETE",
    endpoint: apiEndpoints.baskets.byId,
    queryKey: ["baskets"],
    params,
  });
  return res;
}
