"use client";

import type { Event } from "@/lib/types";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, X } from "lucide-react";
import { useListTeams, useCreateTeam } from "@/lib/api/teams";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { apiEndpoints } from "@/lib/endpoints";
import { useApiQuery } from "@/hooks/useApi";
import Link from "next/link";
import { BirdDialog } from "@/app/birds/bird-dialog";
import { PayPalButton } from "@/components/paypal-button";
import { calculateFees } from "@/lib/fee-calculator";
import { getSexLabel } from "@/lib/bird-constants";
import { useSettings } from "@/lib/settings-context";
import { Checkbox } from "@/components/ui/checkbox";
import { schemePools, poolKey, type BetCategory } from "@/lib/betting-pools";

interface EventRegisterTabProps {
  event: Event;
  eventId: string;
}

interface SelectedBird {
  id: number;
  band: string;
  birdName: string;
  color: string;
  sex: number;
}

export function EventRegisterTab({ event, eventId }: EventRegisterTabProps) {
  const { sexTerminology } = useSettings();
  const router = useRouter();
  const { data: session, isPending: isSessionPending } = authClient.useSession();

  const [selectedLoft, setSelectedLoft] = useState("");
  const [reservedBirds, setReservedBirds] = useState<number>(0);
  const [selectedBirds, setSelectedBirds] = useState<SelectedBird[]>([]);
  const [isAddTeamOpen, setIsAddTeamOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [isAddBirdOpen, setIsAddBirdOpen] = useState(false);
  // Owner bet selections: birdId → set of pool keys ("CATEGORY:tier")
  const [betsByBird, setBetsByBird] = useState<Record<number, string[]>>({});

  const { data: teamsData } = useListTeams({
    endpoint: apiEndpoints.breeder.teams,
    enabled: !!session?.user,
  });
  const teams = teamsData?.teams || [];

  const { data: birdsData, refetch: refetchBirds } = useApiQuery({
    endpoint: apiEndpoints.breeder.birds,
    queryKey: ["breeder", "birds"],
    enabled: !!session?.user,
  });
  const availableBirds: SelectedBird[] = (birdsData?.birds || []).filter(
    (b: any) => b.isActive === 1 && b.isLost === 0
  );

  const createTeamMutation = useCreateTeam({ endpoint: apiEndpoints.breeder.teams });

  const maxBirds = event.feeScheme?.maxBirdCount || 0;

  // Server-authoritative fee preview (same function used by register API)
  const fees = useMemo(() => {
    if (!event.feeScheme || reservedBirds <= 0) return null;
    const feeScheme = event.feeScheme;
    return calculateFees({
      numBirds: reservedBirds,
      feeScheme: {
        entryFee: feeScheme.entryFee ?? null,
        raceFeeMode: feeScheme.raceFeeMode,
        hotSpot1Fee: feeScheme.hotSpot1Fee ?? null,
        hotSpot2Fee: feeScheme.hotSpot2Fee ?? null,
        hotSpot3Fee: feeScheme.hotSpot3Fee ?? null,
        hotSpotFinalFee: feeScheme.hotSpotFinalFee ?? null,
        birdFeeItems: (feeScheme.birdFeeItems ?? []).map((b) => ({
          birdNo: b.birdNo,
          birdFee: b.birdFee ?? b.fee ?? null,
        })),
        raceTypeFees: (feeScheme.raceTypeFees ?? []).map((r) => ({
          raceTypeId: r.raceTypeId,
          fee: r.fee,
        })),
      },
      races: (event.races ?? []).map((r) => ({ raceTypeId: r.raceTypeId })),
    });
  }, [event.feeScheme, event.races, reservedBirds]);

  // Betting pools from the event's scheme; "all races, same pools" → a picked
  // pool charges once per REGISTERING race.
  const betPools = useMemo(
    () => schemePools(event.bettingScheme as unknown as Record<string, unknown> | undefined),
    [event.bettingScheme]
  );
  const registeringRaceCount = useMemo(
    () => (event.races ?? []).filter((r) => r.status === "REGISTERING").length,
    [event.races]
  );
  const poolAmount = useMemo(() => {
    const m = new Map<string, number>();
    betPools.forEach((p) => m.set(poolKey(p), p.amount));
    return m;
  }, [betPools]);

  const betStakesTotal = useMemo(() => {
    let total = 0;
    for (const keys of Object.values(betsByBird)) {
      for (const k of keys) total += (poolAmount.get(k) ?? 0) * registeringRaceCount;
    }
    return total;
  }, [betsByBird, poolAmount, registeringRaceCount]);

  // Payload for the register API: per selected bird, its chosen pools.
  const betsPayload = useMemo(() => {
    const selectedIds = new Set(selectedBirds.map((b) => b.id));
    return Object.entries(betsByBird)
      .filter(([birdId, keys]) => selectedIds.has(Number(birdId)) && keys.length > 0)
      .map(([birdId, keys]) => ({
        birdId: Number(birdId),
        pools: keys.map((k) => {
          const [category, tier] = k.split(":");
          return { category: category as BetCategory, tierIndex: Number(tier) };
        }),
      }));
  }, [betsByBird, selectedBirds]);

  const togglePool = (birdId: number, key: string) => {
    setBetsByBird((prev) => {
      const cur = prev[birdId] ?? [];
      const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
      return { ...prev, [birdId]: next };
    });
  };

  // Trim selected birds if reservedBirds decreases
  useEffect(() => {
    if (reservedBirds > 0 && selectedBirds.length > reservedBirds) {
      setSelectedBirds((prev) => prev.slice(0, reservedBirds));
    }
  }, [reservedBirds, selectedBirds.length]);

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) { toast.error("Team name is required"); return; }
    try {
      if (!createTeamMutation.mutateAsync) return;
      await createTeamMutation.mutateAsync({ name: teamName });
      toast.success("Team created successfully");
      setIsAddTeamOpen(false);
      setTeamName("");
      setSelectedLoft(teamName);
    } catch (error) {
      toast.error("Failed to create team");
    }
  };

  const addBird = (birdId: string) => {
    const bird = availableBirds.find((b) => String(b.id) === birdId);
    if (!bird) return;
    if (selectedBirds.length >= reservedBirds) {
      toast.error(`Maximum ${reservedBirds} birds for this registration`);
      return;
    }
    if (selectedBirds.some((b) => b.id === bird.id)) {
      toast.error("Bird already added");
      return;
    }
    setSelectedBirds((prev) => [...prev, bird]);
  };

  const removeBird = (birdId: number) => {
    setSelectedBirds((prev) => prev.filter((b) => b.id !== birdId));
    setBetsByBird((prev) => {
      const next = { ...prev };
      delete next[birdId];
      return next;
    });
  };

  const resetForm = () => {
    setSelectedLoft("");
    setReservedBirds(0);
    setSelectedBirds([]);
    setBetsByBird({});
  };

  const canSubmit =
    !!selectedLoft && reservedBirds > 0 && selectedBirds.length === reservedBirds;

  if (isSessionPending) {
    return (
      <Card>
        <CardHeader><CardTitle>Register for {event.name}</CardTitle></CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground">Loading...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!session?.user) {
    return (
      <Card>
        <CardHeader><CardTitle>Register for {event.name}</CardTitle></CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground mb-4">
              Please log in to register for this event
            </p>
            <Button onClick={() => router.push("/login")}>Login to Register</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const selectedBirdIds = new Set(selectedBirds.map((b) => b.id));
  const unselectedBirds = availableBirds.filter((b) => !selectedBirdIds.has(b.id));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Register for {event.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="space-y-6">
            {/* Breeder Information */}
            <div className="space-y-4">
              <h3 className="font-semibold">Breeder Information</h3>
              <div className="p-4 bg-transparent rounded-lg">
                <p className="text-sm text-muted-foreground">Registering as:</p>
                <p className="font-medium">
                  {session.user.name} ({session.user.email})
                </p>
              </div>
            </div>

            {/* Loft/Team Selection */}
            <div className="space-y-2">
              <Label htmlFor="loft">Select Loft/Team *</Label>
              <div className="flex gap-2">
                <Select value={selectedLoft} onValueChange={setSelectedLoft}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select loft/team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.length === 0 ? (
                      <div className="px-2 py-4 text-sm text-center text-muted-foreground">
                        No teams created
                      </div>
                    ) : (
                      teams.map((team: any) => (
                        <SelectItem key={team.id} value={team.name}>
                          {team.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" onClick={() => setIsAddTeamOpen(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Reserved Birds */}
            {selectedLoft && (
              <div className="space-y-2">
                <Label htmlFor="reservedBirds">
                  Reserved Birds *{maxBirds > 0 ? ` (Max: ${maxBirds})` : ""}
                </Label>
                <Input
                  id="reservedBirds"
                  type="number"
                  min={1}
                  max={maxBirds > 0 ? maxBirds : undefined}
                  value={reservedBirds || ""}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0;
                    if (maxBirds > 0 && value > maxBirds) {
                      toast.error(`Maximum birds allowed: ${maxBirds}`);
                      setReservedBirds(maxBirds);
                    } else {
                      setReservedBirds(value);
                    }
                  }}
                  required
                />
              </div>
            )}

            {/* Bird Selection */}
            {reservedBirds > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">
                    Select Birds{" "}
                    <span className="text-muted-foreground font-normal text-sm">
                      ({selectedBirds.length}/{reservedBirds} selected)
                    </span>
                  </h3>
                  {selectedBirds.length < reservedBirds && (
                    <div className="flex gap-2">
                      {unselectedBirds.length > 0 && (
                        <Select value="" onValueChange={addBird}>
                          <SelectTrigger className="w-56">
                            <SelectValue placeholder="Select existing bird" />
                          </SelectTrigger>
                          <SelectContent>
                            {unselectedBirds.map((bird) => (
                              <SelectItem key={bird.id} value={String(bird.id)}>
                                {bird.band} · {bird.birdName || "Unnamed"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsAddBirdOpen(true)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add New Bird
                      </Button>
                    </div>
                  )}
                </div>

                {/* Selected birds list */}
                {selectedBirds.map((bird) => (
                  <div key={bird.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm flex-1">
                        <div>
                          <p className="text-muted-foreground">Band</p>
                          <p className="font-medium">{bird.band}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Name</p>
                          <p className="font-medium">{bird.birdName || "—"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Color</p>
                          <p className="font-medium">{bird.color || "—"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Sex</p>
                          <p className="font-medium">{getSexLabel(bird.sex, sexTerminology)}</p>
                        </div>
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeBird(bird.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Owner bets — optional, applied to this bird in every race */}
                    {betPools.length > 0 && registeringRaceCount > 0 && (
                      <div className="border-t pt-3 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          Place bets (optional) — each applies across {registeringRaceCount || 0} race
                          {registeringRaceCount === 1 ? "" : "s"}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {betPools.map((p) => {
                            const key = poolKey(p);
                            const checked = (betsByBird[bird.id] ?? []).includes(key);
                            return (
                              <label
                                key={key}
                                className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs cursor-pointer ${
                                  checked ? "border-primary bg-primary/5" : ""
                                }`}
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => togglePool(bird.id, key)}
                                />
                                <span className="font-medium capitalize">
                                  {p.category.toLowerCase()} #{p.tierIndex}
                                </span>
                                <span className="text-muted-foreground">${p.amount}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Empty state */}
                {selectedBirds.length === 0 && (
                  <div className="border rounded-lg p-6 text-center text-sm text-muted-foreground">
                    {availableBirds.length === 0 ? (
                      <p>
                        No birds yet.{" "}
                        <Link href="/birds" className="text-primary underline">
                          Add birds first
                        </Link>
                      </p>
                    ) : (
                      <p>Use the dropdown above to add birds to this registration.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Fee Breakdown */}
            {(fees || betStakesTotal > 0) && (
              <div className="space-y-4">
                <h3 className="font-semibold">Payment Summary</h3>
                <div className="border rounded-lg p-4 space-y-2">
                  {fees && fees.purgeFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Entry Fee (one-time):</span>
                      <span className="font-medium">${fees.purgeFee.toFixed(2)}</span>
                    </div>
                  )}
                  {fees && fees.perchFees > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Per Bird Fees ({reservedBirds} bird{reservedBirds === 1 ? "" : "s"}):
                      </span>
                      <span className="font-medium">${fees.perchFees.toFixed(2)}</span>
                    </div>
                  )}
                  {fees && fees.raceFees > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Race Fees:</span>
                      <span className="font-medium">${fees.raceFees.toFixed(2)}</span>
                    </div>
                  )}
                  {fees && fees.hotspotFees > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Hotspot Fees:</span>
                      <span className="font-medium">${fees.hotspotFees.toFixed(2)}</span>
                    </div>
                  )}
                  {betStakesTotal > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Bet Stakes ({registeringRaceCount} race{registeringRaceCount === 1 ? "" : "s"}):
                      </span>
                      <span className="font-medium">${betStakesTotal.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold pt-2 border-t">
                    <span>Total:</span>
                    <span>${((fees?.total ?? 0) + betStakesTotal).toFixed(2)}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Final amount is verified server-side before payment.
                </p>
              </div>
            )}

            {/* Submit */}
            {reservedBirds > 0 && (
              <div className="flex justify-end">
                <PayPalButton
                  eventId={eventId}
                  loftName={selectedLoft}
                  reservedBirds={reservedBirds}
                  birdIds={selectedBirds.map((b) => b.id)}
                  bets={betsPayload}
                  disabled={!canSubmit}
                  onPaid={resetForm}
                />
              </div>
            )}
          </div>

          {/* Add Bird Dialog */}
          <BirdDialog
            open={isAddBirdOpen}
            onOpenChange={setIsAddBirdOpen}
            bird={null}
            onSuccess={(createdBird) => {
              refetchBirds();
              if (!createdBird) return;
              setSelectedBirds((prev) => {
                if (prev.some((b) => b.id === createdBird.id)) return prev;
                if (prev.length >= reservedBirds) {
                  toast.info(`${reservedBirds}-bird limit reached; bird created but not added`);
                  return prev;
                }
                return [
                  ...prev,
                  {
                    id: createdBird.id,
                    band: createdBird.band ?? "",
                    birdName: createdBird.birdName ?? "",
                    color: createdBird.color ?? "",
                    sex: createdBird.sex ?? 0,
                  },
                ];
              });
            }}
          />

          {/* Add Team Dialog */}
          <Dialog open={isAddTeamOpen} onOpenChange={setIsAddTeamOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Team</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddTeam} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="team-name">Team Name *</Label>
                  <Input
                    id="team-name"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Enter team name"
                    required
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsAddTeamOpen(false);
                      setTeamName("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createTeamMutation.isPending}>
                    {createTeamMutation.isPending ? "Creating..." : "Create Team"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
