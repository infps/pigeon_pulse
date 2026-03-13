import { useApiQuery } from "@/hooks/useApi";
import { apiEndpoints } from "@/lib/endpoints";

export const useListEventInventoryItems = (eventId: number | string, endpoint?: string) => {
  return useApiQuery({
    queryKey: ["event-inventory-items", "list", String(eventId)],
    endpoint: endpoint || apiEndpoints.eventInventory.itemsByEvent(eventId),
    enabled: !!eventId,
  });
};
