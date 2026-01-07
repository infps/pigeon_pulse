import { useApiMutation } from "@/hooks/useApiMutation";
import { apiEndpoints } from "../endpoints";
import { useQueryClient } from "@tanstack/react-query";

export function useBasketRaceItems() {
  const queryClient = useQueryClient();
  
  return useApiMutation({
    exact: true,
    method: "POST",
    endpoint: apiEndpoints.raceItems.basket,
    queryKey: ["raceItems"],
    onSuccess: () => {
      // Also invalidate baskets to update basket counts
      queryClient.invalidateQueries({ queryKey: ["baskets"] });
    },
  });
}

export function useUnbasketRaceItems() {
  const queryClient = useQueryClient();
  
  return useApiMutation({
    exact: true,
    method: "DELETE",
    endpoint: apiEndpoints.raceItems.basket,
    queryKey: ["raceItems"],
    onSuccess: () => {
      // Also invalidate baskets to update basket counts
      queryClient.invalidateQueries({ queryKey: ["baskets"] });
    },
  });
}
