"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Hash } from "lucide-react";
import type { InventoryItemView } from "./bird-event-section";

interface Props {
  items: InventoryItemView[];
}

type Bet = { label: string; value: number | null | undefined };

function belgian(item: InventoryItemView): Bet[] {
  return [
    { label: "B1", value: item.belgianShowBet1 },
    { label: "B2", value: item.belgianShowBet2 },
    { label: "B3", value: item.belgianShowBet3 },
    { label: "B4", value: item.belgianShowBet4 },
    { label: "B5", value: item.belgianShowBet5 },
    { label: "B6", value: item.belgianShowBet6 },
    { label: "B7", value: item.belgianShowBet7 },
  ];
}
function standard(item: InventoryItemView): Bet[] {
  return [
    { label: "S1", value: item.standardShowBet1 },
    { label: "S2", value: item.standardShowBet2 },
    { label: "S3", value: item.standardShowBet3 },
    { label: "S4", value: item.standardShowBet4 },
    { label: "S5", value: item.standardShowBet5 },
    { label: "S6", value: item.standardShowBet6 },
  ];
}
function wta(item: InventoryItemView): Bet[] {
  return [
    { label: "W1", value: item.wtaBet1 },
    { label: "W2", value: item.wtaBet2 },
    { label: "W3", value: item.wtaBet3 },
    { label: "W4", value: item.wtaBet4 },
    { label: "W5", value: item.wtaBet5 },
  ];
}

function activeOnly(bets: Bet[]): Bet[] {
  return bets.filter((b) => (b.value ?? 0) > 0);
}

export function BirdClassesCard({ items }: Props) {
  const eventsWithBets = items.filter((it) => {
    const all = [...belgian(it), ...standard(it), ...wta(it)];
    return activeOnly(all).length > 0;
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Hash className="h-4 w-4" />
          Class Properties
        </CardTitle>
      </CardHeader>
      <CardContent>
        {eventsWithBets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No class bets activated.
          </p>
        ) : (
          <div className="space-y-4">
            {eventsWithBets.map((item) => {
              const eventName =
                item.eventInventory?.event?.name ?? "Unknown Event";
              const b = activeOnly(belgian(item));
              const s = activeOnly(standard(item));
              const w = activeOnly(wta(item));
              return (
                <div key={item.id} className="space-y-2">
                  <div className="text-sm font-medium">{eventName}</div>
                  {b.length > 0 && <ChipRow title="Belgian" bets={b} />}
                  {s.length > 0 && <ChipRow title="Standard" bets={s} />}
                  {w.length > 0 && <ChipRow title="WTA" bets={w} />}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChipRow({ title, bets }: { title: string; bets: Bet[] }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {bets.map((b) => (
          <div
            key={b.label}
            className="border rounded px-2 py-0.5 text-xs flex items-center gap-1"
          >
            <span className="font-mono text-muted-foreground">{b.label}</span>
            <span>${(b.value ?? 0).toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
