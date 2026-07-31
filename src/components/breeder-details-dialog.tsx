"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useGetEventInventory, useCreatePayment, useUpdatePayment, useDeletePayment, useAddPartner, useDeletePartner, useListBreeders } from "@/lib/api/payments";
import { useAdminListBirds } from "@/lib/api/admin-birds";
import { Download, Plus, Trash2, Edit, UserPlus, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Event, EventInventory, EventInventoryItem } from "@/lib/types";
import { EditBirdDialog } from "./edit-bird-dialog";
import { CreateBirdDialog } from "./create-bird-dialog";
import { ExportButton } from "./export-button";
import { BirdDetailDialog } from "./bird-detail-dialog";

const METHOD_LABELS: Record<number, string> = { 0: "Cash", 1: "Credit Card", 2: "PayPal", 3: "Bank Transfer" };
const TYPE_LABELS: Record<number, string> = { 0: "Perch Fee", 1: "Per Bird Fee", 2: "Races Fee", 3: "Refund", 4: "Other" };

interface BreederDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventInventoryId: number | null;
  event: Event;
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString();
}

function fmtMoney(v: number) {
  return `$${v.toFixed(2)}`;
}

export function BreederDetailsDialog({
  open,
  onOpenChange,
  eventInventoryId,
  event,
}: BreederDetailsDialogProps) {
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [editingBird, setEditingBird] = useState<EventInventoryItem | null>(null);
  const [view, setView] = useState<"list" | "edit" | "create">("list");
  const [birdDetailId, setBirdDetailId] = useState<number | null>(null);
  const [editingPayment, setEditingPayment] = useState<any>(null);
  const [addPartnerBreederId, setAddPartnerBreederId] = useState<string>("");

  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CREDIT_CARD" | "PAYPAL" | "BANK_TRANSFER" | "CASH">("CASH");
  const [paymentType, setPaymentType] = useState<"PERCH_FEE" | "BIRD_FEE" | "RACES_FEE" | "PAYOUTS" | "OTHER">("OTHER");
  const [paymentDescription, setPaymentDescription] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");

  const { data, isPending, error, refetch } = useGetEventInventory(eventInventoryId ? String(eventInventoryId) : "");
  const { data: breedersData } = useListBreeders();
  const breederId = (data as any)?.eventInventory?.breederId;
  const { data: allBirdsData } = useAdminListBirds(
    breederId ? { breederId: String(breederId) } : {}
  );
  const createPaymentMutation = useCreatePayment({
    onSuccess: () => {
      toast.success("Payment added successfully");
      resetPaymentForm();
      setIsAddPaymentOpen(false);
      refetch();
    },
  });
  const updatePaymentMutation = useUpdatePayment({
    onSuccess: () => {
      toast.success("Payment updated successfully");
      resetPaymentForm();
      setEditingPayment(null);
      setIsAddPaymentOpen(false);
      refetch();
    },
  });
  const deletePaymentMutation = useDeletePayment({
    onSuccess: () => {
      toast.success("Payment deleted successfully");
      refetch();
    },
  });
  const addPartnerMutation = useAddPartner(eventInventoryId ?? 0, {
    onSuccess: () => {
      toast.success("Partner added");
      setAddPartnerBreederId("");
      refetch();
    },
  });
  const deletePartnerMutation = useDeletePartner(eventInventoryId ?? 0, {
    onSuccess: () => {
      toast.success("Partner removed");
      refetch();
    },
  });

  const eventInventory: EventInventory = data?.eventInventory;

  const resetPaymentForm = () => {
    setPaymentAmount("");
    setPaymentMethod("CASH");
    setPaymentType("OTHER");
    setPaymentDescription("");
    setReferenceNumber("");
    setEditingPayment(null);
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventInventory) return;
    const amount = parseFloat(paymentAmount);
    const isValid = (paymentType === "PAYOUTS" || paymentType === "OTHER") ? !isNaN(amount) && amount !== 0 : !isNaN(amount) && amount > 0;
    if (!isValid) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (editingPayment) {
      if (!updatePaymentMutation.mutateAsync) return;
      await updatePaymentMutation.mutateAsync({
        paymentId: editingPayment.id,
        amountPaid: amount,
        amountToPay: amount,
        currency: "USD",
        method: paymentMethod,
        paymentType: paymentType,
        description: paymentDescription || undefined,
        referenceNumber: referenceNumber || undefined,
      });
    } else {
      if (!createPaymentMutation.mutateAsync) return;
      await createPaymentMutation.mutateAsync({
        eventInventoryId: eventInventory.id,
        breederId: eventInventory.breederId,
        amountPaid: amount,
        amountToPay: amount,
        currency: "USD",
        method: paymentMethod,
        paymentType: paymentType,
        description: paymentDescription || undefined,
        referenceNumber: referenceNumber || undefined,
      });
    }
  };

  const REVERSE_METHOD: Record<number, typeof paymentMethod> = { 0: "CASH", 1: "CREDIT_CARD", 2: "PAYPAL", 3: "BANK_TRANSFER" };
  const REVERSE_TYPE: Record<number, typeof paymentType> = { 0: "PERCH_FEE", 1: "BIRD_FEE", 2: "RACES_FEE", 3: "PAYOUTS", 4: "OTHER" };

  const handleEditPayment = (payment: any) => {
    setEditingPayment(payment);
    setPaymentAmount((payment.paymentValue ?? 0).toString());
    setPaymentMethod(REVERSE_METHOD[payment.paymentMethod] ?? "CASH");
    setPaymentType(REVERSE_TYPE[payment.paymentType] ?? "OTHER");
    setPaymentDescription(payment.paymentDesc || "");
    setReferenceNumber(payment.transactionId || "");
    setIsAddPaymentOpen(true);
  };

  const handleDeletePayment = async (paymentId: number) => {
    if (!confirm("Delete this payment?")) return;
    if (!deletePaymentMutation.mutateAsync) return;
    await deletePaymentMutation.mutateAsync({ paymentId });
  };

  const handleCashReceived = async (pendingBalance: number) => {
    if (!eventInventory || pendingBalance <= 0) return;
    if (!createPaymentMutation.mutateAsync) return;
    await createPaymentMutation.mutateAsync({
      eventInventoryId: eventInventory.id,
      breederId: eventInventory.breederId,
      amountPaid: pendingBalance,
      amountToPay: pendingBalance,
      currency: "USD",
      method: "CASH",
      paymentType: "OTHER",
      description: "Cash payment received",
    });
  };

  const handleBirdClick = (bird: EventInventoryItem) => {
    setBirdDetailId(bird.birdId ?? bird.bird?.id ?? null);
  };

  const handleCreateBird = () => {
    setEditingBird(null);
    setView("create");
  };

  const handleBirdEditSuccess = () => {
    setEditingBird(null);
    setView("list");
    refetch();
  };

  const handleAddPartner = async () => {
    if (!addPartnerBreederId) return;
    if (!addPartnerMutation.mutateAsync) return;
    await addPartnerMutation.mutateAsync({ breederId: parseInt(addPartnerBreederId) });
  };

  const handleDeletePartner = async (breederId: number) => {
    if (!confirm("Remove this partner?")) return;
    if (!deletePartnerMutation.mutateAsync) return;
    await deletePartnerMutation.mutateAsync({ breederId });
  };

  if (!eventInventoryId) return null;

  if (isPending) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-7xl h-screen overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Breeder Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Breeder info + Partners */}
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-3 border border-border rounded-lg p-4 space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="h-4 w-28 shrink-0" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                ))}
              </div>
              <div className="col-span-1 border border-border rounded-lg p-4 space-y-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            </div>

            {/* Payments table + Fee summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <Skeleton className="h-7 w-32" />
                <div className="border rounded-lg divide-y">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full rounded-none" />
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-72 w-full rounded-lg" />
              </div>
            </div>

            {/* Birds table */}
            <div className="space-y-4">
              <Skeleton className="h-7 w-40" />
              <div className="border rounded-lg divide-y">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-none" />
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error || !eventInventory) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>Breeder Details</DialogTitle>
          </DialogHeader>
          <div className="text-center py-12 text-red-500">
            <p>Error loading breeder details</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const items: EventInventoryItem[] = eventInventory?.items ?? [];
  const payments = eventInventory?.payments ?? [];
  const partners = eventInventory?.partners ?? [];
  const allBreeders = breedersData?.breeders ?? [];

  // Registered bird IDs for badge lookup
  const registeredBirdIds = new Set(items.map((i) => i.birdId ?? i.bird?.id).filter(Boolean));
  const itemByBirdId = new Map(items.map((i) => [i.birdId ?? i.bird?.id, i]));

  // All breeder birds — registered ones get event item data, unregistered show blanks
  const allBirds: Array<{ bird: any; item: EventInventoryItem | null }> = [];
  const allBreederBirds: any[] = (allBirdsData as any)?.birds ?? [];
  // Add all breeder birds
  for (const b of allBreederBirds) {
    allBirds.push({ bird: b, item: itemByBirdId.get(b.id) ?? null });
  }
  // Add any registered birds not in allBreederBirds (edge case)
  for (const item of items) {
    const bId = item.birdId ?? item.bird?.id;
    if (bId && !allBreederBirds.find((b: any) => b.id === bId)) {
      allBirds.push({ bird: item.bird, item });
    }
  }
  // Sort: registered first, then by band
  allBirds.sort((a, b) => {
    if (!!a.item !== !!b.item) return a.item ? -1 : 1;
    return (a.bird?.band ?? "").localeCompare(b.bird?.band ?? "");
  });

  // Fee totals
  const totalPerchFee = items.reduce((s, i) => s + (i.entryFeeValue ?? 0), 0);
  const totalBirdFee = items.reduce((s, i) => s + (i.perchFeeValue ?? 0), 0);
  const totalHotSpotFee = items.reduce((s, i) => s + (i.hotSpotFeeValue ?? 0), 0);
  const totalRaceFee = items.reduce((s, i) => s + (i.raceFeeValue ?? 0), 0);
  const totalClassesFee = payments
    .filter((p) => p.paymentDesc?.toLowerCase().includes("bet stake"))
    .reduce((s, p) => s + (p.paymentValue ?? 0), 0);
  const totalFees = totalPerchFee + totalBirdFee + totalHotSpotFee + totalRaceFee + totalClassesFee;

  // Refunds
  const totalEntryRefund = items.reduce((s, i) => s + (i.entryRefund ?? 0), 0);
  const totalHotSpotRefund = items.reduce((s, i) => s + (i.hotSpotRefund ?? 0), 0);
  const totalRefunds = totalEntryRefund + totalHotSpotRefund;

  // Payments — refunds (type=3) are money OUT to breeder
  const winnerPayouts = payments
    .filter((p) => p.paymentType === 3)
    .reduce((s, p) => s + Math.abs(p.paymentValue ?? 0), 0);
  const totalPaid = payments
    .filter((p) => p.paymentType !== 3)
    .reduce((s, p) => s + (p.paymentValue ?? 0), 0);
  const transferDue = items.reduce((s, i) => s + (i.transferDue ?? 0), 0);
  // balance: what's owed minus what's been received, plus what's been paid back out
  const balance = (totalFees - totalRefunds) - totalPaid + winnerPayouts;

  // Filter breeders already added as partners
  const partnerBreederIds = new Set([
    ...(partners.map((p) => p.breederId)),
    eventInventory.breederId,
  ]);
  const availableBreeders = allBreeders.filter((b: any) => !partnerBreederIds.has(b.id));

  return (
    <>
    <BirdDetailDialog
      open={birdDetailId !== null}
      onOpenChange={(o) => { if (!o) setBirdDetailId(null); }}
      birdId={birdDetailId}
      eventId={event.id}
    />
    <Dialog open={open} onOpenChange={(o) => { if (!o) setView("list"); onOpenChange(o); }}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {view !== "list" && (
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => { setView("list"); setEditingBird(null); }}>
                  <ArrowLeft className="h-4 w-4 mr-1" />Back
                </Button>
              )}
              <DialogTitle>
                {view === "edit" ? "Edit Bird" : view === "create" ? "Add Bird" : "Breeder Details"}
              </DialogTitle>
            </div>
            {view === "list" && eventInventoryId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/api/admin/event/${event.id}/event-inventory/${eventInventoryId}/receipt`)}
              >
                <Download className="h-4 w-4 mr-1" />
                Receipt
              </Button>
            )}
          </div>
        </DialogHeader>

        {view === "edit" && editingBird && (
          <EditBirdDialog
            open={false}
            onOpenChange={() => {}}
            eventInventoryItem={editingBird}
            event={event}
            eventId={event.id}
            onSuccess={handleBirdEditSuccess}
            inline
          />
        )}

        {view === "create" && (
          <CreateBirdDialog
            open={false}
            onOpenChange={() => {}}
            eventInventoryId={eventInventoryId!}
            breederId={eventInventory.breederId ?? 0}
            event={event}
            onSuccess={handleBirdEditSuccess}
            inline
          />
        )}

        {view === "list" && <div className="space-y-6">
            {/* Breeder + Partners row */}
            <div className="grid grid-cols-4 gap-4">
              {/* Breeder Info — 3/4 */}
              <div className="col-span-3 border border-border rounded-lg p-4 space-y-2">
                {[
                  ["Name", `${eventInventory?.breeder?.firstName ?? ""} ${eventInventory?.breeder?.lastName ?? ""}`.trim() || "-"],
                  ["Loft", eventInventory.loft || "-"],
                  ["Sign-in Date", fmtDate(eventInventory.signInDate)],
                  ["Reserved Birds", String(items.length)],
                  ["Email", eventInventory?.breeder?.email || "-"],
                  ["Phone", eventInventory?.breeder?.phone || "-"],
                  ["Country", eventInventory?.breeder?.country || "-"],
                  ["State", eventInventory?.breeder?.state1 || "-"],
                  ...(eventInventory.note ? [["Note", eventInventory.note]] : []),
                ].map(([label, value]) => (
                  <div key={label} className="flex items-baseline gap-2">
                    <span className="text-sm text-muted-foreground w-28 shrink-0">{label}</span>
                    <span className="text-sm font-medium">{value}</span>
                  </div>
                ))}
              </div>

              {/* Partners — 1/4 */}
              <div className="col-span-1 border border-border rounded-lg p-4 flex flex-col gap-2">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Partners</h3>
                <div className="flex-1 space-y-1 min-h-0">
                  {partners.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No partners</p>
                  ) : (
                    partners.map((p) => (
                      <div key={p.breederId} className="flex items-center justify-between gap-1">
                        <span className="text-sm truncate">
                          {p.breeder?.firstName} {p.breeder?.lastName || ""}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 shrink-0"
                          onClick={() => handleDeletePartner(p.breederId)}
                          disabled={deletePartnerMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
                <div className="pt-2 border-t space-y-2">
                  <Select value={addPartnerBreederId} onValueChange={setAddPartnerBreederId}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select breeder..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableBreeders.map((b: any) => (
                        <SelectItem key={b.id} value={String(b.id)}>
                          {b.firstName} {b.lastName || ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="w-full h-8 text-xs"
                    onClick={handleAddPartner}
                    disabled={!addPartnerBreederId || addPartnerMutation.isPending}
                  >
                    <UserPlus className="h-3 w-3 mr-1" />
                    Add Partner
                  </Button>
                </div>
              </div>
            </div>

            {/* Payments and Fee Summary Side by Side */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Payments Table */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">Payments</h3>
                  <div className="flex items-center gap-2">
                    {eventInventory?.breederId != null && (
                      <ExportButton
                        kind="payments"
                        eventId={event.id}
                        breederId={eventInventory.breederId}
                        label="Export"
                      />
                    )}
                    {balance > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCashReceived(balance)}
                        disabled={createPaymentMutation.isPending}
                      >
                        Cash Received ({fmtMoney(balance)})
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => {
                        resetPaymentForm();
                        setIsAddPaymentOpen(!isAddPaymentOpen);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Payment
                    </Button>
                  </div>
                </div>

                {isAddPaymentOpen && (
                  <form onSubmit={handleAddPayment} className="border rounded-lg p-4 space-y-3 bg-transparent border-border">
                    <h4 className="font-medium">{editingPayment ? "Edit Payment" : "Add Payment"}</h4>
                    <div className="grid grid-cols-4 gap-3">
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="paymentAmount">Amount</Label>
                        <Input
                          id="paymentAmount"
                          type="number"
                          step="0.01"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="paymentMethod">Method</Label>
                        <Select value={paymentMethod} onValueChange={(value: any) => setPaymentMethod(value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CASH">Cash</SelectItem>
                            <SelectItem value="CREDIT_CARD">Credit Card</SelectItem>
                            <SelectItem value="PAYPAL">PayPal</SelectItem>
                            <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="paymentType">Type</Label>
                        <Select value={paymentType} onValueChange={(value: any) => setPaymentType(value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PERCH_FEE">Perch Fee</SelectItem>
                            <SelectItem value="BIRD_FEE">Per Bird Fee</SelectItem>
                            <SelectItem value="RACES_FEE">Races Fee</SelectItem>
                            <SelectItem value="PAYOUTS">Refund</SelectItem>
                            <SelectItem value="OTHER">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="referenceNumber">Reference #</Label>
                        <Input
                          id="referenceNumber"
                          value={referenceNumber}
                          onChange={(e) => setReferenceNumber(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="paymentDescription">Description</Label>
                      <Input
                        id="paymentDescription"
                        value={paymentDescription}
                        onChange={(e) => setPaymentDescription(e.target.value)}
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsAddPaymentOpen(false);
                          resetPaymentForm();
                        }}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createPaymentMutation.isPending || updatePaymentMutation.isPending}>
                        {editingPayment
                          ? (updatePaymentMutation.isPending ? "Updating..." : "Update")
                          : (createPaymentMutation.isPending ? "Adding..." : "Add")}
                      </Button>
                    </div>
                  </form>
                )}

                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-primary">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium">Date</th>
                        <th className="px-4 py-2 text-left text-sm font-medium">Type</th>
                        <th className="px-4 py-2 text-left text-sm font-medium">Method</th>
                        <th className="px-4 py-2 text-left text-sm font-medium">Description</th>
                        <th className="px-4 py-2 text-right text-sm font-medium">Amount</th>
                        <th className="px-4 py-2 text-center text-sm font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {payments.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                            No payments found
                          </td>
                        </tr>
                      ) : (
                        payments.map((payment) => (
                          <tr key={payment.id}>
                            <td className="px-4 py-2 text-sm">{fmtDate(payment.paymentDate)}</td>
                            <td className="px-4 py-2 text-sm">
                              {payment.paymentType != null ? TYPE_LABELS[payment.paymentType] ?? payment.paymentType : "-"}
                            </td>
                            <td className="px-4 py-2 text-sm">
                              {payment.paymentMethod != null ? METHOD_LABELS[payment.paymentMethod] ?? payment.paymentMethod : "-"}
                            </td>
                            <td className="px-4 py-2 text-sm text-muted-foreground">
                              {payment.paymentDesc || "-"}
                            </td>
                            <td className="px-4 py-2 text-sm text-right">
                              {fmtMoney(payment.paymentValue ?? 0)}
                            </td>
                            <td className="px-4 py-2 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEditPayment(payment)}
                                  disabled={deletePaymentMutation.isPending || updatePaymentMutation.isPending}
                                >
                                  <Edit className="h-4 w-4 text-blue-500" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeletePayment(payment.id)}
                                  disabled={deletePaymentMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Fee Summary */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Fee Summary</h3>
                <div className="border rounded-lg p-4 space-y-1 bg-transparent border-border text-sm">
                  <p className="font-medium text-muted-foreground uppercase text-xs tracking-wide mb-2">Fees</p>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Perch Fee</span>
                    <span>{fmtMoney(totalPerchFee)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Per Bird Fee</span>
                    <span>{fmtMoney(totalBirdFee)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Race Fee</span>
                    <span>{fmtMoney(totalRaceFee)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Hot Spot Fee</span>
                    <span>{fmtMoney(totalHotSpotFee)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Classes</span>
                    <span>{fmtMoney(totalClassesFee)}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                    <span>Total</span>
                    <span>{fmtMoney(totalFees)}</span>
                  </div>

                  <p className="font-medium text-muted-foreground uppercase text-xs tracking-wide mb-2 mt-4">Refunds</p>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Entry Refund</span>
                    <span>{fmtMoney(totalEntryRefund)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Hot Spot Refund</span>
                    <span>{fmtMoney(totalHotSpotRefund)}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                    <span>Total</span>
                    <span>{fmtMoney(totalRefunds)}</span>
                  </div>

                  <div className="border-t pt-2 mt-2 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Payments</span>
                      <span>{fmtMoney(totalPaid)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Refunds Paid Out</span>
                      <span>{fmtMoney(winnerPayouts)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Transfer Due</span>
                      <span>{fmtMoney(transferDue)}</span>
                    </div>
                  </div>

                  <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
                    <span>Balance</span>
                    <span className={balance === 0 ? "text-green-600" : balance > 0 ? "text-red-600" : "text-yellow-600"}>
                      {fmtMoney(balance)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Birds Table */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">
                  Birds ({allBirds.length})
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {items.length} registered
                  </span>
                </h3>
                <Button size="sm" onClick={handleCreateBird}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Bird
                </Button>
              </div>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-primary">
                    <tr>
                      <th className="px-3 py-2 text-left text-sm font-medium">Status</th>
                      <th className="px-3 py-2 text-left text-sm font-medium">#</th>
                      <th className="px-3 py-2 text-left text-sm font-medium">Band</th>
                      <th className="px-3 py-2 text-left text-sm font-medium">Name</th>
                      <th className="px-3 py-2 text-left text-sm font-medium">Color</th>
                      <th className="px-3 py-2 text-left text-sm font-medium">Sex</th>
                      <th className="px-3 py-2 text-center text-sm font-medium">Active</th>
                      <th className="px-3 py-2 text-center text-sm font-medium">Lost</th>
                      <th className="px-3 py-2 text-right text-sm font-medium">Perch Fee</th>
                      <th className="px-3 py-2 text-right text-sm font-medium">Bird Fee</th>
                      <th className="px-3 py-2 text-right text-sm font-medium">Race Fee</th>
                      <th className="px-3 py-2 text-right text-sm font-medium">Hotspot Fee</th>
                      <th className="px-3 py-2 text-left text-sm font-medium">Arrival</th>
                      <th className="px-3 py-2 text-left text-sm font-medium">Departure</th>
                      <th className="px-3 py-2 text-center text-sm font-medium">Backup</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {allBirds.length === 0 ? (
                      <tr>
                        <td colSpan={15} className="px-4 py-8 text-center text-muted-foreground">
                          No birds found
                        </td>
                      </tr>
                    ) : (
                      allBirds.map(({ bird, item }, idx) => (
                        <tr
                          key={item?.id ?? `unregistered-${bird?.id ?? idx}`}
                          className={`cursor-pointer ${item ? "hover:bg-primary/10" : "hover:bg-muted/50 opacity-70"}`}
                          onClick={() => item ? handleBirdClick(item) : setBirdDetailId(bird?.id ?? null)}
                        >
                          <td className="px-3 py-2">
                            {item
                              ? <Badge className="bg-green-600 text-white text-xs">Registered</Badge>
                              : <Badge variant="outline" className="text-xs text-muted-foreground">Not registered</Badge>
                            }
                          </td>
                          <td className="px-3 py-2 text-sm">{item?.birdNo || "-"}</td>
                          <td className="px-3 py-2 text-sm font-mono">{bird?.band || "-"}</td>
                          <td className="px-3 py-2 text-sm">{bird?.birdName || "-"}</td>
                          <td className="px-3 py-2 text-sm">{bird?.color || "-"}</td>
                          <td className="px-3 py-2 text-sm">{bird?.sex != null ? (bird.sex === 0 ? "M" : "F") : "-"}</td>
                          <td className="px-3 py-2 text-sm text-center">{bird?.isActive ? "✓" : "✗"}</td>
                          <td className="px-3 py-2 text-sm text-center">{bird?.isLost ? "✓" : "-"}</td>
                          <td className="px-3 py-2 text-sm text-right">{item ? fmtMoney(item.entryFeeValue ?? 0) : "-"}</td>
                          <td className="px-3 py-2 text-sm text-right">{item ? fmtMoney(item.perchFeeValue ?? 0) : "-"}</td>
                          <td className="px-3 py-2 text-sm text-right">{item ? fmtMoney(item.raceFeeValue ?? 0) : "-"}</td>
                          <td className="px-3 py-2 text-sm text-right">{item ? fmtMoney(item.hotSpotFeeValue ?? 0) : "-"}</td>
                          <td className="px-3 py-2 text-sm">{item ? fmtDate(item.arrivalDate) : "-"}</td>
                          <td className="px-3 py-2 text-sm">{item ? fmtDate(item.departureDate) : "-"}</td>
                          <td className="px-3 py-2 text-center text-sm">{item?.isBackup ? "✓" : "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>}
        </DialogContent>
      </Dialog>
    </>
  );
}
