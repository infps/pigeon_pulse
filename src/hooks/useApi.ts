"use client";

import axios, { AxiosRequestConfig } from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface ApiOptions {
  method?: Method;
  body?: any;
  params?: Record<string, any>;
  enabled?: boolean;
  headers?: Record<string, string>;
  invalidate?: string[]; // keys to invalidate
  onSuccess?: () => void;
  onError?: (err: any) => void;
}

const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

export function useApi<T = any>(url: string, options: ApiOptions = {}) {
  const {
    method = "GET",
    body,
    params,
    enabled = true,
    headers,
    invalidate,
    onSuccess,
    onError,
  } = options;

  const queryClient = useQueryClient();
  const key = [url, params]; // auto key

  const request = async () => {
    const config: AxiosRequestConfig = {
      url,
      method,
      params,
      data: body,
      headers,
    };

    const res = await apiClient.request(config);
    return res.data as T;
  };

  // For GET requests → useQuery
  if (method === "GET") {
    const query = useQuery({
      queryKey: key,
      queryFn: request,
      enabled,
      staleTime: 1000 * 60 * 3,
    });

    return {
      ...query,
      data: query.data as T,
    };
  }

  // For Mutations
  const mutation = useMutation({
    mutationFn: request,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });

      if (invalidate?.length) {
        queryClient.invalidateQueries({ queryKey: invalidate });
      }

      onSuccess?.();
    },
    onError: (err) => onError?.(err),
  });

  return {
    ...mutation,
    data: mutation.data as T,
  };
}
