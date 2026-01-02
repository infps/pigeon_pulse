import useApiRequest from "@/hooks/useApi";
import { apiEndpoints } from "../endpoints";
import type {
  BettingSchemesResponse,
  CreateBettingSchemeInput,
  UpdateBettingSchemeInput,
  DeleteBettingSchemeInput,
  BettingSchemeResponse,
} from "../types";

export function useListBettingSchemes({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiRequest<BettingSchemesResponse>({
    endpoint: apiEndpoints.bettingSchemes.base,
    queryKey: ["bettingSchemes", "list"],
    params,
  });
  return res;
}

export function useCreateBettingScheme({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiRequest<BettingSchemeResponse, CreateBettingSchemeInput>({
    exact: false,
    method: "POST",
    endpoint: apiEndpoints.bettingSchemes.base,
    queryKey: ["bettingSchemes"],
    params,
  });
  return res;
}

export function useUpdateBettingScheme({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiRequest<BettingSchemeResponse, UpdateBettingSchemeInput>({
    exact: false,
    method: "PUT",
    endpoint: apiEndpoints.bettingSchemes.base,
    queryKey: ["bettingSchemes"],
    params,
  });
  return res;
}

export function useDeleteBettingScheme({ params }: { params?: Record<string, string> } = {}) {
  const res = useApiRequest<any, DeleteBettingSchemeInput>({
    exact: false,
    method: "DELETE",
    endpoint: apiEndpoints.bettingSchemes.base,
    queryKey: ["bettingSchemes"],
    params,
  });
  return res;
}
