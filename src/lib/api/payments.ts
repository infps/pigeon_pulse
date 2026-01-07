import  { useApiQuery } from "@/hooks/useApi";
import { useApiMutation } from "@/hooks/useApiMutation";

export const useGetEventInventory = (eventInventoryId: string) => {
  return useApiQuery({
    queryKey: ["event-inventory", "detail", eventInventoryId],
    endpoint: `/api/event-inventory/${eventInventoryId}`,
    enabled: !!eventInventoryId,
  });
};

export const useCreatePayment = ({
  onSuccess,
}: {
  onSuccess?: () => void;
} = {}) => {
  return useApiMutation({
    endpoint: "/api/payment",
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
    endpoint: "/api/payment",
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
    endpoint: "/api/payment",
    method: "DELETE",
    queryKey: ["event-inventory", "payments"],
    onSuccess,
  });
};
