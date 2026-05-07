import { useApiQuery } from "@/hooks/useApi";
import { useApiMutation } from "@/hooks/useApiMutation";
import { apiEndpoints } from "../endpoints";

export type BirdRole = "ADMIN" | "SUPERADMIN" | "BREEDER" | string;

function isAdminRole(role: BirdRole | undefined | null): boolean {
  return role === "ADMIN" || role === "SUPERADMIN";
}

export function useBird(birdId: number | string, role: BirdRole) {
  const endpoint = isAdminRole(role)
    ? apiEndpoints.admin.birds.birdById(birdId)
    : apiEndpoints.breeder.birdById(birdId);

  return useApiQuery({
    endpoint,
    queryKey: ["bird", String(birdId), isAdminRole(role) ? "admin" : "breeder"],
    enabled: !!birdId,
  });
}

export function useUpdateBird(birdId: number | string) {
  return useApiMutation({
    endpoint: apiEndpoints.admin.birds.birdById(birdId),
    method: "PATCH",
    queryKey: ["bird", String(birdId), "admin"],
  });
}

export function useDeleteBird(birdId: number | string) {
  return useApiMutation({
    endpoint: apiEndpoints.admin.birds.birdById(birdId),
    method: "DELETE",
    queryKey: ["bird", String(birdId), "admin"],
  });
}
