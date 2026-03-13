import { useApiQuery } from "@/hooks/useApi";
import { apiEndpoints } from "../endpoints";

export function useListBreeders({
  params,
}: {
  params?: Record<string, string>;
} = {}) {
  return useApiQuery({
    endpoint: apiEndpoints.breeders.base,
    queryKey: ["breeders", "list"],
    params,
  });
}

export function useListBreederBirds(breederId: string | number | null) {
  return useApiQuery({
    endpoint: breederId ? apiEndpoints.breeders.birds(breederId) : "",
    queryKey: ["breeder-birds", String(breederId)],
    enabled: !!breederId,
  });
}
