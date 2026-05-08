"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, DollarSign } from "lucide-react";
import type { InventoryItemView } from "./bird-event-section";

interface Props {
  items: InventoryItemView[];
}

function fmtMoney(v: number | null | undefined): string {
  if (v == null) return "$0.00";
  return `$${v.toFixed(2)}`;
}

function totalFee(item: InventoryItemView): number {
  return (
    (item.entryFeeValue ?? 0) +
    (item.perchFeeValue ?? 0) +
    (item.raceFeeValue ?? 0) +
    (item.hotSpotFeeValue ?? 0)
  );
}

function totalRefund(item: InventoryItemView): number {
  return (
    (item.entryRefund ?? 0) +
    (item.hotSpotRefund ?? 0) +
    (item.betsRefund ?? 0)
  );
}

export function BirdFeesCard({ items }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign className="h-4 w-4" />
          Fees Details
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No fees yet.</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {items.map((item) => (
              <FeeRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FeeRow({ item }: { item: InventoryItemView }) {
  const [open, setOpen] = useState(false);
  const eventName = item.eventInventory?.event?.name ?? "Unknown Event";
  const total = totalFee(item);
  const refund = totalRefund(item);

  return (
    <div className="border rounded-md">
      <Button
        variant="ghost"
        className="w-full justify-start h-auto px-3 py-2 hover:bg-muted/40"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2 w-full">
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="text-sm font-medium truncate flex-1 text-left">
            {eventName}
          </span>
          <span className="text-sm font-mono">{fmtMoney(total)}</span>
        </div>
      </Button>
      {open && (
        <div className="px-3 pb-3 pt-1 border-t text-xs space-y-1">
          <Line label="Entry Fee" value={item.entryFeeValue} />
          <Line label="Per Bird Fee" value={item.perchFeeValue} />
          <Line label="Race Fee" value={item.raceFeeValue} />
          <Line label="Hot Spot" value={item.hotSpotFeeValue} />
          {refund > 0 && (
            <>
              <div className="border-t my-1" />
              <Line label="Entry Refund" value={item.entryRefund} muted />
              <Line label="Hot Spot Refund" value={item.hotSpotRefund} muted />
              <Line label="Bets Refund" value={item.betsRefund} muted />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Line({
  label,
  value,
  muted,
}: {
  label: string;
  value: number | null | undefined;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex justify-between ${muted ? "text-muted-foreground" : ""}`}
    >
      <span>{label}</span>
      <span className="font-mono">{fmtMoney(value)}</span>
    </div>
  );
}
