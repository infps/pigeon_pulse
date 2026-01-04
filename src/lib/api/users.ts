import { useApiQuery } from "@/hooks/useApi";
import { apiEndpoints } from "../endpoints";
import { useApiMutation } from "@/hooks/useApiMutation";

export function useListUsers({
  params,
  enabled = true,
}: {
  params?: Record<string, string>;
  enabled?: boolean;
} = {}) {
const paramKeys = params ? Object.keys(params).sort().map((key) => `${key}-${params[key]}`).join("_") : "all";
  return useApiQuery({
    endpoint: apiEndpoints.users.base,
    queryKey: ["users", "list", paramKeys],
    params,
    enabled
  });
}


export function useCreateUser({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiMutation({
    exact: false,
    method: "POST",
    endpoint: apiEndpoints.users.base,
    queryKey: ["users"],
    params,
  });
  return res;
}

export function useUpdateUser({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiMutation({
    exact: false,
    method: "PUT",
    endpoint: apiEndpoints.users.base,
    queryKey: ["users"],
    params,
  });
  return res;
}

export function useDeleteUser({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiMutation({
    exact: false,
    method: "DELETE",
    endpoint: apiEndpoints.users.base,
    queryKey: ["users"],
    params,
  });
  return res;
}
