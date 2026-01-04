// useApiMutation.ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export type RequestMethod = "POST" | "PUT" | "DELETE" | "PATCH";

interface MutationConfig {
  mode?: RequestMode;
  bodyType?: "json" | "formdata";
  endpoint?: string;
  exact?: boolean;
  queryKey?: string[];
  method?: RequestMethod;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  options?: Record<string, any>;
  onSuccess?: () => void;
  onError?: (error: any) => void;
  baseUrl?: string;
}

export function useApiMutation({
  bodyType = "json",
  endpoint,
  exact = true,
  mode = "cors",
  queryKey = [],
  method = "POST",
  params,
  headers,
  options,
  onSuccess,
  onError,
  baseUrl,
}: MutationConfig) {
  const queryClient = useQueryClient();
  const BASE_URL = baseUrl ?? API_URL;

  const fetchData = async (body: any = null) => {
    const queryStr = new URLSearchParams(params).toString();
    const url = `${BASE_URL}${endpoint ?? ""}${queryStr ? `?${queryStr}` : ""}`;

    const config: RequestInit = {
      mode,
      method,
      headers: bodyType === "formdata" ? undefined : (headers ?? {
        "Content-Type": "application/json",
      }),
      credentials: "include",
      ...options,
    };

    if (body) {
      config.body = bodyType === "json" ? JSON.stringify(body) : body;
    }

    const response = await fetch(url, config);
    
    if (response.status === 204) {
      return { data: null, status: 204 };
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`${JSON.stringify(data?.error || data)}`, {
        cause: response.status,
      });
    }

    return { data, status: response.status };
  };

  const mutation = useMutation({
    mutationFn: async (data?: Record<string, any> | FormData) => {
      return await fetchData(data);
    },
    onSuccess: async ({ status }) => {
      if ([200, 201].includes(status as number)) {
        queryClient.invalidateQueries({ queryKey, exact });
      }
      if (onSuccess) onSuccess();
    },
    onError: (error) => {
      console.error(error);
      if (onError) onError(error);
    },
  });

  return {
    data: mutation.data?.data,
    error: mutation.error,
    isPending: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    reset: mutation.reset,
  };
}