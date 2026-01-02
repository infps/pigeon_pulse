import useApiRequest from "@/hooks/useApi";
import { apiEndpoints } from "../endpoints";

export function useListPrizeSchemes({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiRequest({
    endpoint: apiEndpoints.prizeSchemes.base,
    queryKey: ["prizeSchemes", "list"],
    params,
  });
  return res;
}

export function useCreatePrizeScheme({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiRequest({
    exact: false,
    method: "POST",
    endpoint: apiEndpoints.prizeSchemes.base,
    queryKey: ["prizeSchemes"],
    params,
  });
  return res;
}

export function useUpdatePrizeScheme({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiRequest({
    exact: false,
    method: "PUT",
    endpoint: apiEndpoints.prizeSchemes.base,
    queryKey: ["prizeSchemes"],
    params,
  });
  return res;
}

export function useDeletePrizeScheme({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiRequest({
    exact: false,
    method: "DELETE",
    endpoint: apiEndpoints.prizeSchemes.base,
    queryKey: ["prizeSchemes"],
    params,
  });
  return res;
}
