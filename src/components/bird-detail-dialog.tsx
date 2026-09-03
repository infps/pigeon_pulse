"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User, ClipboardList, Package, Rocket, Flag,
  AlertTriangle, HelpCircle, History,
} from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { useBird, useUpdateBird } from "@/lib/api/bird";
import { useBirdHistory } from "@/lib/api/birds";
import { apiEndpoints } from "@/lib/endpoints";
import { ImageCapture } from "@/components/image-capture";
import { BirdPropertiesCard } from "@/app/admin/birds/[birdId]/bird-properties-card";
import { BirdLocationCard } from "@/app/admin/birds/[birdId]/bird-location-card";
import { BirdFeesCard } from "@/app/admin/birds/[birdId]/bird-fees-card";
import { BirdNotesCard } from "@/app/admin/birds/[birdId]/bird-notes-card";
import { BirdActions } from "@/app/admin/birds/[birdId]/bird-actions";
import type { UserRole } from "@/lib/types";
import type { InventoryItemView } from "@/app/admin/birds/[birdId]/bird-event-section";
import type { BirdHistoryEntry } from "@/lib/api/birds";

// ── inline panel content (no Card wrapper — avoids Card-in-tabs nesting) ──────

const HISTORY_ICON: Record<string, React.ElementType> = {
  REGISTERED: ClipboardList,
  BASKETED: Package,
  RELEASED: Rocket,
  ARRIVED: Flag,
  FOREIGN_BIRD: HelpCircle,
  LOST: AlertTriangle,
};

function primaryText(e: BirdHistoryEntry): string {
  switch (e.type) {
    case "REGISTERED": return `Registered for ${e.eventName ?? "event"}`;
    case "BASKETED":   return `Basketed in ${e.basketLabel ?? "basket"}`;
    case "RELEASED":   return `Released in ${e.raceName ?? "race"}`;
    case "ARRIVED":    return e.position ? `Arrived #${e.position} in ${e.raceName ?? "race"}` : `Arrived in ${e.raceName ?? "race"}`;
    case "FOREIGN_BIRD": return `Did not finish ${e.raceName ?? "race"}`;
    case "LOST":       return `Lost at ${e.raceName ?? "race"}`;
  }
}

function subText(e: BirdHistoryEntry): string | null {
  const parts: string[] = [];
  if (e.type !== "REGISTERED" && e.eventName) parts.push(e.eventName);
  if (e.type === "BASKETED" && e.phase) parts.push(`${e.phase} phase`);
  if (e.type === "ARRIVED" && e.prizeValue) parts.push(`Prize $${e.prizeValue}`);
  return parts.length ? parts.join(" • ") : null;
}

const ACTION_COLORS: Record<string, string> = {
  GROUP_ASSIGNED:  "bg-blue-100 text-blue-700",
  GROUP_MOVED:     "bg-amber-100 text-amber-700",
  GROUP_REMOVED:   "bg-red-100 text-red-700",
  RFID_LINKED:     "bg-purple-100 text-purple-700",
  BASKET_ASSIGNED: "bg-green-100 text-green-700",
  STATUS_CHANGED:  "bg-orange-100 text-orange-700",
  RELEASED:        "bg-sky-100 text-sky-700",
  ARRIVED:         "bg-emerald-100 text-emerald-700",
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "-";
  try { return new Date(d).toLocaleDateString(); } catch { return "-"; }
}

// ── main export ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  birdId: number | string | null;
  eventId?: number | null;
}

export function BirdDetailDialog({ open, onOpenChange, birdId, eventId }: Props) {
  const { data: session } = authClient.useSession();
  const role = session?.user?.role as UserRole | undefined;
  const isAdmin = role === "ADMIN" || role === "SUPERADMIN";

  // always use admin endpoint — this component only mounts inside admin UI
  const { data, isPending, isError, refetch } = useBird(
    birdId ? String(birdId) : "",
    "ADMIN"
  );
  const bird = (data as any)?.bird;
  const isOwner = isAdmin || ((data as any)?.isOwner ?? false);

  // race history — needed for tab badge count
  const { data: histData } = useBirdHistory(birdId ? String(birdId) : "");
  const histEntries: BirdHistoryEntry[] = (histData as any)?.entries ?? [];

  // audit/event history — needed for tab badge count
  const { data: auditData } = useQuery({
    queryKey: ["bird-event-history", birdId],
    queryFn: () => fetch(`/api/admin/bird/${birdId}/event-history`).then(r => r.json()),
    enabled: !!birdId,
  });
  const auditEntries: any[] = auditData?.history ?? [];

  const updateBird = useUpdateBird(birdId ? String(birdId) : "");
  const [attentionOptimistic, setAttentionOptimistic] = useState<boolean | null>(null);

  const handleImageChange = async (_url: string | null, file?: File | null) => {
    if (!birdId) return;
    const id = String(birdId);
    if (file) {
      const fd = new FormData();
      fd.append("image", file);
      try {
        const res = await fetch(apiEndpoints.breeder.birdImage(id), { method: "POST", body: fd });
        if (res.ok) { toast.success("Image uploaded"); refetch(); }
        else toast.error("Failed to upload image");
      } catch { toast.error("Failed to upload image"); }
    } else {
      try {
        const res = await fetch(apiEndpoints.breeder.birdImage(id), { method: "DELETE" });
        if (res.ok) { toast.success("Image removed"); refetch(); }
        else toast.error("Failed to remove image");
      } catch { toast.error("Failed to remove image"); }
    }
  };

  const handleAttentionToggle = async (next: boolean) => {
    setAttentionOptimistic(next);
    try {
      await updateBird.mutateAsync({ attention: next });
      toast.success(next ? "Marked for attention" : "Attention cleared");
      refetch();
    } catch {
      setAttentionOptimistic(!next);
      toast.error("Failed to update");
    }
  };

  if (!birdId) return null;

  const allItems: InventoryItemView[] = bird?.inventoryItems ?? [];
  // only show the item for this event; fall back to most recent if no eventId
  const eventItem = eventId != null
    ? allItems.find(it => it.eventInventory?.event?.id === eventId) ?? allItems[0]
    : allItems[0];

  const bandDisplay = bird
    ? [bird.band1, bird.band2, bird.band3, bird.band4].filter(Boolean).join("-")
    : "";
  const chipA = bird ? [bird.band1, bird.band2].filter(Boolean).join("-") : "";
  const chipB = bird ? [bird.band3, bird.band4].filter(Boolean).join("-") : "";
  const ownerName = bird?.breeder
    ? [bird.breeder.firstName, bird.breeder.lastName].filter(Boolean).join(" ") || "Unknown"
    : "Unknown";
  const attentionValue = attentionOptimistic ?? bird?.attention ?? false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {isPending
              ? <Skeleton className="h-6 w-40" />
              : <>{bird?.birdName || bandDisplay || "Bird Detail"}</>
            }
          </DialogTitle>
        </DialogHeader>

        {isPending && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="aspect-square rounded-lg" />
            <Skeleton className="h-80 rounded-lg" />
            <Skeleton className="h-80 rounded-lg" />
          </div>
        )}

        {isError && <p className="text-center py-12 text-red-500">Error loading bird details.</p>}

        {!isPending && !isError && bird && (
          <div className="space-y-6">

            {/* ── Row 1: Identity (tall) + Properties + Location + Notes ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:row-span-2">
                <CardContent className="pt-6 space-y-4">
                  <ImageCapture value={bird.image} onChange={handleImageChange} disabled={!isOwner} />

                  {(chipA || chipB) && (
                    <div className="flex flex-wrap gap-2">
                      {chipA && <Badge variant="outline" className="font-mono">{chipA}</Badge>}
                      {chipB && <Badge variant="outline" className="font-mono">{chipB}</Badge>}
                    </div>
                  )}

                  <div>
                    <h1 className="text-2xl font-bold leading-tight">{bird.birdName || "Unnamed Bird"}</h1>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-muted-foreground font-mono text-xs">{bandDisplay || "No band"}</p>
                      {bird.color && <Badge variant="outline" className="text-xs font-mono">{bird.color}</Badge>}
                    </div>
                  </div>

                  {isAdmin && <BirdActions bird={bird} onUpdated={() => refetch()} />}

                  {isAdmin && (
                    <div className="flex items-center justify-between pt-2 border-t">
                      <Label htmlFor="attention-bd" className="text-sm font-normal">
                        Pay attention during basketing
                      </Label>
                      <Switch id="attention-bd" checked={attentionValue}
                        onCheckedChange={handleAttentionToggle} disabled={updateBird.isPending} />
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2 border-t text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Owner</span>
                    <span className="ml-auto font-medium">{ownerName}</span>
                  </div>
                </CardContent>
              </Card>

              <BirdPropertiesCard bird={bird} isAdmin={isAdmin} onUpdated={() => refetch()} />

              <div className="space-y-4">
                <BirdLocationCard birdId={String(birdId)} />

                {/* Current Group */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Current Group</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Loft Group</p>
                      {eventItem?.currentGroup ? (
                        <div className="flex items-center gap-2 border rounded p-2">
                          <div className="w-4 h-4 rounded-full shrink-0 border" style={{ backgroundColor: eventItem.currentGroup.color ?? "#ccc" }} />
                          <span className="font-medium">{eventItem.currentGroup.name}</span>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Not assigned</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Tag Color</p>
                      {eventItem?.tagColorGroup ? (
                        <div className="flex items-center gap-2 border rounded p-2">
                          <div className="w-4 h-4 rounded-full shrink-0 border" style={{ backgroundColor: eventItem.tagColorGroup.color ?? "#ccc" }} />
                          <span className="font-medium">{eventItem.tagColorGroup.name}</span>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Not assigned</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-2">
                <BirdNotesCard birdId={String(birdId)} note={bird.note} canEdit={isAdmin} onUpdated={() => refetch()} />
              </div>
            </div>

            {/* ── Row 2: History tabs ── */}
            <Tabs defaultValue="races">
              <TabsList>
                <TabsTrigger value="races" className="gap-1.5">
                  Races
                  {histEntries.length > 0 && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">{histEntries.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="grouping">Grouping</TabsTrigger>
                <TabsTrigger value="vaccinations">Vaccinations</TabsTrigger>
                <TabsTrigger value="audit" className="gap-1.5">
                  Audit Log
                  {auditEntries.length > 0 && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">{auditEntries.length}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="races" className="mt-3">
                {histEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No race history yet.</p>
                ) : (
                  <ol className="relative space-y-4 border-l pl-4 pr-1 max-h-80 overflow-y-auto">
                    {histEntries.map((e, i) => {
                      const Icon = HISTORY_ICON[e.type] ?? History;
                      const sub = subText(e);
                      return (
                        <li key={i} className="relative">
                          <span className="absolute -left-[22px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-background ring-2 ring-border">
                            <Icon className="h-3 w-3" />
                          </span>
                          <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground">{new Date(e.date).toLocaleString()}</span>
                            <span className="text-sm font-medium">{primaryText(e)}</span>
                            {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </TabsContent>

              <TabsContent value="grouping" className="mt-3">
                <p className="text-sm text-muted-foreground">Group assignment history not available in this view.</p>
              </TabsContent>

              <TabsContent value="vaccinations" className="mt-3">
                <p className="text-sm text-muted-foreground">No vaccination records.</p>
              </TabsContent>

              <TabsContent value="audit" className="mt-3">
                {auditEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No event activity yet.</p>
                ) : (
                  <ol className="relative space-y-3 border-l pl-4 pr-1 max-h-80 overflow-y-auto">
                    {auditEntries.map((e: any) => (
                      <li key={e.id} className="relative">
                        <span className="absolute -left-[22px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-background ring-2 ring-border" />
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_COLORS[e.action] ?? "bg-gray-100 text-gray-700"}`}>
                              {e.action.replace(/_/g, " ")}
                            </span>
                            <span className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</span>
                          </div>
                          {e.detail && <p className="text-sm">{e.detail}</p>}
                          {e.performedBy?.name && <p className="text-xs text-muted-foreground">{e.performedBy.name}</p>}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </TabsContent>
            </Tabs>

            {/* ── Row 3: Event Fees + Bets + Group (single event) ── */}
            {eventItem && (() => {
              const eventName = eventItem.eventInventory?.event?.name ?? "Event";
              const signIn = eventItem.signInDate ?? eventItem.signInDateEvent;
              const baskets = eventItem.basketAssignments ?? [];

              // Bet slot amounts are per-event (fixed on EventInventoryItem).
              // stakePaid/isOwner are per-raceItem — so render tabs per race.
              type BetSlot = { label: string; value: number | null | undefined; stakePaid: boolean; isOwner: boolean | null };

              const BET_DEFS = [
                { prefix: "B", keys: ["belgianShowBet1","belgianShowBet2","belgianShowBet3","belgianShowBet4","belgianShowBet5","belgianShowBet6","belgianShowBet7"], category: "BELGIAN", title: "Belgian Show" },
                { prefix: "S", keys: ["standardShowBet1","standardShowBet2","standardShowBet3","standardShowBet4","standardShowBet5","standardShowBet6"], category: "STANDARD", title: "Standard Show" },
                { prefix: "W", keys: ["wtaBet1","wtaBet2","wtaBet3","wtaBet4","wtaBet5"], category: "WTA", title: "WTA" },
              ];

              function makeBetsForRace(raceBets: NonNullable<typeof eventItem.raceItems>[number]["bets"]): Record<string, BetSlot[]> {
                const result: Record<string, BetSlot[]> = {};
                for (const def of BET_DEFS) {
                  result[def.category] = def.keys.map((_k, idx) => {
                    const meta = (raceBets ?? []).find(b => b.category === def.category && b.tierIndex === idx + 1);
                    // use Bet.amount (from actual bet record) — event-level slot fields may be null
                    const value = meta?.amount ?? (eventItem as any)[def.keys[idx]] as number | null | undefined;
                    return {
                      label: `${def.prefix}${idx + 1}`,
                      value,
                      stakePaid: meta?.stakePaid ?? false,
                      isOwner: meta ? (meta.ownerUserId !== null && meta.bettorId === meta.ownerUserId) : null,
                    };
                  });
                }
                return result;
              }

              function chipCls(b: BetSlot) {
                if (!b.value || b.value <= 0) return "border-dashed border bg-muted/30 text-muted-foreground";
                if (b.isOwner === null) return "border bg-muted";
                if (b.isOwner) return b.stakePaid ? "border border-green-300 bg-green-100 text-green-800" : "border border-green-200 bg-green-50 text-green-700";
                return b.stakePaid ? "border border-pink-300 bg-pink-100 text-pink-800" : "border border-pink-200 bg-pink-50 text-pink-700";
              }

              function BetGroup({ title, bets }: { title: string; bets: BetSlot[] }) {
                return (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">{title}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {bets.map(b => (
                        <div key={b.label} className={`rounded px-2 py-1 text-xs flex flex-col gap-0 ${chipCls(b)}`}>
                          <span className="font-mono font-semibold">{b.label}</span>
                          {b.value && b.value > 0
                            ? <span>${b.value.toFixed(2)}</span>
                            : <span className="text-[10px]">free</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              const raceItems = eventItem.raceItems ?? [];
              // fallback: if no races yet, show event-level slots with no meta
              const raceTabs = raceItems.length > 0
                ? raceItems.map(ri => ({ id: ri.id, name: ri.race?.name || `Race ${ri.id}`, slots: makeBetsForRace(ri.bets) }))
                : [{ id: 0, name: "No races yet", slots: makeBetsForRace([]) }];

              return (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <h2 className="text-base font-semibold">{eventName}</h2>
                    {signIn && <span className="text-xs text-muted-foreground">Sign-in: {fmtDate(signIn)}</span>}
                  </div>

                  {/* Row A: Fees + Basket (2 col) */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <BirdFeesCard items={[eventItem]} />

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Basket</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm">
                        {baskets.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Not basketed</p>
                        ) : (
                          <div className="space-y-2">
                            {baskets.map(ba => {
                              const eb = ba.eventBasket as any;
                              return (
                                <div key={ba.id} className="border rounded p-2 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="font-mono shrink-0 text-xs">{eb?.label ?? `#${eb?.basketNo ?? "-"}`}</Badge>
                                    <Badge variant={eb?.phase === "LOFT" ? "secondary" : "default"} className="text-xs">{eb?.phase ?? "-"}</Badge>
                                    {eb?.race?.name && <span className="text-xs font-medium">{eb.race.name}</span>}
                                  </div>
                                  {eb?.capacity != null && (
                                    <p className="text-xs text-muted-foreground">Capacity: {eb.capacity}</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Row B: Bets full width */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">🎲 Bets</CardTitle>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-1">
                        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded border border-green-300 bg-green-100" /> Owner paid</span>
                        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded border border-green-200 bg-green-50" /> Owner unpaid</span>
                        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded border border-pink-300 bg-pink-100" /> Bettor paid</span>
                        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded border border-pink-200 bg-pink-50" /> Bettor unpaid</span>
                        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded border-dashed border bg-muted/30" /> Free</span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Tabs defaultValue={String(raceTabs[0].id)}>
                        <TabsList className="mb-3 h-auto flex-wrap gap-1">
                          {raceTabs.map(rt => (
                            <TabsTrigger key={rt.id} value={String(rt.id)} className="text-xs px-3 h-7 min-w-[100px]">
                              {rt.name}
                            </TabsTrigger>
                          ))}
                        </TabsList>
                        {raceTabs.map(rt => (
                          <TabsContent key={rt.id} value={String(rt.id)} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-0">
                            {BET_DEFS.map(def => (
                              <BetGroup key={def.category} title={def.title} bets={rt.slots[def.category]} />
                            ))}
                          </TabsContent>
                        ))}
                      </Tabs>
                    </CardContent>
                  </Card>
                </div>
              );
            })()}

          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
