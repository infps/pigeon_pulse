import { useApiQuery } from "@/hooks/useApi";
import { apiEndpoints } from "../endpoints";
import { useApiMutation } from "@/hooks/useApiMutation";


export function useListFeeSchemes({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiQuery({
    endpoint: apiEndpoints.feeSchemes.base,
    queryKey: ["feeSchemes", "list"],
    params,
  });
  return res;
}

export function useCreateFeeScheme({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiMutation({
    exact: false,
    method: "POST",
    endpoint: apiEndpoints.feeSchemes.base,
    queryKey: ["feeSchemes"],
    params,
  });
  return res;
}

export function useUpdateFeeScheme({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiMutation({
    exact: false,
    method: "PUT",
    endpoint: apiEndpoints.feeSchemes.base,
    queryKey: ["feeSchemes"],
    params,
  });
  return res;
}

export function useDeleteFeeScheme({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiMutation({
    exact: false,
    method: "DELETE",
    endpoint: apiEndpoints.feeSchemes.base,
    queryKey: ["feeSchemes"],
    params,
  });
  return res;
}
