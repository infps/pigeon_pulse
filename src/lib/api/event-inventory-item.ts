import { useApiMutation } from "@/hooks/useApiMutation";

export const useCreateBird = ({
  onSuccess,
}: {
  onSuccess?: () => void;
} = {}) => {
  return useApiMutation({
    endpoint: "/api/admin/event-inventory-item",
    method: "POST",
    queryKey: ["event-inventory-items"],
    onSuccess,
  });
};

export const useUpdateEventInventoryItem = ({
  onSuccess,
  eventInventoryItemId
}: {
  onSuccess?: () => void,
  eventInventoryItemId: string;
}) => {
  return useApiMutation({
    endpoint: "/api/admin/event-inventory-item/" + eventInventoryItemId,
    method: "PATCH",
    queryKey: ["event-inventory-items"],
    onSuccess,
  });
};
