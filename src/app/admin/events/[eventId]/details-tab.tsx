"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil } from "lucide-react";
import type { BettingScheme, Event, FeeScheme, PrizeScheme } from "@/lib/types";
import { useSeasonContext } from "@/lib/season-context";
import { EditEventTab } from "./edit-event-tab";
import { StaticPinMap } from "@/components/map";

interface DashboardStats {
  breederCount: number;
  totalBirds: number;
  activeBirds: number;
  lostBirds: number;
  injuredBirds: number;
  foreignBirds: number;
  totalCollected: number;
  platformFee: number;
  prizePool: number;
  seasonName: string | null;
  feeSchemeName: string | null;
  bettingSchemeName: string | null;
  finalPrizeSchemeName: string | null;
  hotSpot1PrizeName: string | null;
  hotSpot2PrizeName: string | null;
  hotSpot3PrizeName: string | null;
  hotSpotAvgPrizeName: string | null;
  totalPerchFee: number;
  reservedWaiting: number;
  reservedBirds: number;
  hereCount: number;
  replacedCount: number;
  entryFeeBirds: number;
  entryFees: number;
  entryRefund: number;
  entryCommission: number;
  entryTotalValue: number;
  hotSpotBirds: number;
  hotSpotFees: number;
  hotSpotRefunds: number;
  hotSpotCommission: number;
  hotSpotValue: number;
  totalBets: number;
  betsRefund: number;
  betsCommission: number;
  betsValue: number;
  paymentClasses: number;
}

interface DetailsTabProps {
  event: Event;
  eventId: string;
  feeSchemes: FeeScheme[];
  prizeSchemes: PrizeScheme[];
  bettingSchemes: BettingScheme[];
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground w-32 shrink-0">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export function DetailsTab({ event, eventId, feeSchemes, prizeSchemes, bettingSchemes }: DetailsTabProps) {
  const [editOpen, setEditOpen] = useState(false);
  const { selectedSeasonId } = useSeasonContext();

  const { data: stats, isPending } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats", eventId, selectedSeasonId],
    queryFn: () => {
      const qs = selectedSeasonId ? `?seasonId=${selectedSeasonId}` : "";
      return fetch(`/api/admin/event/${eventId}/dashboard-stats${qs}`, { credentials: "include" }).then((r) => r.json());
    },
    staleTime: 30_000,
    enabled: selectedSeasonId !== null,
  });

  const eventDate = event.eventDate ? new Date(event.eventDate).toLocaleDateString() : "—";
  const endDate = event.endDate ? new Date(event.endDate).toLocaleDateString() : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">{event.name}</h2>
          {event.shortName && <p className="text-muted-foreground">{event.shortName}</p>}
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={event.isOpen ? "default" : "secondary"}>
              {event.isOpen ? "Open" : "Closed"}
            </Badge>
            {stats?.seasonName && (
              <Badge variant="outline">{stats.seasonName}</Badge>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="h-4 w-4 mr-2" />
          Edit Event
        </Button>
      </div>

      {/* Stat groups — equal-width grid matching page */}
      {isPending ? (
        <div className="grid grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36" />)}
        </div>
      ) : (
        <div className="grid grid-cols-6 gap-4">
          {/* 1. Total perch fee */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Total perch fee</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <StatRow label="Value" value={fmtCurrency(stats?.totalPerchFee ?? 0)} />
            </CardContent>
          </Card>

          {/* 2. Total birds */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Total birds</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <StatRow label="Reserved waiting" value={stats?.reservedWaiting ?? 0} />
              <StatRow label="Reserved" value={stats?.reservedBirds ?? 0} />
              <StatRow label="Here" value={stats?.hereCount ?? 0} />
              <StatRow label="Lost" value={stats?.lostBirds ?? 0} />
              <StatRow label="Replaced" value={stats?.replacedCount ?? 0} />
            </CardContent>
          </Card>

          {/* 3. Total capital */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Total capital</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <StatRow label="Birds" value={stats?.entryFeeBirds ?? 0} />
              <StatRow label="Entry fees" value={fmtCurrency(stats?.entryFees ?? 0)} />
              <StatRow label="Entry refund" value={fmtCurrency(stats?.entryRefund ?? 0)} />
              <StatRow label="Commission" value={fmtCurrency(stats?.entryCommission ?? 0)} />
              <StatRow label="Total value" value={fmtCurrency(stats?.entryTotalValue ?? 0)} />
            </CardContent>
          </Card>

          {/* 4. Total hot spot capital */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Hot spot capital</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <StatRow label="Birds" value={stats?.hotSpotBirds ?? 0} />
              <StatRow label="Hot spot fees" value={fmtCurrency(stats?.hotSpotFees ?? 0)} />
              <StatRow label="Refunds" value={fmtCurrency(stats?.hotSpotRefunds ?? 0)} />
              <StatRow label="Commission" value={fmtCurrency(stats?.hotSpotCommission ?? 0)} />
              <StatRow label="Value" value={fmtCurrency(stats?.hotSpotValue ?? 0)} />
            </CardContent>
          </Card>

          {/* 5. Total bets */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Total bets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <StatRow label="Bets" value={fmtCurrency(stats?.totalBets ?? 0)} />
              <StatRow label="Bets refund" value={fmtCurrency(stats?.betsRefund ?? 0)} />
              <StatRow label="Commission" value={fmtCurrency(stats?.betsCommission ?? 0)} />
              <StatRow label="Value" value={fmtCurrency(stats?.betsValue ?? 0)} />
            </CardContent>
          </Card>

          {/* 6. Total payment */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Total payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <StatRow label="Perch fee" value={fmtCurrency(stats?.totalPerchFee ?? 0)} />
              <StatRow label="Entry fee" value={fmtCurrency(stats?.entryFees ?? 0)} />
              <StatRow label="Hot spot fee" value={fmtCurrency(stats?.hotSpotFees ?? 0)} />
              <StatRow label="Classes" value={fmtCurrency(stats?.paymentClasses ?? 0)} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Info section — 3 col layout */}
      <div className="grid grid-cols-3 gap-4">
        {/* Col 1: Event Info + Images */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Event Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {event.bannerImage && (
              <img src={event.bannerImage} alt="Banner" className="w-full h-32 rounded object-cover border" />
            )}
            <div className="flex items-start gap-3">
              {event.logoImage && (
                <img src={event.logoImage} alt="Logo" className="h-14 w-14 rounded object-cover border shrink-0" />
              )}
              <div className="space-y-1 min-w-0">
                <p className="font-semibold truncate">{event.name}</p>
                {event.shortName && <p className="text-muted-foreground text-xs truncate">{event.shortName}</p>}
                {event.description && <p className="text-muted-foreground text-xs leading-snug">{event.description}</p>}
              </div>
            </div>
            <div className="space-y-1.5 border-t pt-3">
              <InfoRow label="Date" value={endDate ? `${eventDate} – ${endDate}` : eventDate} />
              <InfoRow label="Status" value={event.isOpen ? "Open" : "Closed"} />
              {event.locationAddress && <InfoRow label="Address" value={event.locationAddress} />}
            </div>
          </CardContent>
        </Card>

        {/* Col 2: Location map */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Location</CardTitle>
          </CardHeader>
          <CardContent>
            {event.latitude != null && event.longitude != null ? (
              <div className="space-y-2 text-sm">
                <StaticPinMap
                  lat={event.latitude}
                  lng={event.longitude}
                  label={event.locationAddress ?? event.name ?? undefined}
                  height={220}
                />
                <p className="text-xs text-muted-foreground tabular-nums">
                  {event.latitude.toFixed(5)}, {event.longitude.toFixed(5)}
                </p>
                {event.locationAddress && (
                  <p className="text-xs text-muted-foreground">{event.locationAddress}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No location pinned.</p>
            )}
          </CardContent>
        </Card>

        {/* Col 3: Contact + Social + Schemes */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <InfoRow label="Name" value={event.contactName ?? "—"} />
              <InfoRow label="Email" value={event.contactEmail ?? "—"} />
              <InfoRow label="Phone" value={event.contactPhone ?? "—"} />
              <InfoRow label="Website" value={event.contactWebsite ?? "—"} />
              <InfoRow label="Address" value={event.contactAddress ?? "—"} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Social</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <InfoRow label="YouTube" value={event.socialYt ?? "—"} />
              <InfoRow label="Facebook" value={event.socialFb ?? "—"} />
              <InfoRow label="Twitter" value={event.socialTwitter ?? "—"} />
              <InfoRow label="Instagram" value={event.socialInsta ?? "—"} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Active Season Schemes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Season Schemes</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {stats?.seasonName ? (
            <div className="grid grid-cols-4 gap-x-8 gap-y-1.5">
              <InfoRow label="Season" value={stats.seasonName} />
              <InfoRow label="Fee Scheme" value={stats.feeSchemeName ?? "—"} />
              <InfoRow label="Betting Scheme" value={stats.bettingSchemeName ?? "—"} />
              <InfoRow label="Final Prize" value={stats.finalPrizeSchemeName ?? "—"} />
              <InfoRow label="Hot Spot 1" value={stats.hotSpot1PrizeName ?? "—"} />
              <InfoRow label="Hot Spot 2" value={stats.hotSpot2PrizeName ?? "—"} />
              <InfoRow label="Hot Spot 3" value={stats.hotSpot3PrizeName ?? "—"} />
              <InfoRow label="Hot Spot Avg" value={stats.hotSpotAvgPrizeName ?? "—"} />
            </div>
          ) : isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : (
            <p className="text-muted-foreground">No active season.</p>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
          </DialogHeader>
          <EditEventTab
            event={event}
            eventId={eventId}
            feeSchemes={feeSchemes}
            prizeSchemes={prizeSchemes}
            bettingSchemes={bettingSchemes}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
