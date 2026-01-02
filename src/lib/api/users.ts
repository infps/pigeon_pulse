import useApiRequest from "@/hooks/useApi";
import { apiEndpoints } from "../endpoints";

export function useListUsers({
  params,
}: {
  params?: { eventId?: string };
} = {}) {
  return useApiRequest({
    endpoint: apiEndpoints.users.base,
    queryKey: ["users", "list", params?.eventId ?? "all"],
    params,
  });
}


export function useCreateUser({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiRequest({
    exact: false,
    method: "POST",
    endpoint: apiEndpoints.users.base,
    queryKey: ["users"],
    params,
  });
  return res;
}

export function useUpdateUser({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiRequest({
    exact: false,
    method: "PUT",
    endpoint: apiEndpoints.users.base,
    queryKey: ["users"],
    params,
  });
  return res;
}

export function useDeleteUser({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiRequest({
    exact: false,
    method: "DELETE",
    endpoint: apiEndpoints.users.base,
    queryKey: ["users"],
    params,
  });
  return res;
}
