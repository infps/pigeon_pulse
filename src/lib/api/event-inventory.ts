import { useApiQuery } from "@/hooks/useApi";
import { useApiMutation } from "@/hooks/useApiMutation";
import { apiEndpoints } from "@/lib/endpoints";

export interface EventInventoryFilters {
  paymentStatus?: string;
  arrivalFrom?: string;
  arrivalTo?: string;
  /** Defaults to approved registrations (the participants). */
  approval?: "WAITING" | "REJECTED";
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
  if (filters?.approval) params.approval = filters.approval;
  if (seasonId) params.seasonId = String(seasonId);
  const queryKey = [
    "event-inventory",
    "list",
    String(eventId),
    params.paymentStatus ?? "",
    params.arrivalFrom ?? "",
    params.arrivalTo ?? "",
    String(seasonId ?? ""),
    params.approval ?? "",
  ];
  return useApiQuery({
    queryKey,
    endpoint: apiEndpoints.eventInventory.byEvent(eventId),
    enabled: !!eventId,
    params: Object.keys(params).length > 0 ? params : undefined,
  });
};

/** Approve or reject registrations: body `{ ids, action: "APPROVE" | "REJECT" }`. */
export const useSetRegistrationApproval = (eventId: number | string, { onSuccess }: { onSuccess?: () => void } = {}) => {
  return useApiMutation({
    endpoint: apiEndpoints.eventInventory.approval(eventId),
    method: "POST",
    queryKey: ["event-inventory"],
    exact: false,
    onSuccess,
  });
};

/** Mark a refund owed to the breeder as paid back: body `{ refundId }`. */
export const useSettleRefund = (eventId: number | string, { onSuccess }: { onSuccess?: () => void } = {}) => {
  return useApiMutation({
    endpoint: apiEndpoints.eventInventory.refunds(eventId),
    method: "PATCH",
    queryKey: ["event-inventory"],
    exact: false,
    onSuccess,
  });
};
