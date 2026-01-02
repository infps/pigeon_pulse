import useApiRequest from "@/hooks/useApi";
import { apiEndpoints } from "../endpoints";

export function useListEventTypes({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiRequest({
    endpoint: apiEndpoints.eventTypes.base,
    queryKey: ["eventTypes", "list"],
    params,
  });
  return res;
}

export function useCreateEventType({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiRequest({
    exact: false,
    method: "POST",
    endpoint: apiEndpoints.eventTypes.base,
    queryKey: ["eventTypes"],
    params,
  });
  return res;
}

export function useUpdateEventType({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiRequest({
    exact: false,
    method: "PUT",
    endpoint: apiEndpoints.eventTypes.base,
    queryKey: ["eventTypes"],
    params,
  });
  return res;
}

export function useDeleteEventType({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiRequest({
    exact: false,
    method: "DELETE",
    endpoint: apiEndpoints.eventTypes.base,
    queryKey: ["eventTypes"],
    params,
  });
  return res;
}
