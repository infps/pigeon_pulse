import { useApiQuery } from "@/hooks/useApi";
import { useApiMutation } from "@/hooks/useApiMutation";
import { apiEndpoints } from "@/lib/endpoints";

export const useListEventInventoryItems = (eventId: number | string, endpoint?: string) => {
  return useApiQuery({
    queryKey: ["event-inventory-items", "list", String(eventId)],
    endpoint: endpoint || apiEndpoints.eventInventory.itemsByEvent(eventId),
    enabled: !!eventId,
  });
};

export function useAddBirdsToEvent(eventId: string | number) {
  return useApiMutation({
    method: "POST",
    endpoint: apiEndpoints.eventInventory.addBirds(eventId),
    queryKey: ["event-inventory-items"],
    exact: false,
  });
}
