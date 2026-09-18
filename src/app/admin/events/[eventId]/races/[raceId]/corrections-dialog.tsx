"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { apiEndpoints } from "@/lib/endpoints";
import type { RaceItem } from "@/lib/types";
import { Wrench } from "lucide-react";

interface Phantom {
  id: number;
  rfid: string | null;
  arrivalTime: string | null;
  birdId: number | null;
  bird?: {
    id: number;
    band1: string | null;
    band2: string | null;
    band3: string | null;
    band4: string | null;
  } | null;
}

interface IgnoredBird {
  id: number;
  inventoryItemId: number | null;
  note: string | null;
  inventoryItem?: {
    id: number;
    bird?: {
      id: number;
      band1: string | null;
      band2: string | null;
      band3: string | null;
      band4: string | null;
      birdName: string | null;
    } | null;
  } | null;
}

const bandOf = (b?: {
  band1: string | null;
  band2: string | null;
  band3: string | null;
  band4: string | null;
} | null) => (b ? [b.band1, b.band2, b.band3, b.band4].filter(Boolean).join("-") : "");

/**
 * Race-day corrections: unmatched scans and birds excluded from results.
 *
 * Both write to tables HayLoft used daily but this system had no interface
 * for. Neither takes effect on the leaderboard until the race is
 * recalculated, which the dialog says explicitly rather than silently
 * reordering a finished race.
 */
export function CorrectionsDialog({
  raceId,
  raceItems,
}: {
  raceId: string;
  raceItems: RaceItem[];
}) {
  const [open, setOpen] = useState(false);
  const [phantoms, setPhantoms] = useState<Phantom[]>([]);
  const [ignored, setIgnored] = useState<IgnoredBird[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [excludeSearch, setExcludeSearch] = useState("");
  const [excludeNote, setExcludeNote] = useState("");
  const queryClient = useQueryClient();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, i] = await Promise.all([
        fetch(apiEndpoints.races.phantoms(raceId)).then((r) => r.json()),
        fetch(apiEndpoints.races.ignoreBirds(raceId)).then((r) => r.json()),
      ]);
      setPhantoms(p.phantoms ?? []);
      setIgnored(i.ignored ?? []);
    } catch {
      toast.error("Could not load corrections");
    } finally {
      setLoading(false);
    }
  }, [raceId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const unresolvedPhantoms = phantoms.filter((p) => p.birdId == null);

  const ignoredItemIds = useMemo(
    () => new Set(ignored.map((i) => i.inventoryItemId)),
    [ignored]
  );

  // Birds entered in this race, for the match and exclude pickers.
  const candidates = useMemo(
    () =>
      raceItems
        .filter((ri) => ri.inventoryItemId != null && ri.bird != null)
        .map((ri) => ({
          inventoryItemId: ri.inventoryItemId as number,
          birdId: ri.bird!.id,
          label: [bandOf(ri.bird), ri.bird?.birdName].filter(Boolean).join(" · "),
        })),
    [raceItems]
  );

  const matchCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    const pool = q ? candidates.filter((c) => c.label.toLowerCase().includes(q)) : candidates;
    return pool.slice(0, 40);
  }, [candidates, search]);

  const excludeCandidates = useMemo(() => {
    const q = excludeSearch.trim().toLowerCase();
    const pool = candidates.filter((c) => !ignoredItemIds.has(c.inventoryItemId));
    return (q ? pool.filter((c) => c.label.toLowerCase().includes(q)) : pool).slice(0, 40);
  }, [candidates, excludeSearch, ignoredItemIds]);

  const [matchingPhantom, setMatchingPhantom] = useState<Phantom | null>(null);

  const afterChange = async (message: string) => {
    toast.success(message);
    await load();
    await queryClient.invalidateQueries({ queryKey: ["raceItems", "list", `raceId-${raceId}`] });
  };

  const matchPhantom = async (phantom: Phantom, birdId: number) => {
    setBusyId(phantom.id);
    try {
      const res = await fetch(apiEndpoints.races.phantom(raceId, phantom.id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birdId, linkRfid: true, recordArrival: true }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Could not match the scan");
      setMatchingPhantom(null);
      setSearch("");
      await afterChange(body.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not match the scan");
    } finally {
      setBusyId(null);
    }
  };

  const dismissPhantom = async (phantom: Phantom) => {
    setBusyId(phantom.id);
    try {
      const res = await fetch(apiEndpoints.races.phantom(raceId, phantom.id), {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Could not dismiss the scan");
      await afterChange("Scan dismissed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not dismiss the scan");
    } finally {
      setBusyId(null);
    }
  };

  const exclude = async (inventoryItemId: number) => {
    setBusyId(inventoryItemId);
    try {
      const res = await fetch(apiEndpoints.races.ignoreBirds(raceId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventoryItemId, note: excludeNote || undefined }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Could not exclude the bird");
      setExcludeNote("");
      setExcludeSearch("");
      await afterChange(body.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not exclude the bird");
    } finally {
      setBusyId(null);
    }
  };

  const reinclude = async (inventoryItemId: number) => {
    setBusyId(inventoryItemId);
    try {
      const res = await fetch(apiEndpoints.races.ignoreBird(raceId, inventoryItemId), {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Could not re-include the bird");
      await afterChange(body.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not re-include the bird");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Wrench className="mr-2 h-4 w-4" />
        Corrections
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Race corrections</DialogTitle>
            <DialogDescription>
              Match scans that did not belong to any bird, and exclude birds that should
              not be ranked. Changes take effect on the leaderboard once you recalculate
              the race.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="phantoms">
            <TabsList>
              <TabsTrigger value="phantoms">
                Unmatched scans
                {unresolvedPhantoms.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {unresolvedPhantoms.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="excluded">
                Excluded birds
                {ignored.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {ignored.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="phantoms" className="space-y-3">
              {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {!loading && phantoms.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Every scan in this race matched a bird.
                </p>
              )}

              {phantoms.length > 0 && (
                <div className="max-h-80 overflow-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        <th className="p-2 text-left font-medium">Tag</th>
                        <th className="p-2 text-left font-medium">Scanned</th>
                        <th className="p-2 text-left font-medium">Status</th>
                        <th className="p-2 text-right font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {phantoms.map((p) => (
                        <tr key={p.id} className="border-t">
                          <td className="p-2 font-mono text-xs">{p.rfid ?? "—"}</td>
                          <td className="p-2">
                            {p.arrivalTime ? new Date(p.arrivalTime).toLocaleString() : "—"}
                          </td>
                          <td className="p-2">
                            {p.birdId ? (
                              <Badge variant="outline">Matched {bandOf(p.bird)}</Badge>
                            ) : (
                              <Badge variant="secondary">Unmatched</Badge>
                            )}
                          </td>
                          <td className="p-2 text-right">
                            {p.birdId == null && (
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={busyId === p.id}
                                  onClick={() => {
                                    setMatchingPhantom(p);
                                    setSearch("");
                                  }}
                                >
                                  Match
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={busyId === p.id}
                                  onClick={() => dismissPhantom(p)}
                                >
                                  Dismiss
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {matchingPhantom && (
                <div className="space-y-2 rounded-md border p-3">
                  <p className="text-sm font-medium">
                    Match tag{" "}
                    <span className="font-mono">{matchingPhantom.rfid ?? matchingPhantom.id}</span>{" "}
                    to a bird in this race
                  </p>
                  <Input
                    autoFocus
                    placeholder="Search by band or name"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <div className="max-h-48 overflow-auto rounded-md border">
                    {matchCandidates.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground">No birds match.</p>
                    ) : (
                      matchCandidates.map((c) => (
                        <button
                          key={c.inventoryItemId}
                          type="button"
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                          onClick={() => matchPhantom(matchingPhantom, c.birdId)}
                        >
                          {c.label}
                        </button>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The tag is linked to the bird and the scan time is recorded as its
                    arrival. Positions do not shift until you recalculate.
                  </p>
                  <Button size="sm" variant="ghost" onClick={() => setMatchingPhantom(null)}>
                    Cancel
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="excluded" className="space-y-3">
              {ignored.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No birds are excluded from this race.
                </p>
              ) : (
                <div className="max-h-56 overflow-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        <th className="p-2 text-left font-medium">Bird</th>
                        <th className="p-2 text-left font-medium">Reason</th>
                        <th className="p-2 text-right font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ignored.map((i) => (
                        <tr key={i.id} className="border-t">
                          <td className="p-2 font-mono text-xs">
                            {bandOf(i.inventoryItem?.bird) || "—"}
                          </td>
                          <td className="p-2">{i.note ?? "—"}</td>
                          <td className="p-2 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busyId === i.inventoryItemId}
                              onClick={() =>
                                i.inventoryItemId != null && reinclude(i.inventoryItemId)
                              }
                            >
                              Re-include
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="space-y-2 rounded-md border p-3">
                <p className="text-sm font-medium">Exclude a bird from this race</p>
                <Input
                  placeholder="Search by band or name"
                  value={excludeSearch}
                  onChange={(e) => setExcludeSearch(e.target.value)}
                />
                <Input
                  placeholder="Reason (optional) — e.g. returned to loft without flying"
                  value={excludeNote}
                  onChange={(e) => setExcludeNote(e.target.value)}
                />
                <div className="max-h-48 overflow-auto rounded-md border">
                  {excludeCandidates.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">No birds match.</p>
                  ) : (
                    excludeCandidates.map((c) => (
                      <button
                        key={c.inventoryItemId}
                        type="button"
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                        disabled={busyId === c.inventoryItemId}
                        onClick={() => exclude(c.inventoryItemId)}
                      >
                        {c.label}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
