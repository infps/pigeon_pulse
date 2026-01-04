// useApiQuery.ts
"use client";

import { useQuery } from "@tanstack/react-query";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

interface QueryConfig {
  mode?: RequestMode;
  endpoint?: string;
  queryKey?: string[];
  params?: Record<string, string>;
  headers?: Record<string, string>;
  options?: Record<string, any>;
  enabled?: boolean;
  baseUrl?: string;
}

export function useApiQuery({
  mode = "cors",
  endpoint,
  queryKey = [],
  params,
  headers,
  options,
  enabled = true,
  baseUrl,
}: QueryConfig) {
  const BASE_URL = baseUrl ?? API_URL;

  const fetchData = async () => {
    const queryStr = new URLSearchParams(params).toString();
    const url = `${BASE_URL}${endpoint ?? ""}${queryStr ? `?${queryStr}` : ""}`;

    const config: RequestInit = {
      mode,
      method: "GET",
      headers: headers ?? { "Content-Type": "application/json" },
      credentials: "include",
      ...options,
    };

    const response = await fetch(url, config);
    
    if (response.status === 204) {
      return null;
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`${JSON.stringify(data?.error || data)}`, {
        cause: response.status,
      });
    }

    return data;
  };

  const query = useQuery({
    queryKey,
    queryFn: fetchData,
    enabled,
    refetchOnWindowFocus: false,
    retry: false,
    refetchOnReconnect: false,
    staleTime: Infinity,
  });

  return {
    data: query.data,
    error: query.error,
    isPending: query.isPending,
    isError: query.isError,
    isSuccess: query.isSuccess,
    refetch: query.refetch,
  };
}