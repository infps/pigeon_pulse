"use client";

import type { Event, EventInventory } from "@/lib/types";
import { useMemo, useState } from "react";
import { useListEventInventory } from "@/lib/api/event-inventory";
import { useSeasonContext } from "@/lib/season-context";
import { DataTable } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus } from "lucide-react";
import { createBreedersColumns } from "./breeders-columns";
import { BreederDetailsDialog } from "@/components/breeder-details-dialog";
import { RegisterDialog } from "@/components/register-dialog";

interface BreedersTabProps {
  event: Event;
  eventId: string;
  onGoToRegister?: () => void;
}

export function BreedersTab({ event, eventId, onGoToRegister }: BreedersTabProps) {
  const { selectedSeasonId } = useSeasonContext();
  const [selectedEventInventoryId, setSelectedEventInventoryId] = useState<number | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  const [paymentStatus, setPaymentStatus] = useState<string>("all");
  const [arrivalFrom, setArrivalFrom] = useState<string>("");
  const [arrivalTo, setArrivalTo] = useState<string>("");

  const filters = useMemo(() => {
    const toIso = (d: string, end: boolean): string | undefined => {
      if (!d) return undefined;
      const dt = new Date(end ? `${d}T23:59:59.999` : `${d}T00:00:00`);
      return isNaN(dt.getTime()) ? undefined : dt.toISOString();
    };
    return {
      paymentStatus,
      arrivalFrom: toIso(arrivalFrom, false),
      arrivalTo: toIso(arrivalTo, true),
    };
  }, [paymentStatus, arrivalFrom, arrivalTo]);

  const { data, isPending, error } = useListEventInventory(eventId, filters, selectedSeasonId);

  const clearFilters = () => {
    setPaymentStatus("all");
    setArrivalFrom("");
    setArrivalTo("");
  };
  const hasFilters = paymentStatus !== "all" || arrivalFrom !== "" || arrivalTo !== "";

  const handleBreederClick = (eventInventoryId: number) => {
    setSelectedEventInventoryId(eventInventoryId);
    setIsDetailsDialogOpen(true);
  };

  const columns = createBreedersColumns(handleBreederClick);

  const filterBar = (
    <div className="flex items-end justify-between gap-3 border rounded-lg p-3 bg-muted/30">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Payment Status</Label>
          <Select value={paymentStatus} onValueChange={setPaymentStatus}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="OVERPAID">Overpaid</SelectItem>
              <SelectItem value="PARTIAL">Partial</SelectItem>
              <SelectItem value="PENDING">Unpaid</SelectItem>
              <SelectItem value="NA">N/A</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Registered From</Label>
          <Input
            type="date"
            className="h-9 w-44"
            value={arrivalFrom}
            onChange={(e) => setArrivalFrom(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Registered To</Label>
          <Input
            type="date"
            className="h-9 w-44"
            value={arrivalTo}
            onChange={(e) => setArrivalTo(e.target.value)}
          />
        </div>
        {hasFilters && (
          <Button variant="outline" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>
      <Button size="sm" onClick={() => setIsRegisterOpen(true)}>
        <UserPlus className="h-4 w-4 mr-1.5" />
        Register Breeder
      </Button>
    </div>
  );

  const rawInventory: EventInventory[] = data?.eventInventory || [];

  // Group by (breederId, loft) — merge items/payments, keep first row's id for dialog
  const eventInventory: EventInventory[] = Object.values(
    rawInventory.reduce<Record<string, EventInventory>>((acc, inv) => {
      const key = `${inv.breederId}__${inv.loft ?? ""}`;
      if (!acc[key]) {
        acc[key] = { ...inv, items: [...(inv.items ?? [])], payments: [...(inv.payments ?? [])] };
      } else {
        acc[key].items = [...(acc[key].items ?? []), ...(inv.items ?? [])];
        acc[key].payments = [...(acc[key].payments ?? []), ...(inv.payments ?? [])];
        acc[key].reservedBirds = (acc[key].reservedBirds ?? 0) + (inv.reservedBirds ?? 0);
      }
      return acc;
    }, {})
  );

  const emptyState = (
    <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
      No breeders registered yet. Click <strong>Register Breeder</strong> above to add one.
    </div>
  );

  return (
    <div className="space-y-4">
      {filterBar}

      {isPending ? (
        <>
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </>
      ) : error || eventInventory.length === 0 ? (
        emptyState
      ) : (
        <DataTable
          tableId="event-breeders"
          columns={columns}
          data={eventInventory}
          filterableColumns={[
            { id: "breederName", title: "Breeder Name" },
            { id: "loft", title: "Loft" },
            { id: "breederEmail", title: "Email" },
            { id: "breederPhone", title: "Phone" },
            { id: "partners", title: "Partners" },
            { id: "reservedBirds", title: "Bird Count" },
            { id: "signInDate", title: "Sign In Date" },
            { id: "paymentStatus", title: "Payment Status" },
            { id: "note", title: "Note" },
          ]}
          onRowClick={(inv) => handleBreederClick(inv.id)}
          rowClickMode="action"
        />
      )}

      <BreederDetailsDialog
        open={isDetailsDialogOpen}
        onOpenChange={setIsDetailsDialogOpen}
        eventInventoryId={selectedEventInventoryId}
        event={event}
      />

      <RegisterDialog
        event={event}
        eventId={eventId}
        open={isRegisterOpen}
        onOpenChange={setIsRegisterOpen}
      />
    </div>
  );
}
