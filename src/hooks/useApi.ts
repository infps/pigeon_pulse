"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export type RequestMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
export type RequestMode = "cors" | "no-cors" | "same-origin" | "navigate";

interface RequestConfig {
  mode?: RequestMode;
  bodyType?: "json" | "formdata";
  endpoint?: string;
  exact?: boolean;
  queryKey?: string[];
  method?: RequestMethod;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  options?: Record<string, any>;
  enabled?: boolean;
  onSuccess?: () => void;
  onError?: (error: {
    name: string;
    message: string;
    cause?: any;
    stack?: string;
  }) => void;
  baseUrl?: string;
  queryString?: string;
}

export default function useApiRequest({
  bodyType = "json",
  endpoint,
  exact = true,
  mode = "cors",
  queryKey = [],
  method = "GET",
  params,
  headers,
  options,
  enabled = true,
  onSuccess,
  onError,
  baseUrl,
}: RequestConfig) {
  const queryClient = useQueryClient();
  const BASE_URL = baseUrl ?? API_URL;
  console.log("API BASE URL:", BASE_URL);
  const fetchData = async (body: any = null) => {
    const queryStr = new URLSearchParams(params).toString();

    const url = `${BASE_URL}${endpoint ?? ""}${queryStr ? `?${queryStr}` : ""}`;

    const config: RequestInit = {
      mode,
      method,
      headers: headers ?? {
        "Content-Type": "application/json",
      },
      credentials: "include",
      ...options,
    };

    if (body && method !== "GET" && bodyType === "json") {
      config.body = JSON.stringify(body);
    }

    if (bodyType === "formdata") {
      config.body = body;
    }

    try {
      const response = await fetch(url, config);
      const statusCode = response.status;
      if (statusCode === 204) {
        return { data: null, status: statusCode };
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(`${JSON.stringify(data?.error || data)}`, {
          cause: statusCode,
        });
      }

      return { data, status: statusCode };
    } catch (err) {
      if (err instanceof Error) {
        return {
          error: err?.message ?? JSON.stringify(err),
          status: err?.cause || 500,
        };
      }
      return { data: { message: "From Internal error" }, status: 500 };
    }
  };

  if (enabled && method === "GET") {
    const query = useQuery({
      queryKey,
      queryFn: () => fetchData(),
      refetchOnWindowFocus: false,
      retry: false,
      refetchOnReconnect: false,
      staleTime: Infinity,
    });

    return {
      data: query.data?.data,
      error: query.error,
      isPending: query.isPending,
      isError: query.isError,
      isSuccess: query.isSuccess,
    };
  }

  const {
    data,
    error,
    mutate,
    mutateAsync,
    isPending,
    isSuccess,
    isError,
    reset,
  } = useMutation({
    mutationFn: async (data?: Record<string, any> | FormData) => {
      const response = await fetchData(data);
      return response;
    },
    onSuccess: async ({ status }) => {
      if ([200, 201].includes(status as number))
        queryClient.invalidateQueries({ queryKey, exact });
      if (onSuccess) onSuccess();
    },
    onError: ({ message, name, cause, stack }) => {
      console.log({ message, name, cause, stack });
      if (onError) onError({ message, name, cause, stack });
    },
  });

  return {
    data: data?.data,
    error,
    isPending,
    isError,
    isSuccess,
    mutate,
    mutateAsync,
    reset,
  };
}