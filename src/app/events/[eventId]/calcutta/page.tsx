"use client";

import { use, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiEndpoints } from "@/lib/endpoints";
import { pusherClient } from "@/lib/pusher-client";

type Bird = { band: string | null; name: string | null };

type ActiveGroup = {
  id: number;
  groupNumber: number;
  birdCount: number;
  birds: Bird[];
  currentBid: number | null;
  bidderName: string | null;
  lastBidAt: string | null;
  startingBid: number;
  recentBids: { amount: number; bidderName: string; createdAt: string }[];
};

type CalcuttaConfig = {
  biddingDuration: number;
  antiSnipeDuration: number;
  bidRaiseOptions: number[];
  youtubeStreamUrl: string | null;
};

export default function CalcuttaBidPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);

  const [config, setConfig] = useState<CalcuttaConfig | null>(null);
  const [activeGroup, setActiveGroup] = useState<ActiveGroup | null>(null);
  const [currentBid, setCurrentBid] = useState<number | null>(null);
  const [bidderName, setBidderName] = useState<string | null>(null);
  const [lastBidAt, setLastBidAt] = useState<Date | null>(null);
  const [antiSnipeRemaining, setAntiSnipeRemaining] = useState(0);
  const [selectedRaise, setSelectedRaise] = useState<number | null>(null);
  const [bidding, setBidding] = useState(false);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load initial state
  useEffect(() => {
    fetch(apiEndpoints.calcutta.state(eventId))
      .then((r) => r.json())
      .then((data) => {
        setConfig(data.config);
        if (data.activeGroup) {
          setActiveGroup(data.activeGroup);
          setCurrentBid(data.activeGroup.currentBid);
          setBidderName(data.activeGroup.bidderName);
          if (data.activeGroup.lastBidAt) setLastBidAt(new Date(data.activeGroup.lastBidAt));
        }
        if (data.config?.bidRaiseOptions?.length) setSelectedRaise(data.config.bidRaiseOptions[0]);
      })
      .finally(() => setLoading(false));
  }, [eventId]);

  // Anti-snipe countdown
  useEffect(() => {
    if (!lastBidAt || !config) { setAntiSnipeRemaining(0); return; }
    const tick = () => {
      const elapsed = (Date.now() - lastBidAt.getTime()) / 1000;
      const remaining = Math.max(0, config.antiSnipeDuration - elapsed);
      setAntiSnipeRemaining(remaining);
    };
    tick();
    timerRef.current = setInterval(tick, 200);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [lastBidAt, config]);

  // Pusher subscription
  useEffect(() => {
    const channel = pusherClient.subscribe(`calcutta-${eventId}`);

    channel.bind("group-changed", (data: { groupId: number; groupNumber: number; birds: Bird[]; startingBid: number }) => {
      setActiveGroup((prev) => prev ? { ...prev, ...data, id: data.groupId, currentBid: null, bidderName: null, birdCount: data.birds.length, lastBidAt: null, recentBids: [], startingBid: data.startingBid } : {
        id: data.groupId,
        groupNumber: data.groupNumber,
        birdCount: data.birds.length,
        birds: data.birds,
        currentBid: null,
        bidderName: null,
        lastBidAt: null,
        startingBid: data.startingBid,
        recentBids: [],
      });
      setCurrentBid(null);
      setBidderName(null);
      setLastBidAt(null);
    });

    channel.bind("bid-placed", (data: { groupId: number; amount: number; bidderName: string; timestamp: string }) => {
      setCurrentBid(data.amount);
      setBidderName(data.bidderName);
      setLastBidAt(new Date(data.timestamp));
    });

    channel.bind("group-closed", (data: { isHouse: boolean; winnerName?: string; finalPrice?: number }) => {
      if (data.isHouse) {
        toast.info("Group marked as House");
      } else if (data.winnerName) {
        toast.success(`Sold to ${data.winnerName} for $${data.finalPrice}`);
      }
      setActiveGroup(null);
      setCurrentBid(null);
      setBidderName(null);
      setLastBidAt(null);
    });

    return () => { channel.unbind_all(); pusherClient.unsubscribe(`calcutta-${eventId}`); };
  }, [eventId]);

  const placeBid = async () => {
    if (!activeGroup || selectedRaise == null) return;
    const bidAmount = (currentBid ?? activeGroup.startingBid) + selectedRaise;
    setBidding(true);
    try {
      const res = await fetch(apiEndpoints.calcutta.bid(eventId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: activeGroup.id, amount: bidAmount }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      // Optimistic update; Pusher will confirm
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBidding(false);
    }
  };

  if (loading) return <div className="p-4 space-y-4"><Skeleton className="h-48 w-full" /><Skeleton className="h-32 w-full" /></div>;

  const youtubeUrl = config?.youtubeStreamUrl;
  const bidRaiseOptions = config?.bidRaiseOptions ?? [];
  const bidAmount = activeGroup ? (currentBid ?? activeGroup.startingBid) + (selectedRaise ?? 0) : 0;
  const antiSnipePct = config ? Math.min(1, antiSnipeRemaining / config.antiSnipeDuration) : 0;

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      {/* YouTube embed */}
      {youtubeUrl && (
        <div className="aspect-video w-full">
          <iframe src={youtubeUrl} className="w-full h-full rounded-lg" allow="autoplay; encrypted-media" allowFullScreen />
        </div>
      )}

      {!activeGroup ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Waiting for next group...</div>
      ) : (
        <>
          {/* Group header */}
          <div>
            <h2 className="text-lg font-semibold">Group #{activeGroup.groupNumber} — {activeGroup.birdCount} birds</h2>
            <div className="flex flex-wrap gap-1 mt-2">
              {activeGroup.birds.slice(0, 12).map((b, i) => (
                <Badge key={i} variant="outline" className="text-xs">{b.band ?? `Bird ${i + 1}`}</Badge>
              ))}
              {activeGroup.birds.length > 12 && <Badge variant="outline" className="text-xs">+{activeGroup.birds.length - 12}</Badge>}
            </div>
          </div>

          {/* Current bid */}
          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs text-muted-foreground">Current Bid</div>
                <div className="text-3xl font-bold">
                  {currentBid != null ? `$${currentBid.toFixed(2)}` : `$${activeGroup.startingBid.toFixed(2)}`}
                </div>
                {bidderName && <div className="text-xs text-muted-foreground">{bidderName}</div>}
              </div>
              {lastBidAt && antiSnipeRemaining > 0 && (
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Anti-snipe</div>
                  <div className="text-lg font-mono">{antiSnipeRemaining.toFixed(1)}s</div>
                </div>
              )}
            </div>
            {lastBidAt && antiSnipeRemaining > 0 && (
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-500 transition-all duration-200"
                  style={{ width: `${antiSnipePct * 100}%` }}
                />
              </div>
            )}
          </div>

          {/* Raise buttons */}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {bidRaiseOptions.map((opt) => (
                <Button
                  key={opt}
                  variant={selectedRaise === opt ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedRaise(opt)}
                >
                  +${opt}
                </Button>
              ))}
            </div>
            <Button
              className="w-full"
              size="lg"
              onClick={placeBid}
              disabled={bidding || selectedRaise == null}
            >
              {bidding ? "Placing bid..." : `Bid $${bidAmount.toFixed(2)}`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
