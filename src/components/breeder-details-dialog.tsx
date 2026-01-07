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
import { Plus, Trash2, Edit } from "lucide-react";
import type { Event, EventInventory, EventInventoryItem } from "@/lib/types";
import { EditBirdDialog } from "./edit-bird-dialog";
import { CreateBirdDialog } from "./create-bird-dialog";

interface BreederDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventInventoryId: string | null;
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
  const [paymentType, setPaymentType] = useState<"ENTRY_FEE" | "PERCH_FEE" | "RACES_FEE" | "PAYOUTS" | "OTHER">("OTHER");
  const [paymentDescription, setPaymentDescription] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");

  // All hooks must be called before any conditional returns
  const { data, isPending, error,refetch } = useGetEventInventory(eventInventoryId || "");
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
        paymentId: editingPayment.paymentId,
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
          eventInventoryId: eventInventory.eventInventoryId,
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

  const handleEditPayment = (payment: any) => {
    setEditingPayment(payment);
    setPaymentAmount(payment.amountPaid.toString());
    setPaymentMethod(payment.method);
    setPaymentType(payment.paymentType);
    setPaymentDescription(payment.description || "");
    setReferenceNumber(payment.referenceNumber || "");
    setIsAddPaymentOpen(true);
  };

  const handleDeletePayment = async (paymentId: string) => {
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

  const totalAmountToPay = eventInventory?.payments?.reduce((sum, p) => sum + p.amountToPay, 0) ?? 0;
  const totalAmountPaid = eventInventory?.payments?.reduce((sum, p) => sum + p.amountPaid, 0) ?? 0;
  const amountLeft = totalAmountToPay - totalAmountPaid;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Breeder Details</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Breeder Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-500">Breeder Name</p>
                <p className="font-semibold">
                  {eventInventory?.breeder?.name} {eventInventory?.breeder?.lastName || ""}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Loft Name</p>
                <p className="font-semibold">{eventInventory.loft}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Reserved Birds</p>
                <p className="font-semibold">{eventInventory.reservedBirds}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Registration Date</p>
                <p className="font-semibold">
                  {new Date(eventInventory.registrationDate).toLocaleDateString()}
                </p>
              </div>
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
                  <form onSubmit={handleAddPayment} className="border rounded-lg p-4 space-y-3 bg-gray-50">
                    <h4 className="font-medium">{editingPayment ? "Edit Payment" : "Add Payment"}</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
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
                            <SelectItem value="ENTRY_FEE">Entry Fee</SelectItem>
                            <SelectItem value="PERCH_FEE">Perch Fee</SelectItem>
                            <SelectItem value="RACES_FEE">Races Fee</SelectItem>
                            <SelectItem value="PAYOUTS">Payouts</SelectItem>
                            <SelectItem value="OTHER">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="referenceNumber">Reference #</Label>
                        <Input
                          id="referenceNumber"
                          value={referenceNumber}
                          onChange={(e) => setReferenceNumber(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
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
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium">Date</th>
                        <th className="px-4 py-2 text-left text-sm font-medium">Type</th>
                        <th className="px-4 py-2 text-left text-sm font-medium">Method</th>
                        <th className="px-4 py-2 text-right text-sm font-medium">Amount To Pay</th>
                        <th className="px-4 py-2 text-right text-sm font-medium">Amount Paid</th>
                        <th className="px-4 py-2 text-center text-sm font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {eventInventory?.payments?.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                            No payments found
                          </td>
                        </tr>
                      ) : (
                        eventInventory?.payments?.map((payment) => (
                          <tr key={payment.paymentId}>
                            <td className="px-4 py-2 text-sm">
                              {new Date(payment.paidAt).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-2 text-sm">
                              {payment.paymentType.replace(/_/g, " ")}
                            </td>
                            <td className="px-4 py-2 text-sm">
                              {payment.method.replace(/_/g, " ")}
                            </td>
                            <td className="px-4 py-2 text-sm text-right">
                              ${payment.amountToPay.toFixed(2)}
                            </td>
                            <td className="px-4 py-2 text-sm text-right">
                              ${payment.amountPaid.toFixed(2)}
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
                                  onClick={() => handleDeletePayment(payment.paymentId)}
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
                <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total To Pay:</span>
                    <span className="font-semibold">${totalAmountToPay.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total Paid:</span>
                    <span className="font-semibold text-green-600">${totalAmountPaid.toFixed(2)}</span>
                  </div>
                  <div className="border-t pt-3 flex justify-between">
                    <span className="font-semibold">Amount Left:</span>
                    <span className={`font-bold ${amountLeft > 0 ? "text-red-600" : "text-green-600"}`}>
                      ${amountLeft.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Birds Table */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">Birds ({eventInventory?.eventInventoryItems?.length || 0})</h3>
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
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium">Bird #</th>
                      <th className="px-4 py-2 text-left text-sm font-medium">Band</th>
                      <th className="px-4 py-2 text-left text-sm font-medium">Name</th>
                      <th className="px-4 py-2 text-left text-sm font-medium">Color</th>
                      <th className="px-4 py-2 text-left text-sm font-medium">Sex</th>
                      <th className="px-4 py-2 text-center text-sm font-medium">Backup</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {eventInventory?.eventInventoryItems?.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                          No birds found
                        </td>
                      </tr>
                    ) : (
                      eventInventory?.eventInventoryItems?.map((item) => (
                        <tr
                          key={item.eventInventoryItemId}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => handleBirdClick(item)}
                        >
                          <td className="px-4 py-2 text-sm">{item.birdNo || "-"}</td>
                          <td className="px-4 py-2 text-sm">{item?.bird?.band}</td>
                          <td className="px-4 py-2 text-sm">{item?.bird?.birdName}</td>
                          <td className="px-4 py-2 text-sm">{item?.bird?.color}</td>
                          <td className="px-4 py-2 text-sm">{item?.bird?.sex}</td>
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
        eventId={event.eventId}
        onSuccess={handleBirdEditSuccess}
      />

      {/* Create Bird Dialog */}
      <CreateBirdDialog
        open={isBirdDialogOpen && isCreateBirdMode}
        onOpenChange={setIsBirdDialogOpen}
        eventInventoryId={eventInventoryId!}
        breederId={eventInventory.breederId}
        event={event}
        onSuccess={() => {
          handleBirdEditSuccess();
          refetch();
        }}
      />
    </>
  );
}
