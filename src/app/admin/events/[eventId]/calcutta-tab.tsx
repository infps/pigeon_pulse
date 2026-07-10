"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiEndpoints } from "@/lib/endpoints";
import { pusherClient } from "@/lib/pusher-client";

// ── Types ─────────────────────────────────────────────────────────────────────

type CalcuttaConfig = {
  id: number;
  eventId: number;
  pricePerBird: number;
  targetGroupSize: number;
  biddingDuration: number;
  antiSnipeDuration: number;
  bidRaiseOptions: number[];
  youtubeStreamUrl: string | null;
  phase: string;
  activeGroupId: number | null;
};

type CalcuttaGroup = {
  id: number;
  groupNumber: number;
  birdCount: number;
  calculatedPrice: number;
  startingBid: number;
  status: string;
  isHouse: boolean;
  finalPrice: number | null;
  owner: { id: string; name: string } | null;
  lastBidAt: string | null;
  currentBid: { amount: number; bidderName: string } | null;
  members: { eventInventoryId: number; breeder: { firstName: string | null; lastName: string | null } | null }[];
};

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  EARLY_BOUGHT: "bg-blue-100 text-blue-700",
  BIDDING: "bg-yellow-100 text-yellow-800",
  SOLD: "bg-green-100 text-green-700",
  HOUSE: "bg-orange-100 text-orange-700",
  COMPLETED: "bg-purple-100 text-purple-700",
};

function StatusBadge({ status }: { status: string }) {
  return <Badge className={STATUS_COLORS[status] ?? "bg-gray-100"}>{status.replace("_", " ")}</Badge>;
}

// ── Setup sub-tab ─────────────────────────────────────────────────────────────

function SetupTab({ eventId, config, onSaved }: { eventId: string; config: CalcuttaConfig | null; onSaved: () => void }) {
  const [pricePerBird, setPricePerBird] = useState(config?.pricePerBird?.toString() ?? "");
  const [targetGroupSize, setTargetGroupSize] = useState(config?.targetGroupSize?.toString() ?? "15");
  const [biddingDuration, setBiddingDuration] = useState(config?.biddingDuration?.toString() ?? "120");
  const [antiSnipeDuration, setAntiSnipeDuration] = useState(config?.antiSnipeDuration?.toString() ?? "10");
  const [bidRaiseOptions, setBidRaiseOptions] = useState(config?.bidRaiseOptions?.join(",") ?? "10,50,100,500");
  const [youtubeStreamUrl, setYoutubeStreamUrl] = useState(config?.youtubeStreamUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [groupCount, setGroupCount] = useState<number | null>(null);

  const saveConfig = async () => {
    setSaving(true);
    try {
      const res = await fetch(apiEndpoints.calcutta.config(eventId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pricePerBird: Number(pricePerBird),
          targetGroupSize: Number(targetGroupSize),
          biddingDuration: Number(biddingDuration),
          antiSnipeDuration: Number(antiSnipeDuration),
          bidRaiseOptions: bidRaiseOptions.split(",").map((x) => parseInt(x.trim())).filter(Boolean),
          youtubeStreamUrl: youtubeStreamUrl || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      toast.success("Config saved");
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const generateGroups = async () => {
    setGenerating(true);
    setConfirmGenerate(false);
    try {
      const res = await fetch(apiEndpoints.calcutta.generateGroups(eventId), { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setGroupCount(data.groups.length);
      toast.success(`Generated ${data.groups.length} groups`);
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Calcutta Setup</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Price per Bird ($)</Label>
            <Input type="number" value={pricePerBird} onChange={(e) => setPricePerBird(e.target.value)} />
          </div>
          <div>
            <Label>Target Group Size</Label>
            <Input type="number" value={targetGroupSize} onChange={(e) => setTargetGroupSize(e.target.value)} />
          </div>
          <div>
            <Label>Bidding Duration (seconds)</Label>
            <Input type="number" value={biddingDuration} onChange={(e) => setBiddingDuration(e.target.value)} />
          </div>
          <div>
            <Label>Anti-snipe Duration (seconds)</Label>
            <Input type="number" value={antiSnipeDuration} onChange={(e) => setAntiSnipeDuration(e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Bid Raise Options (comma-separated)</Label>
            <Input value={bidRaiseOptions} onChange={(e) => setBidRaiseOptions(e.target.value)} placeholder="10,50,100,500" />
          </div>
          <div className="col-span-2">
            <Label>YouTube Stream URL (optional)</Label>
            <Input value={youtubeStreamUrl} onChange={(e) => setYoutubeStreamUrl(e.target.value)} placeholder="https://youtube.com/embed/..." />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={saveConfig} disabled={saving}>{saving ? "Saving..." : "Save Config"}</Button>
          <Button variant="outline" onClick={() => setConfirmGenerate(true)} disabled={!config}>
            Generate Groups
          </Button>
        </div>
        {groupCount !== null && <p className="text-sm text-muted-foreground">{groupCount} groups generated.</p>}

        <Dialog open={confirmGenerate} onOpenChange={setConfirmGenerate}>
          <DialogContent>
            <DialogHeader><DialogTitle>Regenerate Groups?</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">This will delete all PENDING groups and regenerate. EARLY_BOUGHT/SOLD/HOUSE groups are preserved.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmGenerate(false)}>Cancel</Button>
              <Button onClick={generateGroups} disabled={generating}>{generating ? "Generating..." : "Generate"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ── Groups sub-tab ────────────────────────────────────────────────────────────

function GroupsTab({ eventId, groups, onRefresh }: { eventId: string; groups: CalcuttaGroup[]; onRefresh: () => void }) {
  const [earlyBuyGroupId, setEarlyBuyGroupId] = useState<number | null>(null);
  const [repriceGroupId, setRepriceGroupId] = useState<number | null>(null);
  const [houseGroupId, setHouseGroupId] = useState<number | null>(null);
  const [buyerId, setBuyerId] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [loading, setLoading] = useState(false);

  const doEarlyBuy = async () => {
    if (!earlyBuyGroupId) return;
    setLoading(true);
    try {
      const res = await fetch(apiEndpoints.calcutta.earlyBuy(eventId, earlyBuyGroupId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyerId }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      toast.success("Early buy recorded");
      setEarlyBuyGroupId(null);
      setBuyerId("");
      onRefresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const doReprice = async () => {
    if (!repriceGroupId) return;
    setLoading(true);
    try {
      const res = await fetch(apiEndpoints.calcutta.reprice(eventId, repriceGroupId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newStartingBid: Number(newPrice) }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      toast.success("Repriced");
      setRepriceGroupId(null);
      setNewPrice("");
      onRefresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const doSetHouse = async () => {
    if (!houseGroupId) return;
    setLoading(true);
    try {
      const res = await fetch(apiEndpoints.calcutta.setHouse(eventId, houseGroupId), { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).message);
      toast.success("Marked as House");
      setHouseGroupId(null);
      onRefresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (groups.length === 0) return <p className="text-sm text-muted-foreground">No groups yet. Generate groups in Setup tab.</p>;

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-4">Group</th>
              <th className="py-2 pr-4">Birds</th>
              <th className="py-2 pr-4">Calc Price</th>
              <th className="py-2 pr-4">Start Bid</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Owner</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.id} className="border-b hover:bg-muted/30">
                <td className="py-2 pr-4 font-medium">#{g.groupNumber}</td>
                <td className="py-2 pr-4">{g.birdCount}</td>
                <td className="py-2 pr-4">${g.calculatedPrice.toFixed(2)}</td>
                <td className="py-2 pr-4">${g.startingBid.toFixed(2)}</td>
                <td className="py-2 pr-4"><StatusBadge status={g.status} /></td>
                <td className="py-2 pr-4">{g.owner?.name ?? (g.isHouse ? "House" : "—")}</td>
                <td className="py-2">
                  {g.status === "PENDING" && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => setEarlyBuyGroupId(g.id)}>Early Sell</Button>
                      <Button size="sm" variant="outline" onClick={() => { setRepriceGroupId(g.id); setNewPrice(g.startingBid.toString()); }}>Re-price</Button>
                      <Button size="sm" variant="outline" onClick={() => setHouseGroupId(g.id)}>House</Button>
                    </div>
                  )}
                  {g.status === "BIDDING" && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => setHouseGroupId(g.id)}>House</Button>
                      <Button size="sm" variant="outline" onClick={() => { setRepriceGroupId(g.id); setNewPrice(g.startingBid.toString()); }}>Re-price</Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Early Buy Dialog */}
      <Dialog open={earlyBuyGroupId !== null} onOpenChange={() => setEarlyBuyGroupId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Early Buy — Group #{groups.find((g) => g.id === earlyBuyGroupId)?.groupNumber}</DialogTitle></DialogHeader>
          <div>
            <Label>Buyer User ID</Label>
            <Input value={buyerId} onChange={(e) => setBuyerId(e.target.value)} placeholder="User ID" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEarlyBuyGroupId(null)}>Cancel</Button>
            <Button onClick={doEarlyBuy} disabled={loading || !buyerId}>Confirm Early Buy</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reprice Dialog */}
      <Dialog open={repriceGroupId !== null} onOpenChange={() => setRepriceGroupId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Re-price — Group #{groups.find((g) => g.id === repriceGroupId)?.groupNumber}</DialogTitle></DialogHeader>
          <div>
            <Label>New Starting Bid ($)</Label>
            <Input type="number" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRepriceGroupId(null)}>Cancel</Button>
            <Button onClick={doReprice} disabled={loading || !newPrice}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* House Dialog */}
      <Dialog open={houseGroupId !== null} onOpenChange={() => setHouseGroupId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark as House</DialogTitle></DialogHeader>
          <p className="text-sm">Group #{groups.find((g) => g.id === houseGroupId)?.groupNumber} will be marked as House (no external owner).</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHouseGroupId(null)}>Cancel</Button>
            <Button onClick={doSetHouse} disabled={loading}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Auction sub-tab ───────────────────────────────────────────────────────────

type BidEntry = { amount: number; bidderName: string; timestamp: string };

function AuctionTab({
  eventId,
  config,
  groups,
  onRefresh,
}: {
  eventId: string;
  config: CalcuttaConfig | null;
  groups: CalcuttaGroup[];
  onRefresh: () => void;
}) {
  const [activeGroup, setActiveGroup] = useState<CalcuttaGroup | null>(
    config?.activeGroupId ? groups.find((g) => g.id === config.activeGroupId) ?? null : null
  );
  const [currentBid, setCurrentBid] = useState<number | null>(null);
  const [currentBidder, setCurrentBidder] = useState<string | null>(null);
  const [bidLog, setBidLog] = useState<BidEntry[]>([]);
  const [lastBidAt, setLastBidAt] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [starting, setStarting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pendingGroups = groups.filter((g) => g.status === "PENDING");
  const nextUp = pendingGroups[0];
  const antiSnipe = config?.antiSnipeDuration ?? 10;

  // Tick elapsed since last bid
  useEffect(() => {
    if (!lastBidAt) { setElapsed(0); return; }
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - lastBidAt.getTime()) / 1000));
    }, 500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [lastBidAt]);

  // Pusher subscription
  useEffect(() => {
    const channel = pusherClient.subscribe(`calcutta-${eventId}`);

    channel.bind("bid-placed", (data: { groupId: number; amount: number; bidderName: string; timestamp: string }) => {
      if (activeGroup && data.groupId === activeGroup.id) {
        setCurrentBid(data.amount);
        setCurrentBidder(data.bidderName);
        setLastBidAt(new Date(data.timestamp));
        setBidLog((prev) => [data, ...prev].slice(0, 10));
      }
    });

    channel.bind("group-changed", (data: { groupId: number; groupNumber: number }) => {
      const g = groups.find((g) => g.id === data.groupId);
      if (g) { setActiveGroup(g); setCurrentBid(null); setCurrentBidder(null); setBidLog([]); setLastBidAt(null); }
      onRefresh();
    });

    channel.bind("group-closed", () => {
      setActiveGroup(null);
      setCurrentBid(null);
      setCurrentBidder(null);
      setBidLog([]);
      setLastBidAt(null);
      onRefresh();
    });

    return () => { channel.unbind_all(); pusherClient.unsubscribe(`calcutta-${eventId}`); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, activeGroup?.id]);

  const startGroup = async () => {
    if (!selectedGroupId) return;
    setStarting(true);
    try {
      const res = await fetch(apiEndpoints.calcutta.auctionStart(eventId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: parseInt(selectedGroupId) }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      toast.success("Group started");
      onRefresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setStarting(false);
    }
  };

  const closeGroup = async () => {
    setClosing(true);
    try {
      const res = await fetch(apiEndpoints.calcutta.auctionClose(eventId), { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        if (data.remainingMs) {
          toast.error(`Anti-snipe active — ${Math.ceil(data.remainingMs / 1000)}s remaining`);
        } else {
          throw new Error(data.message || data.error);
        }
        return;
      }
      toast.success(`Sold to ${data.winnerName} for $${data.finalPrice}`);
      onRefresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setClosing(false);
    }
  };

  const youtubeUrl = config?.youtubeStreamUrl;

  return (
    <div className="flex gap-4">
      {/* Left: stream */}
      <div className="flex-1 min-w-0">
        {youtubeUrl ? (
          <div className="aspect-video w-full">
            <iframe src={youtubeUrl} className="w-full h-full rounded-lg" allow="autoplay; encrypted-media" allowFullScreen />
          </div>
        ) : (
          <div className="aspect-video w-full bg-muted rounded-lg flex items-center justify-center text-muted-foreground text-sm">
            No stream URL configured
          </div>
        )}
      </div>

      {/* Right: controls */}
      <div className="w-80 shrink-0 space-y-4">
        {activeGroup ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Group #{activeGroup.groupNumber} — {activeGroup.birdCount} birds</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-2xl font-bold">
                {currentBid != null ? `$${currentBid.toFixed(2)}` : "No bids yet"}
              </div>
              {currentBidder && <div className="text-sm text-muted-foreground">Bidder: {currentBidder}</div>}

              {/* Anti-snipe indicator */}
              {lastBidAt && (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">
                    {elapsed < antiSnipe
                      ? `Anti-snipe: ${antiSnipe - elapsed}s remaining`
                      : "Anti-snipe cleared"}
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, (elapsed / antiSnipe) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">No active group</CardContent>
          </Card>
        )}

        {/* Controls */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select group..." />
              </SelectTrigger>
              <SelectContent>
                {pendingGroups.map((g) => (
                  <SelectItem key={g.id} value={String(g.id)}>
                    Group #{g.groupNumber} ({g.birdCount} birds)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={startGroup} disabled={starting || !selectedGroupId}>Start</Button>
          </div>
          {activeGroup && (
            <Button className="w-full" variant="destructive" onClick={closeGroup} disabled={closing}>
              {closing ? "Closing..." : "Close Group"}
            </Button>
          )}
        </div>

        {/* Next up */}
        {nextUp && nextUp.id !== activeGroup?.id && (
          <p className="text-xs text-muted-foreground">Next: Group #{nextUp.groupNumber} ({nextUp.birdCount} birds)</p>
        )}

        {/* Bid log */}
        {bidLog.length > 0 && (
          <Card>
            <CardHeader className="pb-1"><CardTitle className="text-sm">Recent Bids</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {bidLog.map((b, i) => (
                <div key={i} className="text-xs flex justify-between">
                  <span className="font-medium">${b.amount.toFixed(2)}</span>
                  <span className="text-muted-foreground">{b.bidderName}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ── Root tab ──────────────────────────────────────────────────────────────────

export function CalcuttaTab({ eventId }: { eventId: string }) {
  const [config, setConfig] = useState<CalcuttaConfig | null>(null);
  const [groups, setGroups] = useState<CalcuttaGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [cfgRes, grpRes] = await Promise.all([
        fetch(apiEndpoints.calcutta.config(eventId)),
        fetch(apiEndpoints.calcutta.groups(eventId)),
      ]);
      if (cfgRes.ok) { const d = await cfgRes.json(); setConfig(d.config); }
      if (grpRes.ok) { const d = await grpRes.json(); setGroups(d.groups); }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [eventId]);

  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <Tabs defaultValue="setup" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="setup">Setup</TabsTrigger>
        <TabsTrigger value="groups">Groups ({groups.length})</TabsTrigger>
        <TabsTrigger value="auction">Auction</TabsTrigger>
      </TabsList>

      <TabsContent value="setup" className="mt-4">
        <SetupTab eventId={eventId} config={config} onSaved={fetchData} />
      </TabsContent>

      <TabsContent value="groups" className="mt-4">
        <GroupsTab eventId={eventId} groups={groups} onRefresh={fetchData} />
      </TabsContent>

      <TabsContent value="auction" className="mt-4">
        <AuctionTab eventId={eventId} config={config} groups={groups} onRefresh={fetchData} />
      </TabsContent>
    </Tabs>
  );
}
