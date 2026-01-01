import useApiRequest from "@/hooks/useApi";
import { apiEndpoints } from "../endpoints";

export function listRaceTypes({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiRequest({
    endpoint: apiEndpoints.raceTypes.base,
    queryKey: ["raceTypes", "list"],
    params,
  });
  return res;
}

export function createRaceType({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiRequest({
    exact: false,
    method: "POST",
    endpoint: apiEndpoints.raceTypes.base,
    queryKey: ["raceTypes"],
    params,
  });
  return res;
}

export function updateRaceType({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiRequest({
    exact: false,
    method: "PUT",
    endpoint: apiEndpoints.raceTypes.base,
    queryKey: ["raceTypes"],
    params,
  });
  return res;
}

export function deleteRaceType({ id }: { id: string }) {
  const res = useApiRequest({
    exact: false,
    method: "DELETE",
    endpoint: apiEndpoints.raceTypes.delete(id),
    queryKey: ["raceTypes"],
  });
  return res;
}