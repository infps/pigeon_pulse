import useApiRequest from "@/hooks/useApi";
import { apiEndpoints } from "../endpoints";

export function useListEvents({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiRequest({
    endpoint: apiEndpoints.events.base,
    queryKey: ["events", "list"],
    params,
  });
  return res;
}

export function useCreateEvent({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiRequest({
    exact: false,
    method: "POST",
    endpoint: apiEndpoints.events.base,
    queryKey: ["events"],
    params,
  });
  return res;
}

export function useUpdateEvent({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiRequest({
    exact: false,
    method: "PUT",
    endpoint: apiEndpoints.events.base,
    queryKey: ["events"],
    params,
  });
  return res;
}

export function useDeleteEvent({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiRequest({
    exact: false,
    method: "DELETE",
    endpoint: apiEndpoints.events.base,
    queryKey: ["events"],
    params,
  });
  return res;
}
