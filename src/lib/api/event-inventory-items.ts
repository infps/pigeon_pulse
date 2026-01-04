import useApiRequest from "@/hooks/useApi";
import { apiEndpoints } from "@/lib/endpoints";
import { EventInventoryItemDetail } from "@/lib/types";

interface EventInventoryItemsListResponse {
  eventInventoryItems: EventInventoryItemDetail[];
  message: string;
}

export const useListEventInventoryItems = (eventId: string) => {
  return useApiRequest({
    queryKey: ["event-inventory-items", "list", eventId],
    endpoint: apiEndpoints.eventInventory.itemsByEvent(eventId),
    method: "GET",
    enabled: !!eventId,
  });
};
