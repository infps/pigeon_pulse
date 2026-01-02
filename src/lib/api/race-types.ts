import useApiRequest from "@/hooks/useApi";
import { apiEndpoints } from "../endpoints";
import type {
  RaceTypesResponse,
  CreateRaceTypeInput,
  UpdateRaceTypeInput,
  DeleteRaceTypeInput,
} from "../types";

export function useListRaceTypes({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiRequest({
    endpoint: apiEndpoints.raceTypes.base,
    queryKey: ["raceTypes", "list"],
    params,
  });
  return res;
}

export function useCreateRaceType({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiRequest({
    exact: false,
    method: "POST",
    endpoint: apiEndpoints.raceTypes.base,
    queryKey: ["raceTypes"],
    params,
  });
  return res;
}

export function useUpdateRaceType({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiRequest({
    exact: false,
    method: "PUT",
    endpoint: apiEndpoints.raceTypes.base,
    queryKey: ["raceTypes"],
    params,
  });
  return res;
}

export function useDeleteRaceType({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiRequest({
    exact: false,
    method: "DELETE",
    endpoint: apiEndpoints.raceTypes.base,
    queryKey: ["raceTypes"],
    params,
  });
  return res;
}