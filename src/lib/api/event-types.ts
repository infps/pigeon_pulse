// EventType model removed from schema. These hooks are kept as stubs
// so existing UI imports don't break. They hit stub API routes that return [].
import { useApiQuery } from "@/hooks/useApi";
import { apiEndpoints } from "../endpoints";
import { useApiMutation } from "@/hooks/useApiMutation";

export function useListEventTypes({ params }: { params?: Record<string, string> } = {}) {
  return useApiQuery({
    endpoint: apiEndpoints.eventTypes.base,
    queryKey: ["eventTypes", "list"],
    params,
  });
}

export function useCreateEventType({ params }: { params?: Record<string, string> } = {}) {
  return useApiMutation({
    exact: false,
    method: "POST",
    endpoint: apiEndpoints.eventTypes.base,
    queryKey: ["eventTypes"],
    params,
  });
}

export function useUpdateEventType({ params }: { params?: Record<string, string> } = {}) {
  return useApiMutation({
    exact: false,
    method: "PUT",
    endpoint: apiEndpoints.eventTypes.base,
    queryKey: ["eventTypes"],
    params,
  });
}

export function useDeleteEventType({ params }: { params?: Record<string, string> } = {}) {
  return useApiMutation({
    exact: false,
    method: "DELETE",
    endpoint: apiEndpoints.eventTypes.base,
    queryKey: ["eventTypes"],
    params,
  });
}
