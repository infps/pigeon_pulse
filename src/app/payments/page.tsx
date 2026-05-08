"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DollarSign, CreditCard, AlertCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useApiQuery } from "@/hooks/useApi";
import { apiEndpoints } from "@/lib/endpoints";
import { paymentColumns } from "./columns";
import { ExportButton } from "@/components/export-button";

export default function PaymentsPage() {
  const { data: session, isPending: sessionLoading } = authClient.useSession();

  const { data, isPending } = useApiQuery({
    endpoint: apiEndpoints.breeder.payments,
    queryKey: ["breeder", "payments"],
    enabled: !!session?.user,
  });

  const allPayments = data?.payments || [];

  const [eventFilter, setEventFilter] = useState<string>("ALL");

  const eventOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of allPayments) {
      const id = p.eventInventory?.event?.id ?? p.event?.id;
      const name = p.eventInventory?.event?.name ?? p.event?.name;
      if (id != null) map.set(id, name ?? `Event ${id}`);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [allPayments]);

  const payments = useMemo(() => {
    if (eventFilter === "ALL") return allPayments;
    const id = parseInt(eventFilter, 10);
    return allPayments.filter(
      (p: { eventInventory?: { event?: { id?: number } }; event?: { id?: number } }) =>
        (p.eventInventory?.event?.id ?? p.event?.id) === id,
    );
  }, [allPayments, eventFilter]);

  const { total, paid, remaining } = useMemo(() => {
    let t = 0, p = 0;
    for (const pay of payments) {
      const val = pay.paymentValue ?? 0;
      t += val;
      if (pay.status === "PAID" || pay.status === 1) p += val;
    }
    return { total: t, paid: p, remaining: t - p };
  }, [payments]);

  if (sessionLoading) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Not Logged In</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Please log in to view your payments.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Payments</h1>
        <div className="flex items-center gap-2">
          <Select value={eventFilter} onValueChange={setEventFilter}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Filter by event" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All events</SelectItem>
              {eventOptions.map((e) => (
                <SelectItem key={e.id} value={String(e.id)}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ExportButton
            kind="payments"
            eventId={eventFilter === "ALL" ? undefined : eventFilter}
            label="Export Payments"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-blue-100">
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Amount</p>
              <p className="text-2xl font-bold">${total.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-green-100">
              <CreditCard className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Paid</p>
              <p className="text-2xl font-bold text-green-600">${paid.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-red-100">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Remaining</p>
              <p className={`text-2xl font-bold ${remaining > 0 ? "text-red-600" : "text-green-600"}`}>
                ${remaining.toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payments Table */}
      {isPending ? (
        <Skeleton className="h-96 w-full" />
      ) : payments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No payment transactions yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <DataTable
              columns={paymentColumns}
              data={payments}
              filterableColumns={[
                { id: "event", title: "Event" },
              ]}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
