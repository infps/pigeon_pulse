import  { useApiQuery } from "@/hooks/useApi";
import { apiEndpoints } from "../endpoints";
import { useApiMutation } from "@/hooks/useApiMutation";

export function useListTeams({ params }: { params?: Record<string, string> } = {}) {
  const paramKeys = params ? Object.keys(params).sort().map((key) => `${key}-${params[key]}`).join("_") : "all";
  const res = useApiQuery({
    endpoint: apiEndpoints.teams.base,
    queryKey: ["teams", "list", paramKeys],
    params,
  });
  return res;
}

export function useCreateTeam({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiMutation({
    exact: false,
    method: "POST",
    endpoint: apiEndpoints.teams.base,
    queryKey: ["teams"],
    params,
  });
  return res;
}

export function useUpdateTeam({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiMutation({
    exact: false,
    method: "PUT",
    endpoint: apiEndpoints.teams.base,
    queryKey: ["teams"],
    params,
  });
  return res;
}

export function useDeleteTeam({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiMutation({
    exact: false,
    method: "DELETE",
    endpoint: apiEndpoints.teams.base,
    queryKey: ["teams"],
    params,
  });
  return res;
}
