import { useApiQuery } from "@/hooks/useApi";
import { apiEndpoints } from "@/lib/endpoints";

export interface EventInventoryFilters {
  paymentStatus?: string;
  arrivalFrom?: string;
  arrivalTo?: string;
}

export const useListEventInventory = (
  eventId: number | string,
  filters?: EventInventoryFilters,
  seasonId?: number | null
) => {
  const params: Record<string, string> = {};
  if (filters?.paymentStatus && filters.paymentStatus !== "all") params.paymentStatus = filters.paymentStatus;
  if (filters?.arrivalFrom) params.arrivalFrom = filters.arrivalFrom;
  if (filters?.arrivalTo) params.arrivalTo = filters.arrivalTo;
  if (seasonId) params.seasonId = String(seasonId);
  const queryKey = [
    "event-inventory",
    "list",
    String(eventId),
    params.paymentStatus ?? "",
    params.arrivalFrom ?? "",
    params.arrivalTo ?? "",
    String(seasonId ?? ""),
  ];
  return useApiQuery({
    queryKey,
    endpoint: apiEndpoints.eventInventory.byEvent(eventId),
    enabled: !!eventId,
    params: Object.keys(params).length > 0 ? params : undefined,
  });
};
