import { useApiQuery } from "@/hooks/useApi";
import { useApiMutation } from "@/hooks/useApiMutation";
import { apiEndpoints } from "@/lib/endpoints";

export interface EventInventoryItemsFilters {
  paymentStatus?: string;
  arrivalFrom?: string;
  arrivalTo?: string;
}

export const useListEventInventoryItems = (
  eventId: number | string,
  endpoint?: string,
  filters?: EventInventoryItemsFilters
) => {
  const params: Record<string, string> = {};
  if (filters?.paymentStatus && filters.paymentStatus !== "all") params.paymentStatus = filters.paymentStatus;
  if (filters?.arrivalFrom) params.arrivalFrom = filters.arrivalFrom;
  if (filters?.arrivalTo) params.arrivalTo = filters.arrivalTo;
  const queryKey = [
    "event-inventory-items",
    "list",
    String(eventId),
    params.paymentStatus ?? "",
    params.arrivalFrom ?? "",
    params.arrivalTo ?? "",
  ];
  return useApiQuery({
    queryKey,
    endpoint: endpoint || apiEndpoints.eventInventory.itemsByEvent(eventId),
    enabled: !!eventId,
    params: Object.keys(params).length > 0 ? params : undefined,
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
