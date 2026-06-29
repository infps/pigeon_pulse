"use client";

import { useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  useRaceBets,
  type RaceBetsResponse,
  type RaceBetPool,
  type RaceBetBird,
} from "@/lib/api/bets";

const CATEGORY_LABEL: Record<string, string> = {
  BELGIAN: "Belgian",
  STANDARD: "Standard",
  WTA: "WTA",
};

type Selection = { raceItemId: number; category: string; tierIndex: number; amount: number };
type CartKey = string;

function cartKey(raceItemId: number, category: string, tierIndex: number): CartKey {
  return `${raceItemId}-${category}-${tierIndex}`;
}
function poolKey(p: { category: string; tierIndex: number }) {
  return `${p.category}-${p.tierIndex}`;
}

export function RaceBettingTab({
  raceId,
  currentUserId,
}: {
  raceId: string;
  currentUserId: string | null;
}) {
  const qc = useQueryClient();
  const { data, isPending, error } = useRaceBets(raceId);

  const [cart, setCart] = useState<Map<CartKey, Selection>>(new Map());
  const [checkingOut, setCheckingOut] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popupRef = useRef<Window | null>(null);

  const resp = data as RaceBetsResponse | undefined;
  const pools: RaceBetPool[] = useMemo(() => resp?.pools ?? [], [resp]);
  const birds: RaceBetBird[] = useMemo(() => resp?.birds ?? [], [resp]);
  const bettingOpen = !!resp?.bettingOpen;
  const raceStatus = resp?.raceStatus ?? "";
  const registering = raceStatus === "REGISTERING";

  const cartTotal = useMemo(
    () => Array.from(cart.values()).reduce((s, v) => s + v.amount, 0),
    [cart]
  );
  const cartSelections = useMemo(() => Array.from(cart.values()), [cart]);

  const toggleCart = (bird: RaceBetBird, pool: RaceBetPool) => {
    const k = cartKey(bird.raceItemId, pool.category, pool.tierIndex);
    setCart((prev) => {
      const next = new Map(prev);
      if (next.has(k)) next.delete(k);
      else next.set(k, { raceItemId: bird.raceItemId, category: pool.category, tierIndex: pool.tierIndex, amount: pool.amount });
      return next;
    });
  };

  const invalidateBets = () => qc.invalidateQueries({ queryKey: ["bets", "race", String(raceId)] });

  const cleanupPopup = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    pollRef.current = null;
    timeoutRef.current = null;
    if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
    popupRef.current = null;
  };

  const handlePayPalCheckout = async () => {
    if (cartSelections.length === 0) return;
    setCheckingOut(true);

    const popup = window.open("about:blank", "paypal-bet-checkout", "width=500,height=700");
    if (!popup) {
      setCheckingOut(false);
      toast.error("Popup blocked. Allow popups and retry.");
      return;
    }
    popupRef.current = popup;

    try {
      popup.document.write(`<html><head><title>Redirecting to PayPal…</title></head>
        <body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f7f7f7;color:#333;">
          <div style="text-align:center"><div style="font-size:18px;margin-bottom:12px">Preparing your PayPal checkout…</div>
          <div style="font-size:14px;color:#777">Do not close this window.</div></div></body></html>`);
      popup.document.close();
    } catch { /* cross-origin fine */ }

    try {
      const orderRes = await fetch("/api/payment/paypal/create-bet-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          raceId: parseInt(raceId),
          selections: cartSelections.map((s) => ({ raceItemId: s.raceItemId, category: s.category, tierIndex: s.tierIndex })),
          currency: "USD",
        }),
      });
      const orderJson = await orderRes.json();
      if (!orderRes.ok || !orderJson?.orderID) {
        popup.close();
        throw new Error(orderJson?.message || "Failed to create PayPal order");
      }
      const { orderID, approveUrl } = orderJson;
      if (popup.closed) throw new Error("Payment window closed before checkout loaded");
      popup.location.replace(approveUrl || `https://www.sandbox.paypal.com/checkoutnow?token=${orderID}`);

      pollRef.current = setInterval(async () => {
        if (popup.closed) {
          cleanupPopup();
          setCheckingOut(false);
          toast.error("PayPal window closed before payment was approved");
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
            const capRes = await fetch("/api/payment/paypal/capture-bet-order", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                orderID,
                raceId: parseInt(raceId),
                selections: cartSelections.map((s) => ({ raceItemId: s.raceItemId, category: s.category, tierIndex: s.tierIndex })),
              }),
            });
            const capJson = await capRes.json();
            cleanupPopup();
            setCheckingOut(false);
            if (!capRes.ok) { toast.error(capJson?.message || "Payment capture failed"); return; }
            setCart(new Map());
            invalidateBets();
            toast.success(`Payment confirmed — ${capJson.betsCreated} bet(s) placed!`);
          }
        } catch { /* transient poll errors */ }
      }, 3000);

      timeoutRef.current = setTimeout(() => {
        cleanupPopup();
        setCheckingOut(false);
        toast.error("Payment timed out. Check PayPal or contact support.");
      }, 5 * 60 * 1000);
    } catch (err: any) {
      cleanupPopup();
      setCheckingOut(false);
      toast.error(err?.message || "Payment failed");
    }
  };

  if (isPending) return <div className="space-y-2"><Skeleton className="h-8 w-48" /><Skeleton className="h-40 w-full" /></div>;
  if (error) return <p className="text-sm text-red-600">Failed to load betting data.</p>;
  if (!currentUserId) return <p className="text-sm text-muted-foreground">Log in to place bets.</p>;
  if (pools.length === 0) return <p className="text-sm text-muted-foreground">No betting pools configured for this event.</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">Pools:</span>
        <Badge variant="outline">{raceStatus}</Badge>
        {bettingOpen
          ? <Badge className="bg-green-600">Open Pool Active</Badge>
          : <Badge variant="secondary">Owner Betting Only</Badge>}
      </div>

      {!registering && (
        <p className="text-sm text-amber-600">Betting is closed — the race has started or ended.</p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2 sticky left-0 bg-background">Bird</th>
              <th className="text-left p-2">Owner</th>
              {pools.map((p) => (
                <th key={poolKey(p)} className="text-center p-2 whitespace-nowrap">
                  <div className="font-semibold">{CATEGORY_LABEL[p.category]} #{p.tierIndex}</div>
                  <div className="text-xs text-muted-foreground">${p.amount}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {birds.map((bird) => {
              const canBet = registering && (bird.isOwnBird || bettingOpen);
              return (
                <tr key={bird.raceItemId} className="border-b hover:bg-muted/40">
                  <td className="p-2 font-medium sticky left-0 bg-background">
                    {bird.band ?? "-"}
                    {bird.isOwnBird && <Badge variant="outline" className="ml-2 text-xs">Mine</Badge>}
                  </td>
                  <td className="p-2 text-muted-foreground">{bird.ownerName ?? "-"}</td>
                  {pools.map((pool) => {
                    const existing = bird.bets.find((b) => b.category === pool.category && b.tierIndex === pool.tierIndex);
                    const k = cartKey(bird.raceItemId, pool.category, pool.tierIndex);
                    const inCart = cart.has(k);
                    if (existing) {
                      const isOwnerBet = bird.ownerUserId !== null && existing.bettorId === bird.ownerUserId;
                      const paid = existing.stakePaymentId !== null;
                      const cellBg = isOwnerBet
                        ? (paid ? "bg-green-100" : "bg-green-50")
                        : (paid ? "bg-pink-100" : "bg-pink-50");
                      return (
                        <td key={poolKey(pool)} className={`p-2 text-center ${cellBg}`}>
                          {existing.isYours ? <Badge className="bg-blue-600">Yours</Badge> : <Badge variant="secondary">Taken</Badge>}
                        </td>
                      );
                    }
                    return (
                      <td key={poolKey(pool)} className="p-2 text-center">
                        {canBet ? (
                          <Button size="sm" variant={inCart ? "default" : "outline"}
                            className={inCart ? "bg-green-600 hover:bg-green-700" : ""}
                            disabled={checkingOut} onClick={() => toggleCart(bird, pool)}>
                            {inCart ? `✓ $${pool.amount}` : `$${pool.amount}`}
                          </Button>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {cart.size > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm">{cart.size} bet(s) selected</span>
              <span className="font-bold text-base">${cartTotal.toFixed(2)}</span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              {cartSelections.map((s) => (
                <div key={cartKey(s.raceItemId, s.category, s.tierIndex)}>
                  Bird #{s.raceItemId} → {CATEGORY_LABEL[s.category]} #{s.tierIndex} — ${s.amount}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={handlePayPalCheckout} disabled={checkingOut}
                className="bg-[#FFC439] hover:bg-[#f0b832] text-black">
                {checkingOut ? "Processing…" : `Pay $${cartTotal.toFixed(2)} with PayPal`}
              </Button>
              <Button variant="ghost" size="sm" disabled={checkingOut} onClick={() => setCart(new Map())}>
                Clear
              </Button>
            </div>
          </div>
        </>
      )}

      <Card>
        <CardContent className="p-3 text-xs text-muted-foreground">
          Click amounts to add to cart. Pay via PayPal to confirm. Payout goes to the bettor, not the bird&apos;s owner. One bet per bird per pool.
        </CardContent>
      </Card>
    </div>
  );
}
