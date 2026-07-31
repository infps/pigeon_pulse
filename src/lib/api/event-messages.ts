import { useApiQuery } from "@/hooks/useApi";
import { useApiMutation } from "@/hooks/useApiMutation";
import { apiEndpoints } from "../endpoints";

export function useListAdminEventMessages({ eventId, seasonId }: { eventId: number | string; seasonId?: number | null }) {
  const params: Record<string, string> = {};
  if (seasonId) params.seasonId = String(seasonId);
  return useApiQuery({
    endpoint: apiEndpoints.eventMessages.list(eventId),
    queryKey: ["admin", "event", String(eventId), "messages", String(seasonId ?? "")],
    params: Object.keys(params).length > 0 ? params : undefined,
    enabled: !!eventId,
  });
}

export function useListBreederEventMessages({ eventId }: { eventId: number | string }) {
  return useApiQuery({
    endpoint: apiEndpoints.breeder.eventMessages(eventId),
    queryKey: ["breeder", "event", String(eventId), "messages"],
    enabled: !!eventId,
  });
}

export function useListBreederMessages({
  limit = 10,
  offset = 0,
}: { limit?: number; offset?: number } = {}) {
  return useApiQuery({
    endpoint: apiEndpoints.breeder.messages,
    queryKey: ["breeder", "messages", String(limit), String(offset)],
    params: { limit: String(limit), offset: String(offset) },
  });
}

export function useCreateEventMessage({ eventId }: { eventId: number | string }) {
  return useApiMutation({
    method: "POST",
    endpoint: apiEndpoints.eventMessages.list(eventId),
    queryKey: ["admin", "event", String(eventId), "messages"],
    exact: false,
  });
}

export function useUpdateEventMessage({
  eventId,
  messageId,
}: {
  eventId: number | string;
  messageId: number | string;
}) {
  return useApiMutation({
    method: "PATCH",
    endpoint: apiEndpoints.eventMessages.byId(eventId, messageId),
    queryKey: ["admin", "event", String(eventId), "messages"],
    exact: false,
  });
}

export function useDeleteEventMessage({
  eventId,
  messageId,
}: {
  eventId: number | string;
  messageId: number | string;
}) {
  return useApiMutation({
    method: "DELETE",
    endpoint: apiEndpoints.eventMessages.byId(eventId, messageId),
    queryKey: ["admin", "event", String(eventId), "messages"],
    exact: false,
  });
}
