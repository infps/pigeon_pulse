import { useApiQuery } from "@/hooks/useApi";
import { apiEndpoints } from "../endpoints";

export interface AdminBirdsFilters {
  breederId?: string;
  band?: string;
  color?: string;
  sex?: string;
  status?: string;
  search?: string;
}

export function useAdminListBirds(filters: AdminBirdsFilters = {}) {
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== "") params[k] = v;
  }
  const keyPart = Object.keys(params)
    .sort()
    .map((k) => `${k}-${params[k]}`)
    .join("_") || "all";

  return useApiQuery({
    endpoint: apiEndpoints.admin.birds.base,
    queryKey: ["admin-birds", "list", keyPart],
    params,
  });
}
