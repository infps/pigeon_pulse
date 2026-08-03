"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, ChevronLeft, ChevronRight,
  User, AlertTriangle, FileText, Clock, Settings, MapPin,
} from "lucide-react";
import Link from "next/link";

function fmtDate(v: string | null | undefined) {
  if (!v) return "-";
  try { return new Date(v).toLocaleDateString(); } catch { return "-"; }
}
function fmtMoney(v: number | null | undefined) {
  if (v == null) return "-";
  return `$${Number(v).toFixed(2)}`;
}
function fmtTime(v: string | null | undefined) {
  if (!v) return "-";
  try { return new Date(v).toLocaleString(); } catch { return "-"; }
}

function statusBadge(bird: Record<string, unknown>) {
  if (bird.isLost === 1) return <Badge variant="destructive">Lost</Badge>;
  if (bird.isActive === 1) return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>;
  return <Badge variant="secondary">Inactive</Badge>;
}

function sexLabel(sex: number | null | undefined) {
  if (sex === 1) return "Cock";
  if (sex === 2) return "Hen";
  return "Unknown";
}

function betChipClass(meta: Record<string, unknown> | undefined) {
  if (!meta) return "bg-muted border";
  const isOwner = meta.bettorId === meta.ownerUserId;
  if (isOwner) return meta.stakePaid ? "bg-green-100 border-green-300" : "bg-green-50 border-green-200";
  return meta.stakePaid ? "bg-pink-100 border-pink-300" : "bg-pink-50 border-pink-200";
}

function betPlacerLabel(meta: Record<string, unknown> | undefined) {
  if (!meta) return null;
  const isOwner = meta.bettorId === meta.ownerUserId;
  return (
    <span className={`text-xs ${isOwner ? "text-green-700" : "text-pink-700"}`}>
      {isOwner ? "Owner" : "Bettor"}
      {!meta.stakePaid && " (unpaid)"}
    </span>
  );
}

function AdminViewPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const idx = parseInt(searchParams.get("bird") ?? "0") || 0;
  const [birds, setBirds] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/test/demo").then(r => r.json()).then(d => { setBirds(d); setLoading(false); });
  }, []);

  const bird = birds[idx] as Record<string, unknown> | undefined;
  const go = (n: number) => router.push(`/test/admin?bird=${Math.max(0, Math.min(9, n))}`);

  if (loading) return <div className="p-8 text-muted-foreground">Loading demo data...</div>;
  if (!bird) return <div className="p-8 text-red-500">No bird found.</div>;

  const band = [bird.band1, bird.band2, bird.band3, bird.band4].filter(Boolean).join("-");
  const breeder = bird.breeder as Record<string, unknown>;
  const bUser = breeder?.user as Record<string, unknown>;
  const ownerName = [breeder?.firstName, breeder?.lastName].filter(Boolean).join(" ") || "Unknown";
  const inventoryItems = (bird.inventoryItems as Record<string, unknown>[]) ?? [];
  const vaccinations = (bird.vaccinations as Record<string, unknown>[]) ?? [];
  const loftGroup = bird.loftGroup as Record<string, unknown> | null;
  const currentLocation = bird.currentLocation as Record<string, unknown> | null;

  const allRaceItems = inventoryItems.flatMap((item) => {
    const event = (item.eventInventory as Record<string, unknown>)?.event as Record<string, unknown>;
    return ((item.raceItems as Record<string, unknown>[]) ?? []).map(ri => ({
      ri, eventName: String(event?.name ?? "-"),
    }));
  });

  const allBaskets = inventoryItems.flatMap((item) => {
    const event = (item.eventInventory as Record<string, unknown>)?.event as Record<string, unknown>;
    return ((item.basketAssignments as Record<string, unknown>[]) ?? []).map(ba => ({
      ba, eventName: String(event?.name ?? "-"),
    }));
  });

  const auditLog = [
    { action: "RFID_LINKED", detail: "RFID linked: RF001122334455", by: "Admin User", time: "2024-04-02T10:05:00Z" },
    { action: "BASKET_ASSIGNED", detail: "Assigned to LB-SMITH-1 (LOFT)", by: "Admin User", time: "2024-04-02T10:10:00Z" },
    { action: "STATUS_CHANGED", detail: "Status → LOFT_BASKETED", by: "Scanner", time: "2024-04-02T10:10:00Z" },
    { action: "RELEASED", detail: "Released in Race 1 - 200km", by: "Admin User", time: "2024-04-05T08:00:00Z" },
    { action: "ARRIVED", detail: "Arrived #3 — 2024-04-05 14:32", by: "Scanner", time: "2024-04-05T14:32:00Z" },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* nav */}
      <div className="flex items-center justify-between">
        <Link href="/test"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button></Link>
        <div className="flex items-center gap-2">
          <Badge className="bg-red-100 text-red-800">ADMIN VIEW</Badge>
          <Button variant="outline" size="sm" onClick={() => go(idx - 1)} disabled={idx === 0}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm text-muted-foreground">Bird {idx + 1} / 10</span>
          <Button variant="outline" size="sm" onClick={() => go(idx + 1)} disabled={idx === 9}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* ── Row 1: Identity + Properties + Location ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Identity — spans 1 col, taller */}
        <Card className="lg:row-span-2">
          <CardContent className="pt-6 space-y-4">
            <div className="aspect-square rounded-lg bg-muted flex items-center justify-center">
              <span className="text-5xl">🕊️</span>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Badge variant="outline" className="font-mono">{[bird.band1, bird.band2].filter(Boolean).join("-") || "-"}</Badge>
              <Badge variant="outline" className="font-mono">{[bird.band3, bird.band4].filter(Boolean).join("-") || "-"}</Badge>
            </div>

            <div>
              <h1 className="text-2xl font-bold">{String(bird.birdName || "Unnamed")}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-muted-foreground font-mono text-xs">{band || "No band"}</span>
                {!!bird.color && <Badge variant="outline" className="text-xs">{String(bird.color)}</Badge>}
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1">Edit</Button>
              <Button size="sm" variant="destructive" className="flex-1">Delete</Button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm">Pay attention</span>
              <div className={`w-10 h-5 rounded-full transition-colors ${bird.attention ? "bg-primary" : "bg-muted-foreground/30"} flex items-center`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${bird.attention ? "translate-x-5" : ""}`} />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Owner</span>
              <span className="ml-auto font-medium">{ownerName}</span>
            </div>

            {loftGroup && (
              <div className="flex items-center gap-2 pt-2 border-t text-sm">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: String(loftGroup.color) }} />
                <span className="text-muted-foreground">Group</span>
                <span className="ml-auto font-medium text-right">{String(loftGroup.name)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Properties */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Settings className="h-4 w-4" />Properties</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              {[
                ["Band", band || "-"],
                ["Code Masked", String(bird.codeMasked || "Not set")],
                ["Gender", sexLabel(bird.sex as number)],
                ["Color", String(bird.color || "-")],
                ["RFID", String(bird.rfid || "Not set")],
                ["Fancier", bUser?.loftName ? `${ownerName} - ${String(bUser.loftName)}` : ownerName],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground shrink-0">{label}</dt>
                  <dd className="text-right font-mono text-xs">{value}</dd>
                </div>
              ))}
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">Status</dt>
                <dd>{statusBadge(bird)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Current Location */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4" />Current Location</CardTitle>
          </CardHeader>
          <CardContent>
            {currentLocation ? (
              <div className="space-y-2 text-sm">
                <Badge variant={currentLocation.status === "ARRIVED" ? "default" : currentLocation.status === "LOST" ? "destructive" : "secondary"}>
                  {String(currentLocation.status)}
                </Badge>
                <p className="font-medium">{String(currentLocation.label)}</p>
                <p className="text-muted-foreground">
                  {String(currentLocation.eventName)}
                  {currentLocation.raceName ? ` · ${String(currentLocation.raceName)}` : ""}
                </p>
                {!!currentLocation.basketLabel && <p className="font-mono text-xs">{String(currentLocation.basketLabel)}</p>}
                {!!currentLocation.since && <p className="text-xs text-muted-foreground">Since {fmtDate(String(currentLocation.since))}</p>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active location</p>
            )}
          </CardContent>
        </Card>

        {/* Notes — fills second row, cols 2-3 */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" />Notes</CardTitle>
          </CardHeader>
          <CardContent>
            {bird.note
              ? <p className="text-sm">{String(bird.note)}</p>
              : <p className="text-sm text-muted-foreground">No notes.</p>}
            <Button variant="outline" size="sm" className="mt-3">Edit Note</Button>
          </CardContent>
        </Card>
      </div>

      {/* ── History: tabbed card ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">History</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="races">
            <TabsList className="mb-4">
              <TabsTrigger value="races">
                Races
                {allRaceItems.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-xs">{allRaceItems.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="grouping">
                Grouping
                {allBaskets.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-xs">{allBaskets.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="vaccinations">
                Vaccinations
                {vaccinations.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-xs">{vaccinations.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="audit">
                Audit Log
                <Badge variant="secondary" className="ml-1.5 text-xs">{auditLog.length}</Badge>
              </TabsTrigger>
            </TabsList>

            {/* Race Results */}
            <TabsContent value="races">
              {allRaceItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No race results.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b">
                      <th className="text-left pb-2">Event</th>
                      <th className="text-left pb-2">Race</th>
                      <th className="text-left pb-2">Status</th>
                      <th className="text-left pb-2">Pos</th>
                      <th className="text-left pb-2">Prize</th>
                      <th className="text-left pb-2">Arrival</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allRaceItems.map(({ ri, eventName }, i) => {
                      const result = ri.result as Record<string, unknown> | null;
                      const race = ri.race as Record<string, unknown>;
                      return (
                        <tr key={String(ri.id ?? i)} className="border-b last:border-0">
                          <td className="py-2 text-xs text-muted-foreground">{eventName}</td>
                          <td className="py-2">{String(race?.name ?? "-")}</td>
                          <td className="py-2"><Badge variant="outline" className="text-xs">{String(ri.status ?? "-")}</Badge></td>
                          <td className="py-2">{result?.birdPosition != null ? `#${String(result.birdPosition)}` : "-"}</td>
                          <td className="py-2">{fmtMoney(result?.prizeValue as number)}</td>
                          <td className="py-2 text-xs">{fmtTime(result?.arrivalTime as string)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </TabsContent>

            {/* Grouping */}
            <TabsContent value="grouping">
              {!loftGroup && allBaskets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No group or basket history.</p>
              ) : (
                <div className="space-y-4">
                  {loftGroup && (
                    <div className="border rounded-md p-3 text-sm space-y-2">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Current Group</div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: String(loftGroup.color) }} />
                        <span className="font-medium">{String(loftGroup.name)}</span>
                      </div>
                    </div>
                  )}
                  {allBaskets.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Basket Assignments</div>
                      {allBaskets.map(({ ba, eventName }, i) => {
                        const eb = ba.eventBasket as Record<string, unknown>;
                        const race = eb?.race as Record<string, unknown> | null;
                        return (
                          <div key={String(ba.id ?? i)} className="flex items-center gap-2 text-sm border rounded p-2">
                            <Badge variant="outline" className="font-mono shrink-0">{String(eb?.label ?? "-")}</Badge>
                            <Badge variant={String(eb?.phase) === "LOFT" ? "secondary" : "default"} className="shrink-0">
                              {String(eb?.phase ?? "-")}
                            </Badge>
                            <span className="text-muted-foreground text-xs truncate">
                              {eventName}{race?.name ? ` · ${String(race.name)}` : ""}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Vaccinations */}
            <TabsContent value="vaccinations">
              {vaccinations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No vaccination records.</p>
              ) : (
                <div className="space-y-3">
                  {vaccinations.map((vac) => (
                    <div key={String(vac.id)} className="border rounded-md p-3 text-sm space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{String(vac.vaccineName)}</span>
                        <span className="text-muted-foreground">{fmtDate(String(vac.vaccinationDate))}</span>
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        {!!vac.vet && <span>Vet: {String(vac.vet)}</span>}
                        {!!vac.batchNo && <span>Batch: {String(vac.batchNo)}</span>}
                      </div>
                      {!!vac.notes && <p className="text-xs text-muted-foreground">{String(vac.notes)}</p>}
                      <p className="text-xs text-muted-foreground/60">{String(vac.groupName)}</p>
                      {!!vac.documentUrl && (
                        <a href={String(vac.documentUrl)} className="text-xs text-primary underline" target="_blank" rel="noreferrer">View document</a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Audit Log */}
            <TabsContent value="audit">
              <div className="space-y-2 text-sm">
                {auditLog.map((entry, i) => (
                  <div key={i} className="flex items-start gap-3 border-b last:border-0 pb-2">
                    <Badge variant="outline" className="text-xs shrink-0"><Clock className="h-3 w-3 mr-1 inline" />{entry.action}</Badge>
                    <div className="flex-1">
                      <p>{entry.detail}</p>
                      <p className="text-xs text-muted-foreground">{entry.by} · {fmtTime(entry.time)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* ── Event Registrations ── */}
      {inventoryItems.map((item) => {
        const event = (item.eventInventory as Record<string, unknown>)?.event as Record<string, unknown>;
        const raceItems = (item.raceItems as Record<string, unknown>[]) ?? [];
        const baskets = (item.basketAssignments as Record<string, unknown>[]) ?? [];

        const betMetaMap = new Map<string, Record<string, unknown>>();
        for (const ri of raceItems) {
          for (const b of ((ri.bets as Record<string, unknown>[]) ?? [])) {
            betMetaMap.set(`${String(b.category)}-${String(b.tierIndex)}`, b);
          }
        }

        const mkBets = (category: string, tiers: number, prefix: string, feeKey: (i: number) => string) =>
          Array.from({ length: tiers }, (_, i) => i + 1).map(i => ({
            label: `${prefix}${i}`,
            value: Number(item[feeKey(i)] ?? 0),
            meta: betMetaMap.get(`${category}-${i}`),
          })).filter(b => b.value > 0);

        const belgianBets = mkBets("BELGIAN", 7, "B", i => `belgianShowBet${i}`);
        const standardBets = mkBets("STANDARD", 6, "S", i => `standardShowBet${i}`);
        const wtaBets = mkBets("WTA", 5, "W", i => `wtaBet${i}`);
        const hasBets = belgianBets.length > 0 || standardBets.length > 0 || wtaBets.length > 0;

        const eventName = String(event?.name ?? "Unknown Event");
        const eventKey = String(item.id);

        return (
          <div key={eventKey} className="space-y-3">
            {/* Event label row */}
            <div className="flex items-center gap-2 pt-2">
              <h2 className="text-base font-semibold">{eventName}</h2>
              <span className="text-xs text-muted-foreground">Sign-in: {fmtDate(String(event?.signInDate ?? ""))}</span>
              {item.isBackup === 1 && <Badge variant="secondary">Backup</Badge>}
              {item.isBetActive === 1 && <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Bets Active</Badge>}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* Fees */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><span>💰</span> Fees</CardTitle>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <span>Arrival: {fmtDate(item.arrivalDate as string)}</span>
                    <span>·</span>
                    <span>Departure: {fmtDate(item.departureDate as string)}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <dl className="space-y-2 text-sm">
                    {([
                      ["Perch Fee",  item.entryFeeValue],
                      ["Bird Fee",   item.perchFeeValue],
                      ["Race Fee",   item.raceFeeValue],
                      ["Hot Spot",   item.hotSpotFeeValue],
                    ] as [string, number | null][]).map(([label, value]) => (
                      <div key={label} className="flex justify-between">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-mono">{fmtMoney(value)}</span>
                      </div>
                    ))}
                    {((Number(item.entryRefund) + Number(item.hotSpotRefund) + Number(item.betsRefund)) > 0) && (
                      <>
                        <div className="border-t pt-2 mt-2 text-xs text-muted-foreground font-medium">Refunds</div>
                        {([
                          ["Entry Refund",  item.entryRefund],
                          ["HS Refund",     item.hotSpotRefund],
                          ["Bets Refund",   item.betsRefund],
                        ] as [string, number | null][]).filter(([, v]) => Number(v) > 0).map(([label, value]) => (
                          <div key={label} className="flex justify-between text-muted-foreground">
                            <span>{label}</span>
                            <span className="font-mono text-red-600">-{fmtMoney(value)}</span>
                          </div>
                        ))}
                      </>
                    )}
                    <div className="border-t pt-2 mt-1 flex justify-between font-semibold">
                      <span>Total</span>
                      <span className="font-mono">
                        {fmtMoney(
                          Number(item.entryFeeValue ?? 0) +
                          Number(item.perchFeeValue ?? 0) +
                          Number(item.raceFeeValue ?? 0) +
                          Number(item.hotSpotFeeValue ?? 0) -
                          Number(item.entryRefund ?? 0) -
                          Number(item.hotSpotRefund ?? 0) -
                          Number(item.betsRefund ?? 0)
                        )}
                      </span>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              {/* Bets */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><span>🎲</span> Bets</CardTitle>
                  {hasBets && (
                    <div className="flex gap-2 flex-wrap text-xs">
                      <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded bg-green-100 border border-green-300" /> Owner paid</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded bg-green-50 border border-green-200" /> Owner unpaid</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded bg-pink-100 border border-pink-300" /> Bettor paid</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded bg-pink-50 border border-pink-200" /> Bettor unpaid</span>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {hasBets ? (
                    <div className="space-y-3">
                      {[
                        { title: "Belgian Show", bets: belgianBets },
                        { title: "Standard Show", bets: standardBets },
                        { title: "WTA", bets: wtaBets },
                      ].filter(g => g.bets.length > 0).map(({ title, bets }) => (
                        <div key={title}>
                          <div className="text-xs text-muted-foreground mb-1.5">{title}</div>
                          <div className="flex flex-wrap gap-1.5">
                            {bets.map(b => (
                              <div
                                key={b.label}
                                className={`border rounded px-2 py-1 text-xs flex flex-col gap-0.5 ${betChipClass(b.meta as Record<string, unknown>)}`}
                              >
                                <div className="flex items-center gap-1">
                                  <span className="font-mono font-semibold">{b.label}</span>
                                  <span>{fmtMoney(b.value)}</span>
                                </div>
                                {betPlacerLabel(b.meta as Record<string, unknown>)}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No bets placed.</p>
                  )}
                </CardContent>
              </Card>

              {/* Basketing */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><span>🧺</span> Basketing</CardTitle>
                </CardHeader>
                <CardContent>
                  {baskets.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Not basketed.</p>
                  ) : (
                    <div className="space-y-2">
                      {baskets.map((ba) => {
                        const eb = ba.eventBasket as Record<string, unknown>;
                        const race = eb?.race as Record<string, unknown> | null;
                        const phase = String(eb?.phase ?? "-");
                        return (
                          <div key={String(ba.id)} className="flex items-start gap-2 text-sm border rounded p-2">
                            <Badge variant="outline" className="font-mono shrink-0 mt-0.5">{String(eb?.label ?? "-")}</Badge>
                            <div className="min-w-0">
                              <Badge variant={phase === "LOFT" ? "secondary" : "default"} className="text-xs">{phase}</Badge>
                              {!!race?.name && (
                                <p className="text-xs text-muted-foreground mt-0.5 truncate">{String(race.name)}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>
          </div>
        );
      })}

      {/* Lost warning */}
      {bird.isLost === 1 && (() => {
        // Find the race item that has lostRaceId match, or last raceItem across all inventory
        const lostRaceItem = inventoryItems.flatMap(item => {
          const event = (item.eventInventory as Record<string, unknown>)?.event as Record<string, unknown>;
          return ((item.raceItems as Record<string, unknown>[]) ?? []).map(ri => ({
            ri, eventName: String(event?.name ?? "-"),
          }));
        }).find(({ ri }) => {
          const race = ri.race as Record<string, unknown>;
          return String(race?.id) === String(bird.lostRaceId);
        });

        return (
          <Card className="border-destructive">
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-medium">Bird marked as lost</span>
                <span className="text-sm text-muted-foreground ml-auto">Lost: {fmtDate(String(bird.lostDate ?? ""))}</span>
              </div>

              {lostRaceItem && (() => {
                const { ri, eventName } = lostRaceItem;
                const race = ri.race as Record<string, unknown>;
                const lastStatus = String(ri.lastKnownStatus ?? ri.status ?? "-");
                const releasedAt = ri.releasedAt as string | null;
                const raceNote = ri.note as string | null;
                return (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2 text-sm">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Last Known Race</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{String(race?.name ?? "-")}</span>
                      <span className="text-muted-foreground text-xs">·</span>
                      <span className="text-muted-foreground text-xs">{eventName}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-muted-foreground">Last status:</span>
                      <Badge variant="outline" className="text-xs border-destructive/40 text-destructive">{lastStatus}</Badge>
                      {!!releasedAt && (
                        <span className="text-xs text-muted-foreground">Released {fmtTime(releasedAt)}</span>
                      )}
                    </div>
                    {!!raceNote && (
                      <p className="text-xs text-muted-foreground italic">{raceNote}</p>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}

export default function AdminViewPage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">Loading...</div>}>
      <AdminViewPageInner />
    </Suspense>
  );
}
