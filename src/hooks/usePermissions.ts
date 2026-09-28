"use client";

import { useQuery } from "@tanstack/react-query";

export interface MyPermissions {
  signedIn: boolean;
  userId?: string;
  role: string | null;
  approvalStatus?: string;
  isApproved?: boolean;
  permissions: string[];
  isAdminCapable?: boolean;
}

const EMPTY: MyPermissions = {
  signedIn: false,
  role: null,
  permissions: [],
  isAdminCapable: false,
};

/**
 * What the signed-in user may do.
 *
 * Used to hide controls that would only fail. This is presentation, never
 * protection: every route re-checks the same permission, so a hidden button and
 * a forged request end at the same guard.
 *
 * Cached for a minute — the server-side grant cache is ten seconds, so a change
 * takes effect quickly without a request per rendered control.
 */
export function usePermissions() {
  const { data, isPending, refetch } = useQuery({
    queryKey: ["me", "permissions"],
    queryFn: async (): Promise<MyPermissions> => {
      const res = await fetch("/api/me/permissions");
      if (!res.ok) return EMPTY;
      return res.json();
    },
    staleTime: 60_000,
    retry: 1,
  });

  const me = data ?? EMPTY;
  const held = new Set(me.permissions);

  return {
    ...me,
    isPending,
    refetch,
    /** Does the user hold this permission? */
    can: (permission: string) => held.has(permission),
    /** Any one of them — for a screen several roles reach by different routes. */
    canAny: (...permissions: string[]) => permissions.some((p) => held.has(p)),
    /** All of them — for an action that touches more than one module. */
    canAll: (...permissions: string[]) => permissions.every((p) => held.has(p)),
  };
}
