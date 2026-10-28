"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard } from "lucide-react";

interface PaymentView {
  id: number;
  paymentValue: number | null;
  paymentMethod: number | null;
  paymentDate: string | null;
  paymentDesc: string | null;
  status: string;
}

export interface PaymentItemView {
  id: number;
  eventInventory?: {
    season?: { event?: { id: number; name?: string | null } | null } | null;
    payments?: PaymentView[];
  } | null;
}

const METHOD_LABELS: Record<number, string> = {
  0: "Cash",
  1: "Credit Card",
  2: "PayPal",
  3: "Bank Transfer",
};

// ponytail: payments are still per registration (shared by all its birds);
// switches to per-bird FeeLines with the per-bird payments rework.
export function BirdPaymentsCard({ items }: { items: PaymentItemView[] }) {
  const groups = items
    .map((it) => ({
      id: it.id,
      eventName: it.eventInventory?.season?.event?.name ?? "Unknown Event",
      payments: it.eventInventory?.payments ?? [],
    }))
    .filter((g) => g.payments.length > 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-4 w-4" />
          Payments
        </CardTitle>
      </CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments yet.</p>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {groups.map((g) => {
              const paid = g.payments
                .filter((p) => p.status === "PAID")
                .reduce((s, p) => s + (p.paymentValue ?? 0), 0);
              return (
                <div key={g.id} className="border rounded-md">
                  <div className="flex justify-between px-3 py-2 text-sm font-medium">
                    <span className="truncate">{g.eventName}</span>
                    <span className="font-mono">${paid.toFixed(2)} paid</span>
                  </div>
                  <div className="border-t px-3 py-2 space-y-1 text-xs">
                    {g.payments.map((p) => (
                      <div key={p.id} className="flex items-center gap-2">
                        <span className="text-muted-foreground w-20 shrink-0">
                          {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : "-"}
                        </span>
                        <span className="truncate flex-1">
                          {p.paymentDesc || (p.paymentMethod != null ? METHOD_LABELS[p.paymentMethod] ?? "Other" : "-")}
                        </span>
                        <Badge variant={p.status === "PAID" ? "default" : "outline"} className="text-[10px]">
                          {p.status}
                        </Badge>
                        <span className="font-mono w-20 text-right">
                          ${(p.paymentValue ?? 0).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
