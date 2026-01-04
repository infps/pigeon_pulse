import { useApiQuery } from "@/hooks/useApi";
import { apiEndpoints } from "../endpoints";
import { useApiMutation } from "@/hooks/useApiMutation";

export function useListEvents({ params }: { params?: Record<string, string> } = {}) {
  const paramKeys = params ? Object.keys(params).sort().map((key) => `${key}-${params[key]}`).join("_") : "all";
  const res = useApiQuery({
    endpoint: apiEndpoints.events.base,
    queryKey: ["events", "list", paramKeys],
    params,
  });
  return res;
}

export function useCreateEvent({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiMutation({
    exact: false,
    method: "POST",
    bodyType: "formdata",
    endpoint: apiEndpoints.events.base,
    queryKey: ["events"],
    params,
  });
  return res;
}

export function useUpdateEvent({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiMutation({
    exact: false,
    method: "PUT",
    bodyType: "formdata",
    endpoint: apiEndpoints.events.base,
    queryKey: ["events"],
    params,
  });
  return res;
}

export function useDeleteEvent({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiMutation({
    exact: false,
    method: "DELETE",
    endpoint: apiEndpoints.events.base,
    queryKey: ["events"],
    params,
  });
  return res;
}
