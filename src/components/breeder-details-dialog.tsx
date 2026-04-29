"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useGetEventInventory, useCreatePayment, useUpdatePayment, useDeletePayment } from "@/lib/api/payments";
import { Download, Plus, Trash2, Edit } from "lucide-react";
import type { Event, EventInventory, EventInventoryItem } from "@/lib/types";
import { EditBirdDialog } from "./edit-bird-dialog";
import { CreateBirdDialog } from "./create-bird-dialog";

const METHOD_LABELS: Record<number, string> = { 0: "Cash", 1: "Credit Card", 2: "PayPal", 3: "Bank Transfer" };
const TYPE_LABELS: Record<number, string> = { 0: "Perch Fee", 1: "Per Bird Fee", 2: "Races Fee", 3: "Payouts", 4: "Other" };

interface BreederDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventInventoryId: number | null;
  event: Event;
}

export function BreederDetailsDialog({
  open,
  onOpenChange,
  eventInventoryId,
  event,
}: BreederDetailsDialogProps) {
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [editingBird, setEditingBird] = useState<EventInventoryItem | null>(null);
  const [isBirdDialogOpen, setIsBirdDialogOpen] = useState(false);
  const [isCreateBirdMode, setIsCreateBirdMode] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any>(null);

  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CREDIT_CARD" | "PAYPAL" | "BANK_TRANSFER" | "CASH">("CASH");
  const [paymentType, setPaymentType] = useState<"PERCH_FEE" | "BIRD_FEE" | "RACES_FEE" | "PAYOUTS" | "OTHER">("OTHER");
  const [paymentDescription, setPaymentDescription] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");

  // All hooks must be called before any conditional returns
  const { data, isPending, error,refetch } = useGetEventInventory(eventInventoryId ? String(eventInventoryId) : "");
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

  const eventInventory:EventInventory = data?.eventInventory;

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
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (editingPayment) {
      // Update existing payment
      if(!updatePaymentMutation.mutateAsync) return;
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
      // Create new payment
      if(!createPaymentMutation.mutateAsync) return;
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
    if (!confirm("Are you sure you want to delete this payment?")) return;
    if(!deletePaymentMutation.mutateAsync) return;
    await deletePaymentMutation.mutateAsync({ paymentId });
  };

  const handleBirdClick = (bird: EventInventoryItem) => {
    setEditingBird(bird);
    setIsCreateBirdMode(false);
    setIsBirdDialogOpen(true);
  };

  const handleCreateBird = () => {
    setEditingBird(null);
    setIsCreateBirdMode(true);
    setIsBirdDialogOpen(true);
  };

  const handleBirdEditSuccess = () => {
    setEditingBird(null);
    setIsCreateBirdMode(false);
  };

  // Conditional rendering after all hooks have been called
  if (!eventInventoryId) return null;

  if (isPending) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Breeder Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
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

  const totalPaid = eventInventory?.payments?.reduce((sum, p) => sum + (p.paymentValue ?? 0), 0) ?? 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Breeder Details</DialogTitle>
              {eventInventoryId && (
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

          <div className="space-y-6">
            {/* Breeder Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-transparent border-border border rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Breeder Name</p>
                <p className="font-semibold">
                  {eventInventory?.breeder?.firstName} {eventInventory?.breeder?.lastName || ""}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-semibold">{eventInventory?.breeder?.email || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-semibold">{eventInventory?.breeder?.phone || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Country</p>
                <p className="font-semibold">{eventInventory?.breeder?.country || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">State</p>
                <p className="font-semibold">{eventInventory?.breeder?.state1 || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Loft Name</p>
                <p className="font-semibold">{eventInventory.loft || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Reserved Birds</p>
                <p className="font-semibold">{eventInventory.reservedBirds}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sign In Date</p>
                <p className="font-semibold">
                  {eventInventory.signInDate ? new Date(eventInventory.signInDate).toLocaleDateString() : "-"}
                </p>
              </div>
              {eventInventory.note && (
                <div className="col-span-2 md:col-span-4">
                  <p className="text-sm text-muted-foreground">Note</p>
                  <p className="font-semibold">{eventInventory.note}</p>
                </div>
              )}
            </div>

            {/* Payments and Summary Side by Side */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Payments Table */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">Payments</h3>
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

                {/* Add/Edit Payment Form */}
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
                            <SelectItem value="PAYOUTS">Payouts</SelectItem>
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

                {/* Payments List */}
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-primary">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium">Date</th>
                        <th className="px-4 py-2 text-left text-sm font-medium">Type</th>
                        <th className="px-4 py-2 text-left text-sm font-medium">Method</th>
                        <th className="px-4 py-2 text-right text-sm font-medium">Amount</th>
                        <th className="px-4 py-2 text-center text-sm font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {eventInventory?.payments?.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                            No payments found
                          </td>
                        </tr>
                      ) : (
                        eventInventory?.payments?.map((payment) => (
                          <tr key={payment.id}>
                            <td className="px-4 py-2 text-sm">
                              {payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString() : "-"}
                            </td>
                            <td className="px-4 py-2 text-sm">
                              {payment.paymentType != null ? TYPE_LABELS[payment.paymentType] ?? payment.paymentType : "-"}
                            </td>
                            <td className="px-4 py-2 text-sm">
                              {payment.paymentMethod != null ? METHOD_LABELS[payment.paymentMethod] ?? payment.paymentMethod : "-"}
                            </td>
                            <td className="px-4 py-2 text-sm text-right">
                              ${(payment.paymentValue ?? 0).toFixed(2)}
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

              {/* Payment Summary */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Payment Summary</h3>
                <div className="border rounded-lg p-4 space-y-3 bg-transparent border-border">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Paid:</span>
                    <span className="font-semibold text-green-600">${totalPaid.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Birds Table */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">Birds ({eventInventory?.items?.length || 0})</h3>
                <Button
                  size="sm"
                  onClick={handleCreateBird}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Bird
                </Button>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-primary">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium">Bird #</th>
                      <th className="px-4 py-2 text-left text-sm font-medium">Band</th>
                      <th className="px-4 py-2 text-left text-sm font-medium">Name</th>
                      <th className="px-4 py-2 text-left text-sm font-medium">Color</th>
                      <th className="px-4 py-2 text-left text-sm font-medium">Sex</th>
                      <th className="px-4 py-2 text-right text-sm font-medium">Entry Fee</th>
                      <th className="px-4 py-2 text-right text-sm font-medium">Per Bird Fee</th>
                      <th className="px-4 py-2 text-right text-sm font-medium">Race Fee</th>
                      <th className="px-4 py-2 text-right text-sm font-medium">Hotspot Fee</th>
                      <th className="px-4 py-2 text-center text-sm font-medium">Backup</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {eventInventory?.items?.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                          No birds found
                        </td>
                      </tr>
                    ) : (
                      eventInventory?.items?.map((item) => (
                        <tr
                          key={item.id}
                          className="hover:bg-primary/10 cursor-pointer"
                          onClick={() => handleBirdClick(item)}
                        >
                          <td className="px-4 py-2 text-sm">{item?.birdNo || "-"}</td>
                          <td className="px-4 py-2 text-sm">{item?.bird?.band}</td>
                          <td className="px-4 py-2 text-sm">{item?.bird?.birdName}</td>
                          <td className="px-4 py-2 text-sm">{item?.bird?.color}</td>
                          <td className="px-4 py-2 text-sm">{item?.bird?.sex}</td>
                          <td className="px-4 py-2 text-sm text-right">${(item.entryFeeValue ?? 0).toFixed(2)}</td>
                          <td className="px-4 py-2 text-sm text-right">${(item.perchFeeValue ?? 0).toFixed(2)}</td>
                          <td className="px-4 py-2 text-sm text-right">${(item.raceFeeValue ?? 0).toFixed(2)}</td>
                          <td className="px-4 py-2 text-sm text-right">${(item.hotSpotFeeValue ?? 0).toFixed(2)}</td>
                          <td className="px-4 py-2 text-center text-sm">
                            {item.isBackup ? "✓" : "-"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Bird Dialog */}
      <EditBirdDialog
        open={isBirdDialogOpen && !isCreateBirdMode}
        onOpenChange={setIsBirdDialogOpen}
        eventInventoryItem={editingBird}
        event={event}
        eventId={event.id}
        onSuccess={handleBirdEditSuccess}
      />

      {/* Create Bird Dialog */}
      <CreateBirdDialog
        open={isBirdDialogOpen && isCreateBirdMode}
        onOpenChange={setIsBirdDialogOpen}
        eventInventoryId={eventInventoryId!}
        breederId={eventInventory.breederId ?? 0}
        event={event}
        onSuccess={() => {
          handleBirdEditSuccess();
          refetch();
        }}
      />
    </>
  );
}
