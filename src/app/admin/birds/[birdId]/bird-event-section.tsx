"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronRight } from "lucide-react";

type Nullable<T> = T | null | undefined;

type BetMeta = { bettorId: string; ownerUserId: string | null; category: string; tierIndex: number; stakePaymentId: number | null; stakePaid: boolean };

interface RaceItemView {
  id: number;
  status?: Nullable<string>;
  race?: Nullable<{ id: number; name: Nullable<string> }>;
  result?: Nullable<{
    birdPosition: Nullable<number>;
    prizeValue: Nullable<number>;
    arrivalTime: Nullable<string>;
  }>;
  bets?: Nullable<BetMeta[]>;
}

type BetEntry = { label: string; value: Nullable<number>; meta?: BetMeta | null };

export function findBetMeta(item: InventoryItemView, category: string, tierIndex: number): BetMeta | null {
  for (const ri of item.raceItems ?? []) {
    const b = ri.bets?.find((b) => b.category === category && b.tierIndex === tierIndex);
    if (b) return b;
  }
  return null;
}

export function betChipBg(meta?: BetMeta | null): string {
  if (!meta) return "";
  const isOwner = meta.ownerUserId !== null && meta.bettorId === meta.ownerUserId;
  if (isOwner) return meta.stakePaid ? "bg-green-100" : "bg-green-50";
  return meta.stakePaid ? "bg-pink-100" : "bg-pink-50";
}

interface BasketAssignmentView {
  id: number;
  eventBasket?: Nullable<{
    label: Nullable<string>;
    phase: "LOFT" | "RACE";
    race?: Nullable<{ name: Nullable<string> }>;
  }>;
}

export interface InventoryItemView {
  id: number;
  signInDate?: Nullable<string>;
  arrivalDate?: Nullable<string>;
  departureDate?: Nullable<string>;
  entryFeeValue?: Nullable<number>;
  perchFeeValue?: Nullable<number>;
  raceFeeValue?: Nullable<number>;
  hotSpotFeeValue?: Nullable<number>;
  entryRefund?: Nullable<number>;
  hotSpotRefund?: Nullable<number>;
  betsRefund?: Nullable<number>;
  isBackup?: Nullable<number>;
  isBetActive?: Nullable<number>;
  belgianShowBet1?: Nullable<number>;
  belgianShowBet2?: Nullable<number>;
  belgianShowBet3?: Nullable<number>;
  belgianShowBet4?: Nullable<number>;
  belgianShowBet5?: Nullable<number>;
  belgianShowBet6?: Nullable<number>;
  belgianShowBet7?: Nullable<number>;
  standardShowBet1?: Nullable<number>;
  standardShowBet2?: Nullable<number>;
  standardShowBet3?: Nullable<number>;
  standardShowBet4?: Nullable<number>;
  standardShowBet5?: Nullable<number>;
  standardShowBet6?: Nullable<number>;
  wtaBet1?: Nullable<number>;
  wtaBet2?: Nullable<number>;
  wtaBet3?: Nullable<number>;
  wtaBet4?: Nullable<number>;
  wtaBet5?: Nullable<number>;
  eventInventory?: Nullable<{
    event?: Nullable<{ id: number; name?: Nullable<string>; signInDate?: Nullable<string> }>;
  }>;
  raceItems?: Nullable<RaceItemView[]>;
  basketAssignments?: Nullable<BasketAssignmentView[]>;
  signInDateEvent?: Nullable<string>;
}

interface Props {
  item: InventoryItemView;
  defaultOpen?: boolean;
}

function fmtDate(v: Nullable<string>): string {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleDateString();
  } catch {
    return "-";
  }
}

function fmtMoney(v: Nullable<number>): string {
  if (v == null) return "-";
  return `$${v.toFixed(2)}`;
}

function fmtTime(v: Nullable<string>): string {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleString();
  } catch {
    return "-";
  }
}

export function BirdEventSection({ item, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const event = item.eventInventory?.event;
  const eventName = event?.name ?? "Unknown Event";
  const signInDate = event?.signInDate ?? item.signInDateEvent;

  const belgianBets: BetEntry[] = [
    { label: "B1", value: item.belgianShowBet1, meta: findBetMeta(item, "BELGIAN", 1) },
    { label: "B2", value: item.belgianShowBet2, meta: findBetMeta(item, "BELGIAN", 2) },
    { label: "B3", value: item.belgianShowBet3, meta: findBetMeta(item, "BELGIAN", 3) },
    { label: "B4", value: item.belgianShowBet4, meta: findBetMeta(item, "BELGIAN", 4) },
    { label: "B5", value: item.belgianShowBet5, meta: findBetMeta(item, "BELGIAN", 5) },
    { label: "B6", value: item.belgianShowBet6, meta: findBetMeta(item, "BELGIAN", 6) },
    { label: "B7", value: item.belgianShowBet7, meta: findBetMeta(item, "BELGIAN", 7) },
  ];
  const standardBets: BetEntry[] = [
    { label: "S1", value: item.standardShowBet1, meta: findBetMeta(item, "STANDARD", 1) },
    { label: "S2", value: item.standardShowBet2, meta: findBetMeta(item, "STANDARD", 2) },
    { label: "S3", value: item.standardShowBet3, meta: findBetMeta(item, "STANDARD", 3) },
    { label: "S4", value: item.standardShowBet4, meta: findBetMeta(item, "STANDARD", 4) },
    { label: "S5", value: item.standardShowBet5, meta: findBetMeta(item, "STANDARD", 5) },
    { label: "S6", value: item.standardShowBet6, meta: findBetMeta(item, "STANDARD", 6) },
  ];
  const wtaBets: BetEntry[] = [
    { label: "W1", value: item.wtaBet1, meta: findBetMeta(item, "WTA", 1) },
    { label: "W2", value: item.wtaBet2, meta: findBetMeta(item, "WTA", 2) },
    { label: "W3", value: item.wtaBet3, meta: findBetMeta(item, "WTA", 3) },
    { label: "W4", value: item.wtaBet4, meta: findBetMeta(item, "WTA", 4) },
    { label: "W5", value: item.wtaBet5, meta: findBetMeta(item, "WTA", 5) },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <Button
          variant="ghost"
          className="w-full justify-start p-0 h-auto hover:bg-transparent"
          onClick={() => setOpen((v) => !v)}
        >
          <div className="flex items-center gap-2 w-full">
            {open ? (
              <ChevronDown className="h-4 w-4 shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0" />
            )}
            <div className="text-left flex-1">
              <div className="font-semibold">{eventName}</div>
              <div className="text-xs text-muted-foreground">
                Sign-in: {fmtDate(signInDate)}
              </div>
            </div>
            <div className="flex gap-1">
              {item.isBackup === 1 && (
                <Badge variant="secondary">Backup</Badge>
              )}
              {item.isBetActive === 1 && (
                <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                  Bets Active
                </Badge>
              )}
            </div>
          </div>
        </Button>
      </CardHeader>

      {open && (
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Arrival</div>
              <div>{fmtDate(item.arrivalDate)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Departure</div>
              <div>{fmtDate(item.departureDate)}</div>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium mb-2">Fees</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <FeeCell label="Perch Fee" value={item.entryFeeValue} />
              <FeeCell label="Bird Fee" value={item.perchFeeValue} />
              <FeeCell label="Race Fee" value={item.raceFeeValue} />
              <FeeCell label="Hot Spot" value={item.hotSpotFeeValue} />
              <FeeCell label="Entry Refund" value={item.entryRefund} />
              <FeeCell label="Hot Spot Refund" value={item.hotSpotRefund} />
              <FeeCell label="Bets Refund" value={item.betsRefund} />
            </div>
          </div>

          {/* TODO: admin edit of bet values deferred */}
          <div>
            <div className="text-sm font-medium mb-2">Classes</div>
            <div className="space-y-2">
              <BetRow title="Belgian Show" bets={belgianBets} />
              <BetRow title="Standard Show" bets={standardBets} />
              <BetRow title="WTA" bets={wtaBets} />
            </div>
          </div>

          {item.raceItems && item.raceItems.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-2">Race Results</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Race</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Prize</TableHead>
                    <TableHead>Arrival</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {item.raceItems.map((ri) => (
                    <TableRow key={ri.id}>
                      <TableCell>{ri.race?.name ?? "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{ri.status ?? "-"}</Badge>
                      </TableCell>
                      <TableCell>{ri.result?.birdPosition ?? "-"}</TableCell>
                      <TableCell>{fmtMoney(ri.result?.prizeValue)}</TableCell>
                      <TableCell>{fmtTime(ri.result?.arrivalTime)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {item.basketAssignments && item.basketAssignments.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-2">Basket Assignments</div>
              <ul className="space-y-1 text-sm">
                {item.basketAssignments.map((ba) => (
                  <li key={ba.id} className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">
                      {ba.eventBasket?.label ?? "-"}
                    </Badge>
                    <Badge variant="secondary">
                      {ba.eventBasket?.phase ?? "-"}
                    </Badge>
                    {ba.eventBasket?.race?.name && (
                      <span className="text-muted-foreground">
                        {ba.eventBasket.race.name}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function FeeCell({ label, value }: { label: string; value: Nullable<number> }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div>{fmtMoney(value)}</div>
    </div>
  );
}

function BetRow({ title, bets }: { title: string; bets: BetEntry[] }) {
  const active = bets.filter((b) => (b.value ?? 0) > 0);
  if (active.length === 0) return null;
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{title}</div>
      <div className="flex flex-wrap gap-2">
        {active.map((b) => (
          <div
            key={b.label}
            className={`border rounded px-2 py-1 text-xs flex items-center gap-1 ${betChipBg(b.meta)}`}
          >
            <span className="font-mono text-muted-foreground">{b.label}</span>
            <span>{b.value != null ? fmtMoney(b.value) : "-"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
