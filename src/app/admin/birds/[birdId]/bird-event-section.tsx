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

interface RaceItemView {
  id: number;
  status?: Nullable<string>;
  race?: Nullable<{ id: number; name: Nullable<string> }>;
  result?: Nullable<{
    birdPosition: Nullable<number>;
    prizeValue: Nullable<number>;
    arrivalTime: Nullable<string>;
  }>;
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

  const belgianBets: [string, Nullable<number>][] = [
    ["B1", item.belgianShowBet1],
    ["B2", item.belgianShowBet2],
    ["B3", item.belgianShowBet3],
    ["B4", item.belgianShowBet4],
    ["B5", item.belgianShowBet5],
    ["B6", item.belgianShowBet6],
    ["B7", item.belgianShowBet7],
  ];
  const standardBets: [string, Nullable<number>][] = [
    ["S1", item.standardShowBet1],
    ["S2", item.standardShowBet2],
    ["S3", item.standardShowBet3],
    ["S4", item.standardShowBet4],
    ["S5", item.standardShowBet5],
    ["S6", item.standardShowBet6],
  ];
  const wtaBets: [string, Nullable<number>][] = [
    ["W1", item.wtaBet1],
    ["W2", item.wtaBet2],
    ["W3", item.wtaBet3],
    ["W4", item.wtaBet4],
    ["W5", item.wtaBet5],
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

function BetRow({
  title,
  bets,
}: {
  title: string;
  bets: [string, Nullable<number>][];
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{title}</div>
      <div className="flex flex-wrap gap-2">
        {bets.map(([label, val]) => (
          <div
            key={label}
            className="border rounded px-2 py-1 text-xs flex items-center gap-1"
          >
            <span className="font-mono text-muted-foreground">{label}</span>
            <span>{val != null ? fmtMoney(val) : "-"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
