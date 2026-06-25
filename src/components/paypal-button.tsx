"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface BetSelection {
  birdId: number;
  pools: { category: "BELGIAN" | "STANDARD" | "WTA"; tierIndex: number }[];
}

interface PayPalButtonProps {
  eventId: string;
  loftName: string;
  reservedBirds: number;
  birdIds: number[];
  bets?: BetSelection[];
  disabled?: boolean;
  onPaid?: () => void;
}

export function PayPalButton({
  eventId,
  loftName,
  reservedBirds,
  birdIds,
  bets = [],
  disabled,
  onPaid,
}: PayPalButtonProps) {
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popupRef = useRef<Window | null>(null);
  const inventoryRef = useRef<number | null>(null);

  useEffect(() => {
    return () => cleanup();
  }, []);

  const cleanup = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    pollRef.current = null;
    timeoutRef.current = null;
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close();
    }
    popupRef.current = null;
  };

  const rollbackRegistration = async () => {
    const id = inventoryRef.current;
    if (!id) return;
    inventoryRef.current = null;
    try {
      await fetch(`/api/breeder/event/${eventId}/registration/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
    } catch (err) {
      console.error("[PayPalButton] rollback error:", err);
    }
  };

  const finish = async (ok: boolean, msg: string) => {
    cleanup();
    if (!ok) {
      await rollbackRegistration();
    } else {
      inventoryRef.current = null;
    }
    setLoading(false);
    if (ok) {
      toast.success(msg);
      onPaid?.();
    } else {
      toast.error(msg);
    }
  };

  const start = async () => {
    setLoading(true);

    // Open popup synchronously to dodge popup blockers
    const popup = window.open("about:blank", "paypal-checkout", "width=500,height=700");
    if (!popup) {
      setLoading(false);
      toast.error("Popup blocked. Allow popups and retry.");
      return;
    }
    popupRef.current = popup;

    // Show loading screen inside popup while we fetch the PayPal URL
    try {
      popup.document.write(`
        <html><head><title>Redirecting to PayPal…</title></head>
        <body style="font-family: system-ui; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; background:#f7f7f7; color:#333;">
          <div style="text-align:center">
            <div style="font-size:18px; margin-bottom:12px">Preparing your PayPal checkout…</div>
            <div style="font-size:14px; color:#777">Do not close this window.</div>
          </div>
        </body></html>
      `);
      popup.document.close();
    } catch {
      // Cross-origin protection in some browsers — ignore, popup will still navigate.
    }

    try {
      // 1. Register
      const regRes = await fetch(`/api/breeder/event/${eventId}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          loftName,
          reservedBirds,
          birds: birdIds.map((id) => ({ birdId: id })),
          bets,
        }),
      });
      const regJson = await regRes.json();
      if (!regRes.ok) {
        popup.close();
        throw new Error(regJson?.message || "Registration failed");
      }
      const eventInventoryId = regJson?.data?.eventInventory?.id;
      if (!eventInventoryId) {
        popup.close();
        throw new Error("Registration did not return an inventory id");
      }
      inventoryRef.current = eventInventoryId;

      // 2. Payment status for the inventory we just created (skip PayPal if nothing due)
      const psRes = await fetch(
        `/api/breeder/event/${eventId}/payment-status?inventoryId=${eventInventoryId}`,
        { credentials: "include" }
      );
      const psJson = await psRes.json();
      const totalDue: number = psJson?.totalDue ?? 0;

      if (totalDue <= 0) {
        popup.close();
        await finish(true, "Registration successful (no payment required)");
        return;
      }

      // 3. Create order (server derives amount from pending Payment)
      const orderRes = await fetch("/api/payment/paypal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ eventInventoryId, currency: "USD" }),
      });
      const orderJson = await orderRes.json();
      if (!orderRes.ok || !orderJson?.orderID) {
        popup.close();
        throw new Error(orderJson?.message || "Failed to create PayPal order");
      }
      const orderID: string = orderJson.orderID;
      const approvalUrl: string =
        orderJson.approveUrl ||
        `https://www.sandbox.paypal.com/checkoutnow?token=${orderID}`;

      if (popup.closed) {
        throw new Error("Payment window was closed before checkout loaded");
      }
      popup.location.replace(approvalUrl);

      // 4. Poll for approval
      pollRef.current = setInterval(async () => {
        if (popup.closed) {
          finish(false, "PayPal window closed before approval");
          return;
        }
        try {
          const sRes = await fetch("/api/payment/paypal/check-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ orderID }),
          });
          const sJson = await sRes.json();
          if (sJson?.isApproved || sJson?.isCompleted) {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;

            // 5. Capture
            const capRes = await fetch("/api/payment/paypal/capture-order", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ orderID, eventInventoryId }),
            });
            const capJson = await capRes.json();
            if (!capRes.ok || capJson?.status !== "COMPLETED") {
              finish(false, capJson?.message || "Failed to capture payment");
              return;
            }
            finish(true, "Payment confirmed — registration complete");
          }
        } catch (err) {
          console.error("[PayPalButton] poll error:", err);
        }
      }, 3000);

      // 6. Timeout after 5 min
      timeoutRef.current = setTimeout(() => {
        finish(false, "Payment timed out. Check PayPal or contact support.");
      }, 5 * 60 * 1000);
    } catch (err: any) {
      await finish(false, err?.message || "Payment failed");
    }
  };

  return (
    <Button
      type="button"
      onClick={start}
      disabled={disabled || loading}
      className="bg-[#FFC439] hover:bg-[#f0b832] text-black"
    >
      {loading ? "Processing..." : "Register & Pay with PayPal"}
    </Button>
  );
}
