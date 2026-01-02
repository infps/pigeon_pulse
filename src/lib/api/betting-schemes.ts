import useApiRequest from "@/hooks/useApi";
import { apiEndpoints } from "../endpoints";

export function useListBettingSchemes({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiRequest({
    endpoint: apiEndpoints.bettingSchemes.base,
    queryKey: ["bettingSchemes", "list"],
    params,
  });
  return res;
}

export function useCreateBettingScheme({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiRequest({
    exact: false,
    method: "POST",
    endpoint: apiEndpoints.bettingSchemes.base,
    queryKey: ["bettingSchemes"],
    params,
  });
  return res;
}

export function useUpdateBettingScheme({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiRequest({
    exact: false,
    method: "PUT",
    endpoint: apiEndpoints.bettingSchemes.base,
    queryKey: ["bettingSchemes"],
    params,
  });
  return res;
}

export function useDeleteBettingScheme({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiRequest({
    exact: false,
    method: "DELETE",
    endpoint: apiEndpoints.bettingSchemes.base,
    queryKey: ["bettingSchemes"],
    params,
  });
  return res;
}
