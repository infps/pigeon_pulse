import  { useApiQuery } from "@/hooks/useApi";
import { apiEndpoints } from "../endpoints";
import { useApiMutation } from "@/hooks/useApiMutation";

export function useListTeams({ params, endpoint }: { params?: Record<string, string>; endpoint?: string } = {}) {
  const paramKeys = params ? Object.keys(params).sort().map((key) => `${key}-${params[key]}`).join("_") : "all";
  const res = useApiQuery({
    endpoint: endpoint || apiEndpoints.teams.base,
    queryKey: ["teams", "list", paramKeys],
    params,
  });
  return res;
}

export function useCreateTeam({ params, endpoint }: { params?: Record<string, string>; endpoint?: string } = {}) {
  const res = useApiMutation({
    exact: false,
    method: "POST",
    endpoint: endpoint || apiEndpoints.teams.base,
    queryKey: ["teams"],
    params,
  });
  return res;
}

export function useUpdateTeam({ params, endpoint }: { params?: Record<string, string>; endpoint?: string } = {}) {
  const res = useApiMutation({
    exact: false,
    method: "PUT",
    endpoint: endpoint || apiEndpoints.teams.base,
    queryKey: ["teams"],
    params,
  });
  return res;
}

export function useDeleteTeam({ params, endpoint }: { params?: Record<string, string>; endpoint?: string } = {}) {
  const res = useApiMutation({
    exact: false,
    method: "DELETE",
    endpoint: endpoint || apiEndpoints.teams.base,
    queryKey: ["teams"],
    params,
  });
  return res;
}
