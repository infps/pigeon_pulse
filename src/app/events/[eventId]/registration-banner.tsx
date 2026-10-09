"use client";

import { useApiQuery } from "@/hooks/useApi";
import { authClient } from "@/lib/auth-client";

/** Tells a breeder when their own registration is not (yet) taking part. */
export function RegistrationBanner({ eventId }: { eventId: string }) {
  const { data: session } = authClient.useSession();
  const { data } = useApiQuery({
    queryKey: ["breeder", "payment-status", eventId],
    endpoint: `/api/breeder/event/${eventId}/payment-status`,
    enabled: (session?.user as { role?: string } | undefined)?.role === "BREEDER",
  });

  const status: string | undefined = data?.approvalStatus;
  if (status !== "WAITING" && status !== "REJECTED") return null;

  return status === "WAITING" ? (
    <div className="mb-4 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm">
      <strong>Pending approval.</strong> Your registration is waiting for the organizer to approve it.
      Your birds take part once it is approved; you can pay in the meantime.
    </div>
  ) : (
    <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm">
      <strong>Registration not approved.</strong> The organizer did not accept this registration.
      Anything you paid will be refunded.
    </div>
  );
}
