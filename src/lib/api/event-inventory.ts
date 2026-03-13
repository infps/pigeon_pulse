import { useApiQuery } from "@/hooks/useApi";
import { apiEndpoints } from "@/lib/endpoints";


export const useListEventInventory = (eventId: number | string) => {
  return useApiQuery({
    queryKey: ["event-inventory", "list", String(eventId)],
    endpoint: apiEndpoints.eventInventory.byEvent(eventId),
    enabled: !!eventId,
  });
};
