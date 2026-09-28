"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Swords, Trophy } from "lucide-react";
import { toast } from "sonner";
import { useSeasonContext } from "@/lib/season-context";
import { useListRaces } from "@/lib/api/races";

type CutMode = "TOP_PERCENT" | "TOP_N" | "MANUAL";

interface Round {
  id: number;
  roundNumber: number;
  raceId: number | null;
  status: "PENDING" | "FLYING" | "CUT_APPLIED";
  survivorCount: number | null;
  race?: { name?: string | null; raceNumber?: number | null; status?: string | null } | null;
}

interface Tournament {
  id: number;
  name: string;
  cutMode: CutMode;
  cutValue: number;
  status: "SETUP" | "RUNNING" | "COMPLETE";
  rounds: Round[];
  entryCount: number;
  aliveCount: number;
}

const CUT_LABEL: Record<CutMode, string> = {
  TOP_PERCENT: "Top percent",
  TOP_N: "Top N birds",
  MANUAL: "Hand-picked",
};

function cutSummary(mode: CutMode, value: number): string {
  if (mode === "TOP_PERCENT") return `top ${value}% go through each round`;
  if (mode === "TOP_N") return `top ${Math.floor(value)} birds go through each round`;
  return "the operator picks who goes through";
}

function roundLabel(round: Round): string {
  if (round.race?.name) return round.race.name;
  if (round.race?.raceNumber != null) return `Race ${round.race.raceNumber}`;
  return "no race attached";
}

/**
 * Knockout tournaments — birds eliminated round by round on a position cutoff.
 *
 * Each round runs as an ordinary race, so check-in, scanning and results behave
 * exactly as they do elsewhere. Cutting a round is only possible once its race
 * has ended and nothing is still in the air.
 */
export function TournamentsTab({ eventId }: { eventId: string }) {
  const { selectedSeasonId } = useSeasonContext();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [working, setWorking] = useState<number | null>(null);

  const [name, setName] = useState("");
  const [cutMode, setCutMode] = useState<CutMode>("TOP_PERCENT");
  const [cutValue, setCutValue] = useState("50");
  const [raceIds, setRaceIds] = useState<string[]>([]);

  const { data: racesData } = useListRaces({
    params: selectedSeasonId ? { seasonId: String(selectedSeasonId) } : undefined,
  });
  const races = (racesData?.races ?? []) as Array<{
    id: number;
    name?: string | null;
    raceNumber?: number | null;
  }>;

  const load = useCallback(async () => {
    if (selectedSeasonId == null) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/event/${eventId}/tournaments?seasonId=${selectedSeasonId}`
      );
      if (!res.ok) {
        toast.error("Could not load tournaments");
        return;
      }
      const data = await res.json();
      setTournaments(data.tournaments ?? []);
    } finally {
      setLoading(false);
    }
  }, [eventId, selectedSeasonId]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!name.trim()) {
      toast.error("Give the tournament a name");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(
        `/api/admin/event/${eventId}/tournaments?seasonId=${selectedSeasonId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            cutMode,
            cutValue: Number(cutValue) || 0,
            raceIds: raceIds.map(Number).filter((n) => !Number.isNaN(n)),
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "Could not create the tournament");
        return;
      }
      toast.success(data.message);
      setName("");
      setRaceIds([]);
      load();
    } finally {
      setCreating(false);
    }
  };

  const advance = async (tournamentId: number) => {
    setWorking(tournamentId);
    try {
      const res = await fetch(`/api/admin/tournament/${tournamentId}/advance`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "Could not advance the round");
        return;
      }
      toast.success(data.message);
      load();
    } finally {
      setWorking(null);
    }
  };

  if (selectedSeasonId == null) {
    return <p className="text-sm text-muted-foreground">Choose a season first.</p>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New tournament
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="t-name">Name</Label>
              <Input
                id="t-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Knockout 2027"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cut mode</Label>
              <Select value={cutMode} onValueChange={(v) => setCutMode(v as CutMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CUT_LABEL) as CutMode[]).map((m) => (
                    <SelectItem key={m} value={m}>
                      {CUT_LABEL[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-value">
                {cutMode === "TOP_PERCENT" ? "Percent through" : "Birds through"}
              </Label>
              <Input
                id="t-value"
                type="number"
                value={cutValue}
                onChange={(e) => setCutValue(e.target.value)}
                disabled={cutMode === "MANUAL"}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Rounds</Label>
            <div className="flex flex-wrap gap-2">
              {races.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  This season has no races yet. The tournament will start with one empty round.
                </p>
              ) : (
                races.map((r) => {
                  const id = String(r.id);
                  const picked = raceIds.includes(id);
                  const order = raceIds.indexOf(id) + 1;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() =>
                        setRaceIds((prev) =>
                          prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                        )
                      }
                      className={`rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                        picked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                      }`}
                    >
                      {picked ? <span className="font-mono mr-1">{order}.</span> : null}
                      {r.name || `Race ${r.raceNumber ?? r.id}`}
                    </button>
                  );
                })
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Click races in the order they should be flown. Each becomes a round.
            </p>
          </div>

          <Button onClick={create} disabled={creating}>
            {creating ? "Creating…" : "Create tournament"}
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      ) : tournaments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Swords className="h-10 w-10 mb-3" />
            <p className="text-sm">No tournaments in this season yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {tournaments.map((t) => {
            const nextRound = t.rounds.find((r) => r.status !== "CUT_APPLIED");
            const canCut =
              t.status !== "COMPLETE" &&
              nextRound != null &&
              nextRound.raceId != null &&
              nextRound.race?.status === "ENDED";

            return (
              <Card key={t.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {t.status === "COMPLETE" ? (
                          <Trophy className="h-4 w-4 text-amber-500" />
                        ) : (
                          <Swords className="h-4 w-4" />
                        )}
                        {t.name}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        {cutSummary(t.cutMode, t.cutValue)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={t.status === "COMPLETE" ? "default" : "secondary"}>
                        {t.status.toLowerCase()}
                      </Badge>
                      <Badge variant="outline">
                        {t.aliveCount} of {t.entryCount} still in
                      </Badge>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    {t.rounds.map((round) => (
                      <div
                        key={round.id}
                        className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                      >
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">
                            R{round.roundNumber}
                          </span>
                          <span>{roundLabel(round)}</span>
                        </span>
                        <span className="flex items-center gap-2 text-xs">
                          {round.race?.status ? (
                            <span className="text-muted-foreground">
                              {round.race.status.toLowerCase()}
                            </span>
                          ) : null}
                          {round.status === "CUT_APPLIED" ? (
                            <Badge variant="secondary" className="text-[10px]">
                              {round.survivorCount} through
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              {round.status.toLowerCase()}
                            </Badge>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>

                  {t.status !== "COMPLETE" && (
                    <div className="flex items-center gap-3">
                      <Button
                        size="sm"
                        onClick={() => advance(t.id)}
                        disabled={!canCut || working === t.id}
                      >
                        {working === t.id
                          ? "Cutting…"
                          : `Apply round ${nextRound?.roundNumber ?? "?"} cut`}
                      </Button>
                      {!canCut && (
                        <p className="text-xs text-amber-600">
                          {nextRound == null
                            ? "Every round has been cut. Add another race as a round."
                            : nextRound.raceId == null
                              ? "Attach a race to this round first."
                              : "The round's race has to end before the cut can be applied."}
                        </p>
                      )}
                      {t.cutMode === "MANUAL" && canCut && (
                        <p className="text-xs text-muted-foreground">
                          Hand-picked cuts are applied through the API with the birds to keep.
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
