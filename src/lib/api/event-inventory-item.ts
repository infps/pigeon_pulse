import { useApiMutation } from "@/hooks/useApiMutation";
import { toast } from "sonner";

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
  onError,
  eventInventoryItemId,
}: {
  onSuccess?: () => void,
  onError?: (error:any) => void,
  eventInventoryItemId: string;
}) => {
  return useApiMutation({
    endpoint: "/api/admin/event-inventory-item/" + eventInventoryItemId,
    method: "PATCH",
    queryKey: ["event-inventory-items"],
    onSuccess,
    onError,
  });
};
