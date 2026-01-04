import useApiRequest from "@/hooks/useApi";
import { apiEndpoints } from "@/lib/endpoints";


export const useListEventInventory = (eventId: string) => {
  return useApiRequest({
    queryKey: ["event-inventory", "list", eventId],
    endpoint: apiEndpoints.eventInventory.byEvent(eventId),
    method: "GET",
    enabled: !!eventId,
  });
};
