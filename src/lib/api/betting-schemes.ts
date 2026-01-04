import { useApiQuery } from "@/hooks/useApi";
import { apiEndpoints } from "../endpoints";
import { useApiMutation } from "@/hooks/useApiMutation";

export function useListBettingSchemes({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiQuery({
    endpoint: apiEndpoints.bettingSchemes.base,
    queryKey: ["bettingSchemes", "list"],
    params,
  });
  return res;
}

export function useCreateBettingScheme({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiMutation({
    exact: false,
    method: "POST",
    endpoint: apiEndpoints.bettingSchemes.base,
    queryKey: ["bettingSchemes"],
    params,
  });
  return res;
}

export function useUpdateBettingScheme({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiMutation({
    exact: false,
    method: "PUT",
    endpoint: apiEndpoints.bettingSchemes.base,
    queryKey: ["bettingSchemes"],
    params,
  });
  return res;
}

export function useDeleteBettingScheme({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiMutation({
    exact: false,
    method: "DELETE",
    endpoint: apiEndpoints.bettingSchemes.base,
    queryKey: ["bettingSchemes"],
    params,
  });
  return res;
}
