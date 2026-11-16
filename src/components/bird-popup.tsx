"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ExternalLink, Feather, Pencil } from "lucide-react";
import { useBird } from "@/lib/api/bird";
import { BirdEditDialog } from "@/app/admin/birds/[birdId]/bird-edit-dialog";
import type { Bird } from "@/lib/types";

// ---------------------------------------------------------------- types (GET /api/birds/:id/card)

type Money = number;
interface CardBasket { assignmentId: number; basketId: number; label: string; phase: string; race: string | null; assignedAt: string }
interface BirdCard {
  access: "admin" | "owner" | "public";
  bird: {
    id: number; band: string; name: string | null; color: string | null; sex: number | null; rfid: string | null;
    image: string | null; active: boolean; lost: boolean; lostDate: string | null; lostRace: string | null;
    health: string | null; healthNote: string | null; note: string | null; attention: boolean;
    father: { id: number; band: string; name: string | null } | null;
    mother: { id: number; band: string; name: string | null } | null;
    owner: { breederId: number; name: string } | null;
  };
  entry: null | {
    inventoryItemId: number; eventInventoryId: number | null; event: string | null; eventId: number | null;
    season: string | null; seasonId: number | null;
    registrationOwner: { breederId: number; name: string } | null; partners: string[]; loft: string | null;
    approval: string | null; signInDate: string | null; perch: number | null; backup: boolean; replaced: boolean;
    arrivalDate: string | null; departureDate: string | null;
    loftGroup: { id: number; name: string; color: string | null } | null;
    tagColor: { id: number; name: string; color: string | null } | null;
    baskets: CardBasket[];
    ownerHistory: Array<{ fromBreederName: string; transferredAt: string }>;
    fees: null | {
      perch: Money; entry: Money; entryPaid: boolean; hotSpot: Money; race: Money; bets: Money; betsActive: boolean;
      transferDue: Money; entryRefund: Money; hotSpotRefund: Money; betsRefund: Money;
    };
    prizes: null | { capital: Money; hotSpot1: Money; hotSpot2: Money; avgSpeed: Money; bets: Money };
    account: null | { charges: Money; payments: Money; won: Money; balance: Money };
  };
  otherEntries: Array<{ inventoryItemId: number; event: string | null; season: string | null; seasonId: number | null }>;
  races: Array<{
    raceItemId: number; raceId: number | null; race: string; raceType: string | null; event: string | null;
    date: string | null; distance: number | null; status: string; lost: boolean; arrival: string | null;
    position: number | null; hotSpotPosition: number | null; drop: number | null; yardsPerMin: number | null; prize: number | null;
  }>;
  lostHistory: Array<{ lost: boolean; date: string | null; race: string | null }>;
}
interface MoveOptions {
  perchCount: number;
  groups: Array<{ id: number; name: string; color: string | null; capacity: number | null }>;
  baskets: Array<{ id: number; label: string; phase: string; race: string | null; capacity: number; used: number }>;
  registrations: Array<{ id: number; name: string; loft: string | null }>;
}

// ---------------------------------------------------------------- open it from anywhere

interface OpenArgs { seasonId?: number | null; eventId?: number | null }
const Ctx = createContext<{ openBird: (birdId: number, args?: OpenArgs) => void } | null>(null);

/**
 * Mount once near the root. Any bird list then opens the popup with
 * `useBirdPopup().openBird(birdId, { seasonId })`, or by wrapping the band in <BirdLink>.
 */
export function BirdPopupProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ birdId: number; args: OpenArgs } | null>(null);
  const openBird = useCallback((birdId: number, args: OpenArgs = {}) => setState({ birdId, args }), []);
  const value = useMemo(() => ({ openBird }), [openBird]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <BirdPopup
        open={state != null}
        onOpenChange={(o) => !o && setState(null)}
        birdId={state?.birdId ?? null}
        seasonId={state?.args.seasonId ?? null}
        eventId={state?.args.eventId ?? null}
        onOpenBird={(id) => setState((s) => ({ birdId: id, args: s?.args ?? {} }))}
      />
    </Ctx.Provider>
  );
}

export function useBirdPopup() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBirdPopup needs <BirdPopupProvider>");
  return ctx;
}

/**
 * A bird's band (or any label) that opens the bird popup when clicked. Give the
 * bird's id when the list has it; otherwise its full band, which is looked up
 * (GET /api/birds/lookup), preferring the bird entered in this season / event.
 */
export function BirdLink({
  birdId, band, seasonId, eventId, children, className,
}: {
  birdId?: number | null;
  band?: string | null;
  seasonId?: number | null;
  eventId?: number | null;
  children: ReactNode;
  className?: string;
}) {
  const ctx = useContext(Ctx);
  if (!ctx || (birdId == null && !band)) return <>{children}</>;
  const open = async () => {
    if (birdId != null) return ctx.openBird(birdId, { seasonId, eventId });
    const qs = new URLSearchParams({ band: band! });
    if (seasonId != null) qs.set("seasonId", String(seasonId));
    if (eventId != null) qs.set("eventId", String(eventId));
    const res = await fetch(`/api/birds/lookup?${qs}`, { credentials: "include" });
    if (!res.ok) {
      toast.error("Bird not found");
      return;
    }
    const { birdId: id } = await res.json();
    ctx.openBird(id, { seasonId, eventId });
  };
  return (
    <button
      type="button"
      className={`text-left underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm ${className ?? ""}`}
      onClick={(e) => {
        e.stopPropagation();
        void open();
      }}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- the popup

const money = (n: number | null | undefined) =>
  n == null ? "—" : `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString() : "—");
const SEX = ["Cock", "Hen", "Unknown"];

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm border-b last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

export function BirdPopup({
  open, onOpenChange, birdId, seasonId, eventId, onOpenBird,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  birdId: number | null;
  seasonId?: number | null;
  eventId?: number | null;
  onOpenBird?: (birdId: number) => void;
}) {
  const [chosenSeason, setChosenSeason] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const qc = useQueryClient();
  const season = chosenSeason ?? seasonId ?? null;
  const qs = new URLSearchParams();
  if (season != null) qs.set("seasonId", String(season));
  else if (eventId != null) qs.set("eventId", String(eventId));
  const { data: card, isPending, isError, refetch } = useQuery<BirdCard>({
    queryKey: ["bird-card", birdId, season, eventId],
    enabled: open && birdId != null,
    queryFn: async () => {
      const res = await fetch(`/api/birds/${birdId}/card?${qs}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load bird");
      return res.json();
    },
  });

  const b = card?.bird;
  const e = card?.entry;
  const full = card && card.access !== "public";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) { setChosenSeason(null); setEditing(false); }
        onOpenChange(o);
      }}
    >
      {/* The content scrolls inside, so the close X (top right) never scrolls away. */}
      <DialogContent className="max-w-5xl p-0 overflow-hidden">
        <DialogHeader className="border-b px-5 pt-5 pb-3 pr-12">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {isPending ? <Skeleton className="h-6 w-48" /> : (
              <>
                <span className="font-mono">{b?.band || "Bird"}</span>
                {b?.name && <span className="text-muted-foreground font-normal">{b.name}</span>}
                {b?.lost && <Badge variant="destructive">Lost</Badge>}
                {b && !b.active && <Badge variant="secondary">Inactive</Badge>}
                {e?.backup && <Badge variant="outline">Backup</Badge>}
                {e?.replaced && <Badge variant="outline">Replaced</Badge>}
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {e ? `${e.event ?? "Event"}${e.season && e.season !== e.event ? ` · ${e.season}` : ""}` : "Not entered in an event"}
            {card && card.otherEntries.length > 0 && (
              <span className="ml-2 inline-flex items-center gap-1">
                ·
                <Select
                  value={e?.seasonId != null ? String(e.seasonId) : undefined}
                  onValueChange={(v) => setChosenSeason(Number(v))}
                >
                  <SelectTrigger className="h-6 w-auto gap-1 border-0 px-1 text-xs underline">
                    <SelectValue placeholder="Other events" />
                  </SelectTrigger>
                  <SelectContent>
                    {e?.seasonId != null && <SelectItem value={String(e.seasonId)}>{e.event} · {e.season}</SelectItem>}
                    {card.otherEntries.filter((o) => o.seasonId != null).map((o) => (
                      <SelectItem key={o.inventoryItemId} value={String(o.seasonId)}>{o.event} · {o.season}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[78vh] overflow-y-auto px-5 pb-5">
          {isPending && <div className="space-y-3 pt-4"><Skeleton className="h-40 w-full" /><Skeleton className="h-64 w-full" /></div>}
          {isError && <p className="py-10 text-center text-red-600">Could not load this bird.</p>}
          {card && b && (
            <Tabs defaultValue="details" className="pt-3">
              <TabsList className="h-auto flex-wrap">
                <TabsTrigger value="details">Details</TabsTrigger>
                {full && <TabsTrigger value="fees">Fees & account</TabsTrigger>}
                <TabsTrigger value="races">Race history ({card.races.length})</TabsTrigger>
                <TabsTrigger value="history">Owners & history</TabsTrigger>
                {card.access === "admin" && e && <TabsTrigger value="move">Move</TabsTrigger>}
              </TabsList>

              <TabsContent value="details" className="mt-3">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-3">
                    <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border bg-muted">
                      {b.image
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={b.image} alt={b.band} className="h-full w-full object-cover" />
                        : <Feather className="h-12 w-12 text-muted-foreground" />}
                    </div>
                    {card.access === "admin" && (
                      <>
                        <Button variant="outline" size="sm" className="w-full" onClick={() => setEditing(true)}>
                          <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit bird
                        </Button>
                        <Button variant="ghost" size="sm" className="w-full" asChild>
                          <a href={`/admin/birds/${b.id}`}>
                            <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open bird page (image)
                          </a>
                        </Button>
                      </>
                    )}
                    {card.access === "owner" && (
                      <Button variant="outline" size="sm" className="w-full" asChild>
                        <a href={`/birds/${b.id}`}>
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open bird page to edit
                        </a>
                      </Button>
                    )}
                  </div>
                  <Section title="Bird">
                    <Row label="Band">{b.band || "—"}</Row>
                    <Row label="Name">{b.name || "—"}</Row>
                    <Row label="Gender">{b.sex != null ? SEX[b.sex] ?? "—" : "—"}</Row>
                    <Row label="Color">{b.color || "—"}</Row>
                    <Row label="RFID">{b.rfid || "—"}</Row>
                    <Row label="Status">{b.lost ? `Lost${b.lostRace ? ` · ${b.lostRace}` : ""}${b.lostDate ? ` · ${date(b.lostDate)}` : ""}` : b.active ? "Active" : "Inactive"}</Row>
                    <Row label="Health">{b.health ?? "—"}{b.healthNote ? ` · ${b.healthNote}` : ""}</Row>
                    <Row label="Owner">{b.owner?.name || "—"}</Row>
                    <Row label="Father">
                      {b.father ? <button className="hover:underline" onClick={() => onOpenBird?.(b.father!.id)}>{b.father.band}{b.father.name ? ` (${b.father.name})` : ""}</button> : "—"}
                    </Row>
                    <Row label="Mother">
                      {b.mother ? <button className="hover:underline" onClick={() => onOpenBird?.(b.mother!.id)}>{b.mother.band}{b.mother.name ? ` (${b.mother.name})` : ""}</button> : "—"}
                    </Row>
                  </Section>
                  <Section title="In this event">
                    {e ? (
                      <>
                        <Row label="Registration">{e.registrationOwner?.name || "—"}{e.loft ? ` · ${e.loft}` : ""}</Row>
                        {e.partners.length > 0 && <Row label="Partners">{e.partners.join(", ")}</Row>}
                        <Row label="Perch">{e.perch ?? "—"}{e.backup ? " (backup)" : ""}</Row>
                        <Row label="Loft group">{e.loftGroup?.name ?? "—"}</Row>
                        <Row label="Tag color">{e.tagColor?.name ?? "—"}</Row>
                        <Row label="Signed in">{date(e.signInDate)}</Row>
                        <Row label="Arrival">{date(e.arrivalDate)}</Row>
                        <Row label="Departure">{date(e.departureDate)}</Row>
                        <Row label="Baskets">
                          {e.baskets.length === 0 ? "—" : (
                            <span className="flex flex-col items-end gap-0.5">
                              {e.baskets.map((x) => (
                                <span key={x.assignmentId}>{x.label} · {x.phase.toLowerCase()}{x.race ? ` · ${x.race}` : ""}</span>
                              ))}
                            </span>
                          )}
                        </Row>
                      </>
                    ) : <p className="text-sm text-muted-foreground">Not entered in an event.</p>}
                  </Section>
                </div>
                {full && b.note && (
                  <div className="mt-4"><Section title="Notes"><p className="whitespace-pre-wrap text-sm">{b.note}</p></Section></div>
                )}
              </TabsContent>

              {full && (
                <TabsContent value="fees" className="mt-3">
                  {!e?.fees ? <p className="text-sm text-muted-foreground">No event entry.</p> : (
                    <div className="grid gap-4 md:grid-cols-3">
                      <Section title="This bird's fees">
                        <Row label="Perch fee">{money(e.fees.perch)}</Row>
                        <Row label="Entry fee">{money(e.fees.entry)} {e.fees.entry > 0 && <Badge variant={e.fees.entryPaid ? "default" : "outline"} className="ml-1 text-[10px]">{e.fees.entryPaid ? "paid" : "unpaid"}</Badge>}</Row>
                        <Row label="Hot spot fee">{money(e.fees.hotSpot)}</Row>
                        <Row label="Race fee">{money(e.fees.race)}</Row>
                        <Row label="Class bets">{money(e.fees.bets)}{!e.fees.betsActive && " (off)"}</Row>
                        <Row label="Transfer due">{money(e.fees.transferDue)}</Row>
                        <Row label="Entry refund">{money(-e.fees.entryRefund)}</Row>
                        <Row label="Hot spot refund">{money(-e.fees.hotSpotRefund)}</Row>
                        <Row label="Bets refund">{money(-e.fees.betsRefund)}</Row>
                      </Section>
                      <Section title="This bird won">
                        <Row label="Final race">{money(e.prizes?.capital ?? 0)}</Row>
                        <Row label="Hot Spot 1">{money(e.prizes?.hotSpot1 ?? 0)}</Row>
                        <Row label="Hot Spot 2">{money(e.prizes?.hotSpot2 ?? 0)}</Row>
                        <Row label="Average speed">{money(e.prizes?.avgSpeed ?? 0)}</Row>
                        <Row label="Class bets">{money(e.prizes?.bets ?? 0)}</Row>
                      </Section>
                      <Section title={`Registration account${e.registrationOwner ? ` · ${e.registrationOwner.name}` : ""}`}>
                        {e.account ? (
                          <>
                            <Row label="Charged">{money(e.account.charges)}</Row>
                            <Row label="Paid">{money(e.account.payments)}</Row>
                            <Row label="Won">{money(e.account.won)}</Row>
                            <Row label={e.account.balance < 0 ? "Owed to breeder" : "Balance due"}>
                              <span className={e.account.balance > 0 ? "text-red-600" : e.account.balance < 0 ? "text-emerald-600" : ""}>{money(Math.abs(e.account.balance))}</span>
                            </Row>
                            <p className="pt-1 text-xs text-muted-foreground">As HayLoft computes it: charged − won − paid.</p>
                          </>
                        ) : <p className="text-sm text-muted-foreground">—</p>}
                      </Section>
                    </div>
                  )}
                </TabsContent>
              )}

              <TabsContent value="races" className="mt-3">
                {card.races.length === 0 ? <p className="text-sm text-muted-foreground">No races yet.</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-xs text-muted-foreground">
                          <th className="py-1.5 pr-3 text-left">Date</th>
                          <th className="py-1.5 pr-3 text-left">Race</th>
                          <th className="py-1.5 pr-3 text-left">Event</th>
                          <th className="py-1.5 pr-3 text-right">Miles</th>
                          <th className="py-1.5 pr-3 text-left">Result</th>
                          <th className="py-1.5 pr-3 text-right">Pos</th>
                          <th className="py-1.5 pr-3 text-left">Arrival</th>
                          <th className="py-1.5 pr-3 text-right">Yd/min</th>
                          {full && <th className="py-1.5 pr-3 text-right">Prize</th>}
                        </tr>
                      </thead>
                      <tbody className="tabular-nums">
                        {card.races.map((r) => (
                          <tr key={r.raceItemId} className="border-b last:border-0">
                            <td className="py-1 pr-3">{date(r.date)}</td>
                            <td className="py-1 pr-3">{r.race}{r.raceType ? <span className="text-muted-foreground"> · {r.raceType}</span> : null}</td>
                            <td className="py-1 pr-3 text-muted-foreground">{r.event ?? "—"}</td>
                            <td className="py-1 pr-3 text-right">{r.distance ?? "—"}</td>
                            <td className="py-1 pr-3">{r.lost ? "Lost" : r.status.replace(/_/g, " ").toLowerCase()}</td>
                            <td className="py-1 pr-3 text-right">{r.position ?? "—"}{r.hotSpotPosition ? <span className="text-muted-foreground"> / HS {r.hotSpotPosition}</span> : null}</td>
                            <td className="py-1 pr-3">{r.arrival ? new Date(r.arrival).toLocaleTimeString() : "—"}</td>
                            <td className="py-1 pr-3 text-right">{r.yardsPerMin?.toFixed(2) ?? "—"}</td>
                            {full && <td className="py-1 pr-3 text-right">{r.prize ? money(r.prize) : ""}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="history" className="mt-3">
                <div className="grid gap-4 md:grid-cols-2">
                  <Section title="Owners">
                    <Row label="Now">{e?.registrationOwner?.name ?? b.owner?.name ?? "—"}</Row>
                    {(e?.ownerHistory ?? []).map((h, i) => (
                      <Row key={i} label={`Until ${date(h.transferredAt)}`}>{h.fromBreederName}</Row>
                    ))}
                    {(e?.ownerHistory ?? []).length === 0 && <p className="pt-1 text-xs text-muted-foreground">No earlier owners recorded.</p>}
                  </Section>
                  <Section title="Lost / found">
                    {card.lostHistory.length === 0 ? <p className="text-sm text-muted-foreground">Never lost.</p> : card.lostHistory.map((l, i) => (
                      <Row key={i} label={date(l.date)}>{l.lost ? "Lost" : "Found"}{l.race ? ` · ${l.race}` : ""}</Row>
                    ))}
                  </Section>
                </div>
              </TabsContent>

              {card.access === "admin" && e && (
                <TabsContent value="move" className="mt-3">
                  <MovePanel inventoryItemId={e.inventoryItemId} entry={e} onMoved={() => refetch()} />
                </TabsContent>
              )}
            </Tabs>
          )}
        </div>
      </DialogContent>
      {editing && birdId != null && (
        <PopupBirdEditor
          birdId={birdId}
          onClose={() => setEditing(false)}
          onSaved={() => { refetch(); qc.invalidateQueries(); }}
        />
      )}
    </Dialog>
  );
}

/** Admin: load the full bird, then reuse the bird page's edit dialog. */
function PopupBirdEditor({ birdId, onClose, onSaved }: { birdId: number; onClose: () => void; onSaved: () => void }) {
  const { data } = useBird(birdId, "ADMIN");
  const bird = (data as { bird?: Bird } | undefined)?.bird;
  if (!bird) return null;
  return <BirdEditDialog key={bird.id} bird={bird} open onOpenChange={(o) => !o && onClose()} onSaved={onSaved} />;
}

// ---------------------------------------------------------------- admin: move

function MovePanel({ inventoryItemId, entry, onMoved }: { inventoryItemId: number; entry: NonNullable<BirdCard["entry"]>; onMoved: () => void }) {
  const qc = useQueryClient();
  const { data: opts, refetch } = useQuery<MoveOptions>({
    queryKey: ["bird-move-options", inventoryItemId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/event-inventory-item/${inventoryItemId}/move`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load move options");
      return res.json();
    },
  });
  const [perch, setPerch] = useState<string>("");
  const [group, setGroup] = useState<string>("");
  const [basket, setBasket] = useState<string>("");
  const [owner, setOwner] = useState<string>("");
  const [confirmOwner, setConfirmOwner] = useState(false);
  const [busy, setBusy] = useState(false);

  const move = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/event-inventory-item/${inventoryItemId}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "Move failed");
        return;
      }
      toast.success(data.message);
      setPerch(""); setGroup(""); setBasket(""); setOwner(""); setConfirmOwner(false);
      onMoved();
      refetch();
      // Lists showing this bird refresh too.
      qc.invalidateQueries();
    } finally {
      setBusy(false);
    }
  };

  if (!opts) return <Skeleton className="h-48 w-full" />;
  const target = opts.registrations.find((r) => String(r.id) === owner);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Section title={`Perch · now ${entry.perch ?? "none"}`}>
        <div className="flex gap-2 pt-1">
          <Select value={perch} onValueChange={setPerch}>
            <SelectTrigger className="h-8"><SelectValue placeholder="Move to perch…" /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: Math.max(opts.perchCount, 1) }, (_, i) => i + 1).map((n) => (
                <SelectItem key={n} value={String(n)} disabled={n === entry.perch}>Perch {n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" disabled={!perch || busy} onClick={() => move({ kind: "perch", perch: Number(perch) })}>Move</Button>
        </div>
        <p className="pt-1 text-xs text-muted-foreground">The other birds shift; perch fees are recalculated as in HayLoft.</p>
      </Section>

      <Section title={`Loft group · now ${entry.loftGroup?.name ?? "none"}`}>
        <div className="flex gap-2 pt-1">
          <Select value={group} onValueChange={setGroup}>
            <SelectTrigger className="h-8"><SelectValue placeholder={opts.groups.length ? "Move to group…" : "No loft groups"} /></SelectTrigger>
            <SelectContent>
              {opts.groups.map((g) => (
                <SelectItem key={g.id} value={String(g.id)} disabled={g.id === entry.loftGroup?.id}>{g.name}{g.capacity != null ? ` (cap ${g.capacity})` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" disabled={!group || busy} onClick={() => move({ kind: "group", groupId: Number(group) })}>Move</Button>
        </div>
      </Section>

      <Section title={`Basket · now ${entry.baskets.map((x) => x.label).join(", ") || "none"}`}>
        <div className="flex gap-2 pt-1">
          <Select value={basket} onValueChange={setBasket}>
            <SelectTrigger className="h-8"><SelectValue placeholder={opts.baskets.length ? "Move to basket…" : "No baskets"} /></SelectTrigger>
            <SelectContent>
              {opts.baskets.map((x) => (
                <SelectItem key={x.id} value={String(x.id)} disabled={x.used >= x.capacity}>
                  {x.label} · {x.phase.toLowerCase()}{x.race ? ` · ${x.race}` : ""} ({x.used}/{x.capacity})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" disabled={!basket || busy} onClick={() => move({ kind: "basket", basketId: Number(basket) })}>Move</Button>
        </div>
        <p className="pt-1 text-xs text-muted-foreground">Replaces the bird&apos;s basket for that phase and race.</p>
      </Section>

      <Section title={`Owner · now ${entry.registrationOwner?.name ?? "—"}`}>
        <div className="flex gap-2 pt-1">
          <Select value={owner} onValueChange={(v) => { setOwner(v); setConfirmOwner(false); }}>
            <SelectTrigger className="h-8"><SelectValue placeholder="Move to breeder…" /></SelectTrigger>
            <SelectContent>
              {opts.registrations.map((r) => (
                <SelectItem key={r.id} value={String(r.id)}>{r.name || "—"}{r.loft ? ` · ${r.loft}` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!confirmOwner ? (
            <Button size="sm" disabled={!owner || busy} onClick={() => setConfirmOwner(true)}>Move</Button>
          ) : (
            <Button size="sm" variant="destructive" disabled={busy} onClick={() => move({ kind: "owner", eventInventoryId: Number(owner) })}>Confirm</Button>
          )}
        </div>
        {confirmOwner && target && (
          <p className="pt-1 text-xs text-amber-700">
            Moves this one bird to {target.name}. As in HayLoft, its entry fee, hot spot fee and class bets are cleared and both
            registrations&apos; perch fees are recalculated. Not allowed while the bird has refunds.
          </p>
        )}
      </Section>
    </div>
  );
}
