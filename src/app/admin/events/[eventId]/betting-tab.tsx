"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useListRaces } from "@/lib/api/races";
import { useListBreeders } from "@/lib/api/breeders";
import { useBettingPool, useCalcPayouts, useRaceBets, usePlaceCashBet, type RaceBetsResponse, type RaceBetPool, type RaceBetBird } from "@/lib/api/bets";
import type { Race } from "@/lib/types";

const CATEGORY_LABEL: Record<string, string> = { BELGIAN: "Belgian", STANDARD: "Standard", WTA: "WTA" };

type Selection = { raceItemId: number; category: string; tierIndex: number; amount: number };
type CartKey = string;
function cartKey(raceItemId: number, category: string, tierIndex: number): CartKey {
  return `${raceItemId}-${category}-${tierIndex}`;
}
function poolKey(p: { category: string; tierIndex: number }) {
  return `${p.category}-${p.tierIndex}`;
}

// ── Pool standings types ──────────────────────────────────────────────────────
type PoolEntry = {
  betId: number; bettorId: string; bettorName: string; bettorEmail: string;
  raceItemId: number; band: string | null; ownerUserId: string | null; ownerName: string | null;
  position: number | null; amountIn: number; status: string; payoutValue: number | null;
  stakePaymentId: number | null; stakePaid: boolean;
};

function betRowBg(bettorId: string, ownerUserId: string | null, stakePaid: boolean) {
  const isOwner = ownerUserId !== null && bettorId === ownerUserId;
  if (isOwner) return stakePaid ? "bg-green-100" : "bg-green-50";
  return stakePaid ? "bg-pink-100" : "bg-pink-50";
}
type Pool = { category: string; tierIndex: number; totalIn: number; totalPayout: number; entries: PoolEntry[] };
type PoolResponse = {
  raceId: number; bettingOpen: boolean; raceStatus: string;
  pools: Pool[];
  totals: { totalBets: number; totalIn: number; totalPayout: number };
};

function statusBadge(status: string) {
  switch (status) {
    case "WON": return <Badge className="bg-green-600">Won</Badge>;
    case "PAID": return <Badge className="bg-emerald-700">Paid</Badge>;
    case "REFUNDED": return <Badge variant="secondary">Refunded</Badge>;
    case "LOST": return <Badge variant="outline">Lost</Badge>;
    default: return <Badge variant="outline">Placed</Badge>;
  }
}

// ── Admin Place Bets (cash) section ──────────────────────────────────────────
// Flow: admin picks bets on ANY bird / open pool first → then selects which
// breeder pays cash → registers a PAID cash payment under that breeder.
function AdminPlaceBetsSection({ raceId }: { raceId: string }) {
  const qc = useQueryClient();
  const { data, isPending } = useRaceBets(raceId, !!raceId);
  const { data: breedersData } = useListBreeders();
  const placeCash = usePlaceCashBet(raceId);

  const resp = data as RaceBetsResponse | undefined;
  const pools: RaceBetPool[] = useMemo(() => resp?.pools ?? [], [resp]);
  const birds: RaceBetBird[] = useMemo(() => resp?.birds ?? [], [resp]);
  const raceStatus = resp?.raceStatus ?? "";
  const registering = raceStatus === "REGISTERING";

  // Any breeder with a linked user account can be the cash bettor.
  const breeders = useMemo(() => {
    const list = (breedersData?.breeders ?? []) as Array<{
      userId: string | null; firstName: string | null; lastName: string | null; email: string | null;
    }>;
    return list
      .filter((b) => !!b.userId)
      .map((b) => ({
        userId: b.userId as string,
        name: [b.firstName, b.lastName].filter(Boolean).join(" ") || b.email || (b.userId as string),
      }));
  }, [breedersData]);

  const [selectedBreeder, setSelectedBreeder] = useState<string>("");
  const [cart, setCart] = useState<Map<CartKey, Selection>>(new Map());

  const cartTotal = useMemo(() => Array.from(cart.values()).reduce((s, v) => s + v.amount, 0), [cart]);
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

  const handleCashRegister = () => {
    if (!selectedBreeder || cartSelections.length === 0) return;
    placeCash.mutate(
      { bettorUserId: selectedBreeder, selections: cartSelections.map((s) => ({ raceItemId: s.raceItemId, category: s.category as "BELGIAN" | "STANDARD" | "WTA", tierIndex: s.tierIndex })) },
      {
        onSuccess: (res: unknown) => {
          const r = res as { data?: { betsCreated?: number; totalPaid?: number } };
          setCart(new Map());
          setSelectedBreeder("");
          qc.invalidateQueries({ queryKey: ["bets", "race", String(raceId)] });
          qc.invalidateQueries({ queryKey: ["betting", "pool", String(raceId)] });
          toast.success(`Cash bets registered — ${r?.data?.betsCreated ?? 0} bet(s), $${r?.data?.totalPaid ?? 0}`);
        },
        onError: (e: unknown) => {
          let msg = "Failed to register bets";
          if (e instanceof Error) { try { msg = JSON.parse(e.message).message ?? msg; } catch { msg = e.message; } }
          toast.error(msg);
        },
      }
    );
  };

  if (!raceId) return null;
  if (isPending) return <Skeleton className="h-32 w-full" />;
  if (!registering) return (
    <p className="text-sm text-amber-600">
      Race is <b>{raceStatus}</b> — cash bets can only be placed while race is REGISTERING.
    </p>
  );
  if (birds.length === 0) return (
    <p className="text-sm text-muted-foreground">No birds in this race yet.</p>
  );

  return (
    <div className="space-y-4">
      {/* Bird × pool matrix — ALL birds (open pool). Select bets first. */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">Bird</th>
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
            {birds.map((bird) => (
              <tr key={bird.raceItemId} className="border-b hover:bg-muted/40">
                <td className="p-2 font-medium">{bird.band ?? "-"}</td>
                <td className="p-2 text-muted-foreground">{bird.ownerName ?? "-"}</td>
                {pools.map((pool) => {
                  const existing = bird.bets.find((b) => b.category === pool.category && b.tierIndex === pool.tierIndex);
                  const k = cartKey(bird.raceItemId, pool.category, pool.tierIndex);
                  const inCart = cart.has(k);
                  if (existing) {
                    const isOwner = bird.ownerUserId !== null && existing.bettorId === bird.ownerUserId;
                    const cellBg = isOwner
                      ? (existing.stakePaid ? "bg-green-100" : "bg-green-50")
                      : (existing.stakePaid ? "bg-pink-100" : "bg-pink-50");
                    return (
                      <td key={poolKey(pool)} className={`p-2 text-center ${cellBg}`}>
                        <Badge variant="secondary">Taken</Badge>
                      </td>
                    );
                  }
                  return (
                    <td key={poolKey(pool)} className="p-2 text-center">
                      <Button size="sm" variant={inCart ? "default" : "outline"}
                        className={inCart ? "bg-green-600 hover:bg-green-700" : ""}
                        disabled={placeCash.isPending}
                        onClick={() => toggleCart(bird, pool)}>
                        {inCart ? `✓ $${pool.amount}` : `$${pool.amount}`}
                      </Button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cart → pick payer → register */}
      {cart.size > 0 && (
        <>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <span className="font-semibold text-sm">{cart.size} bet(s)</span>
              <span className="text-xs text-muted-foreground ml-2">
                {cartSelections.map((s) => `${CATEGORY_LABEL[s.category]} #${s.tierIndex}`).join(", ")}
              </span>
            </div>
            <span className="font-bold">${cartTotal.toFixed(2)}</span>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-72">
              <label className="text-sm font-medium mb-1 block">Breeder paying cash</label>
              <Select value={selectedBreeder} onValueChange={setSelectedBreeder}>
                <SelectTrigger>
                  <SelectValue placeholder="Select breeder" />
                </SelectTrigger>
                <SelectContent>
                  {breeders.map((b) => (
                    <SelectItem key={b.userId} value={b.userId}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCashRegister} disabled={!selectedBreeder || placeCash.isPending}>
              {placeCash.isPending ? "Registering…" : `Register Cash Payment — $${cartTotal.toFixed(2)}`}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCart(new Map())}>Clear</Button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main admin betting tab ────────────────────────────────────────────────────
export function BettingTab({ eventId }: { event: unknown; eventId: string }) {
  const { data: racesData } = useListRaces({ params: { eventId } });
  const races: Race[] = useMemo(() => racesData?.races ?? [], [racesData]);
  const [raceId, setRaceId] = useState<string>("");

  const { data, isPending, error } = useBettingPool(raceId, !!raceId);
  const calc = useCalcPayouts(raceId);
  const pool = data as PoolResponse | undefined;
  const ended = pool?.raceStatus === "ENDED";

  const payoutSummary = useMemo(() => {
    if (!pool) return [] as { bettorName: string; bettorEmail: string; total: number }[];
    const map = new Map<string, { bettorName: string; bettorEmail: string; total: number }>();
    for (const p of pool.pools) {
      for (const e of p.entries) {
        if (e.payoutValue && e.payoutValue > 0) {
          const cur = map.get(e.bettorId) ?? { bettorName: e.bettorName, bettorEmail: e.bettorEmail, total: 0 };
          cur.total += e.payoutValue;
          map.set(e.bettorId, cur);
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [pool]);

  // Flat "who bet on which bird" list across all pools, sorted by bettor.
  const allBets = useMemo(() => {
    if (!pool) return [] as (PoolEntry & { poolLabel: string })[];
    const rows = pool.pools.flatMap((p) =>
      p.entries.map((e) => ({ ...e, poolLabel: `${CATEGORY_LABEL[p.category]} #${p.tierIndex}` }))
    );
    return rows.sort(
      (a, b) =>
        (a.bettorName || a.bettorEmail).localeCompare(b.bettorName || b.bettorEmail) ||
        (a.band ?? "").localeCompare(b.band ?? "")
    );
  }, [pool]);

  const onCalc = () => {
    calc.mutate(undefined, {
      onSuccess: (res: unknown) => {
        const summary = (res as { data?: { summary?: { winners: number; refunded: number; totalPayout: number } } })?.data?.summary;
        if (summary) {
          toast.success(`Payouts: ${summary.winners} winners, ${summary.refunded} refunded, $${summary.totalPayout} total`);
        } else {
          toast.success("Payouts calculated");
        }
      },
      onError: (e: unknown) => {
        let msg = "Failed to calculate payouts";
        if (e instanceof Error) { try { msg = JSON.parse(e.message).message ?? msg; } catch { msg = e.message; } }
        toast.error(msg);
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Race selector + calculate button */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-72">
          <label className="text-sm font-medium mb-1 block">Race</label>
          <Select value={raceId} onValueChange={setRaceId}>
            <SelectTrigger><SelectValue placeholder="Select a race" /></SelectTrigger>
            <SelectContent>
              {races.map((r) => (
                <SelectItem key={r.id} value={String(r.id)}>
                  {r.name || r.description || `Race ${r.id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {raceId && (
          <Button onClick={onCalc} disabled={!ended || calc.isPending}>
            {calc.isPending ? "Calculating…" : "Calculate Payouts"}
          </Button>
        )}
        {raceId && pool && !ended && (
          <span className="text-sm text-amber-600">
            Race must be ENDED to calculate payouts (current: {pool.raceStatus}).
          </span>
        )}
      </div>

      {!raceId && (
        <p className="text-sm text-muted-foreground">Select a race to manage betting.</p>
      )}

      {/* Place cash bets section */}
      {raceId && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Place Bets — Cash Payment</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminPlaceBetsSection raceId={raceId} />
          </CardContent>
        </Card>
      )}

      {/* Pool standings */}
      {raceId && isPending && <Skeleton className="h-40 w-full" />}
      {raceId && error && <p className="text-sm text-red-600">Failed to load pools.</p>}

      {raceId && pool && (
        <>
          <div className="flex flex-wrap gap-4 text-sm">
            <Badge variant="outline">{pool.raceStatus}</Badge>
            <span>Bets: <b>{pool.totals.totalBets}</b></span>
            <span>Total In: <b>${pool.totals.totalIn}</b></span>
            <span>Total Payout: <b>${pool.totals.totalPayout}</b></span>
          </div>

          {pool.pools.length === 0 && (
            <p className="text-sm text-muted-foreground">No bets placed on this race yet.</p>
          )}

          {/* Consolidated: which user bet on which bird */}
          {allBets.length > 0 && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-base">All Bets — who bet on which bird</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="p-2">Bettor</th>
                        <th className="p-2">Bird</th>
                        <th className="p-2">Owner</th>
                        <th className="p-2">Pool</th>
                        <th className="p-2 text-right">Stake</th>
                        <th className="p-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allBets.map((e) => (
                        <tr key={e.betId} className={`border-b ${betRowBg(e.bettorId, e.ownerUserId, e.stakePaid)}`}>
                          <td className="p-2">
                            <div className="font-medium">{e.bettorName || "-"}</div>
                            <div className="text-xs text-muted-foreground">{e.bettorEmail}</div>
                          </td>
                          <td className="p-2 font-medium">{e.band ?? "-"}</td>
                          <td className="p-2 text-muted-foreground">{e.ownerName ?? "-"}</td>
                          <td className="p-2">{e.poolLabel}</td>
                          <td className="p-2 text-right">${e.amountIn}</td>
                          <td className="p-2 text-center">{statusBadge(e.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {pool.pools.map((p) => (
            <Card key={`${p.category}-${p.tierIndex}`}>
              <CardHeader className="py-3">
                <CardTitle className="text-base flex items-center gap-3">
                  {CATEGORY_LABEL[p.category]} #{p.tierIndex}
                  <span className="text-xs font-normal text-muted-foreground">
                    In ${p.totalIn} · Payout ${p.totalPayout} · {p.entries.length} bets
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="p-2">Bettor</th>
                        <th className="p-2">Bird</th>
                        <th className="p-2">Owner</th>
                        <th className="p-2 text-center">Pos</th>
                        <th className="p-2 text-right">In</th>
                        <th className="p-2 text-center">Status</th>
                        <th className="p-2 text-right">Payout</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.entries.map((e) => (
                        <tr key={e.betId} className={`border-b ${betRowBg(e.bettorId, e.ownerUserId, e.stakePaid)}`}>
                          <td className="p-2">
                            <div className="font-medium">{e.bettorName || "-"}</div>
                            <div className="text-xs text-muted-foreground">{e.bettorEmail}</div>
                          </td>
                          <td className="p-2">{e.band ?? "-"}</td>
                          <td className="p-2 text-muted-foreground">{e.ownerName ?? "-"}</td>
                          <td className="p-2 text-center">{e.position ?? "-"}</td>
                          <td className="p-2 text-right">${e.amountIn}</td>
                          <td className="p-2 text-center">{statusBadge(e.status)}</td>
                          <td className="p-2 text-right font-semibold">{e.payoutValue ? `$${e.payoutValue}` : "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}

          {payoutSummary.length > 0 && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-base">Payouts Owed (manual disbursement)</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-2">Bettor</th>
                      <th className="p-2">Email</th>
                      <th className="p-2 text-right">Total Owed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payoutSummary.map((s) => (
                      <tr key={s.bettorEmail} className="border-b">
                        <td className="p-2 font-medium">{s.bettorName || "-"}</td>
                        <td className="p-2 text-muted-foreground">{s.bettorEmail}</td>
                        <td className="p-2 text-right font-semibold">${s.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
