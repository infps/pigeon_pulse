import { useApiQuery } from "@/hooks/useApi";
import { apiEndpoints } from "@/lib/endpoints";

export const useListEventInventoryItems = (eventId: string) => {
  return useApiQuery({
    queryKey: ["event-inventory-items", "list", eventId],
    endpoint: apiEndpoints.eventInventory.itemsByEvent(eventId),
    enabled: !!eventId,
  });
};
