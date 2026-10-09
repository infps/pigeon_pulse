import { useApiQuery } from "@/hooks/useApi";
import { useApiMutation } from "@/hooks/useApiMutation";

export const useGetEventInventory = (eventInventoryId: number | string) => {
  return useApiQuery({
    queryKey: ["event-inventory", "detail", String(eventInventoryId)],
    endpoint: `/api/admin/event-inventory/${eventInventoryId}`,
    enabled: !!eventInventoryId,
  });
};

export const useCreatePayment = ({
  onSuccess,
}: {
  onSuccess?: () => void;
} = {}) => {
  return useApiMutation({
    endpoint: "/api/admin/payment",
    method: "POST",
    queryKey: ["event-inventory", "payments"],
    onSuccess,
  });
};

export const useUpdatePayment = ({
  onSuccess,
}: {
  onSuccess?: () => void;
} = {}) => {
  return useApiMutation({
    endpoint: "/api/admin/payment",
    method: "PUT",
    queryKey: ["event-inventory", "payments"],
    onSuccess,
  });
};

export const useDeletePayment = ({
  onSuccess,
}: {
  onSuccess?: () => void;
} = {}) => {
  return useApiMutation({
    endpoint: "/api/admin/payment",
    method: "DELETE",
    queryKey: ["event-inventory", "payments"],
    onSuccess,
  });
};

/** Waiting flag/date + note on a registration. Invalidates detail and breeders list. */
export const useUpdateEventInventory = (eventInventoryId: number, { onSuccess }: { onSuccess?: () => void } = {}) => {
  return useApiMutation({
    endpoint: `/api/admin/event-inventory/${eventInventoryId}`,
    method: "PATCH",
    queryKey: ["event-inventory"],
    exact: false,
    onSuccess,
  });
};

/** Bets this registration's breeder placed in its season. */
export const useEventInventoryBets = (eventInventoryId: number | null) => {
  return useApiQuery({
    queryKey: ["event-inventory", "bets", String(eventInventoryId)],
    endpoint: `/api/admin/event-inventory/${eventInventoryId}/bets`,
    enabled: !!eventInventoryId,
  });
};

export const useAddPartner = (eventInventoryId: number, { onSuccess }: { onSuccess?: () => void } = {}) => {
  return useApiMutation({
    endpoint: `/api/admin/event-inventory/${eventInventoryId}/partners`,
    method: "POST",
    queryKey: ["event-inventory", "partners"],
    onSuccess,
  });
};

export const useDeletePartner = (eventInventoryId: number, { onSuccess }: { onSuccess?: () => void } = {}) => {
  return useApiMutation({
    endpoint: `/api/admin/event-inventory/${eventInventoryId}/partners`,
    method: "DELETE",
    queryKey: ["event-inventory", "partners"],
    onSuccess,
  });
};

export const useListBreeders = () => {
  return useApiQuery({
    queryKey: ["breeders", "list"],
    endpoint: "/api/admin/breeders",
  });
};
