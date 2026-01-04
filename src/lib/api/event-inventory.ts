import { useApiQuery } from "@/hooks/useApi";
import { apiEndpoints } from "@/lib/endpoints";


export const useListEventInventory = (eventId: string) => {
  return useApiQuery({
    queryKey: ["event-inventory", "list", eventId],
    endpoint: apiEndpoints.eventInventory.byEvent(eventId),
    enabled: !!eventId,
  });
};
