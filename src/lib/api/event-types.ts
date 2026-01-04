import { useApiQuery } from "@/hooks/useApi";
import { apiEndpoints } from "../endpoints";
import { useApiMutation } from "@/hooks/useApiMutation";

export function useListEventTypes({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiQuery({
    endpoint: apiEndpoints.eventTypes.base,
    queryKey: ["eventTypes", "list"],
    params,
  });
  return res;
}

export function useCreateEventType({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiMutation({
    exact: false,
    method: "POST",
    endpoint: apiEndpoints.eventTypes.base,
    queryKey: ["eventTypes"],
    params,
  });
  return res;
}

export function useUpdateEventType({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiMutation({
    exact: false,
    method: "PUT",
    endpoint: apiEndpoints.eventTypes.base,
    queryKey: ["eventTypes"],
    params,
  });
  return res;
}

export function useDeleteEventType({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiMutation({
    exact: false,
    method: "DELETE",
    endpoint: apiEndpoints.eventTypes.base,
    queryKey: ["eventTypes"],
    params,
  });
  return res;
}
