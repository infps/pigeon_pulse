"use client";

import type { Event } from "@/lib/types";
import { useState, useEffect } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, X } from "lucide-react";
import { useListTeams, useCreateTeam } from "@/lib/api/teams";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { apiEndpoints } from "@/lib/endpoints";
import { useApiQuery } from "@/hooks/useApi";
import Link from "next/link";

interface EventRegisterTabProps {
  event: Event;
  eventId: string;
}

interface SelectedBird {
  id: number;
  band: string;
  birdName: string;
  color: string;
  sex: number;
}

interface PaymentData {
  amountPaid: number;
  amountToPay: number;
  method: "CREDIT_CARD" | "PAYPAL" | "BANK_TRANSFER" | "CASH";
  paymentType: "ENTRY_FEE" | "PERCH_FEE";
}

const SEX_LABELS: Record<number, string> = { 0: "Unknown", 1: "Cock", 2: "Hen" };

export function EventRegisterTab({ event, eventId }: EventRegisterTabProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: session, isPending: isSessionPending } = authClient.useSession();

  const [selectedLoft, setSelectedLoft] = useState("");
  const [reservedBirds, setReservedBirds] = useState<number>(0);
  const [selectedBirds, setSelectedBirds] = useState<SelectedBird[]>([]);
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [isAddTeamOpen, setIsAddTeamOpen] = useState(false);
  const [teamName, setTeamName] = useState("");

  const { data: teamsData } = useListTeams({
    endpoint: apiEndpoints.breeder.teams,
    enabled: !!session?.user,
  });
  const teams = teamsData?.teams || [];

  const { data: birdsData } = useApiQuery({
    endpoint: apiEndpoints.breeder.birds,
    queryKey: ["breeder", "birds"],
    enabled: !!session?.user,
  });
  const availableBirds: SelectedBird[] = (birdsData?.birds || []).filter(
    (b: any) => b.isActive === 1 && b.isLost === 0
  );

  const createTeamMutation = useCreateTeam({ endpoint: apiEndpoints.breeder.teams });

  const maxBirds = event.feeScheme?.maxBirdCount || 0;
  const birdFee = event.feeScheme?.birdFee || 0;
  const birdFeeItems = event.feeScheme?.birdFeeItems || [];

  const calculateBirdFee = () => {
    let totalBirdFee = 0;
    for (let i = 0; i < reservedBirds; i++) {
      const birdFeeItem = birdFeeItems.find(
        (item) => item.birdNo === i + 1
      );
      if (birdFeeItem) {
        totalBirdFee += birdFeeItem.fee ?? 0;
      }
    }
    return totalBirdFee;
  };

  // Update payments when reservedBirds changes
  useEffect(() => {
    if (reservedBirds > 0) {
      const perchFeeTotal = birdFee * reservedBirds;
      const birdFeeTotal = calculateBirdFee();
      const totalAmount = perchFeeTotal + birdFeeTotal;

      setPayments([
        {
          amountPaid: totalAmount,
          amountToPay: totalAmount,
          method: "CASH",
          paymentType: "PERCH_FEE",
        },
      ]);
    } else {
      setPayments([]);
    }
  }, [reservedBirds]);

  // Trim selected birds if reservedBirds decreases
  useEffect(() => {
    if (reservedBirds > 0 && selectedBirds.length > reservedBirds) {
      setSelectedBirds((prev) => prev.slice(0, reservedBirds));
    }
  }, [reservedBirds]);

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) { toast.error("Team name is required"); return; }
    try {
      if (!createTeamMutation.mutateAsync) return;
      await createTeamMutation.mutateAsync({ name: teamName });
      toast.success("Team created successfully");
      setIsAddTeamOpen(false);
      setTeamName("");
      setSelectedLoft(teamName);
    } catch (error) {
      toast.error("Failed to create team");
    }
  };

  const addBird = (birdId: string) => {
    const bird = availableBirds.find((b) => String(b.id) === birdId);
    if (!bird) return;
    if (selectedBirds.length >= reservedBirds) {
      toast.error(`Maximum ${reservedBirds} birds for this registration`);
      return;
    }
    if (selectedBirds.some((b) => b.id === bird.id)) {
      toast.error("Bird already added");
      return;
    }
    setSelectedBirds((prev) => [...prev, bird]);
  };

  const removeBird = (birdId: number) => {
    setSelectedBirds((prev) => prev.filter((b) => b.id !== birdId));
  };

  const handlePaymentChange = (field: keyof PaymentData, value: any) => {
    setPayments((prev) => [{ ...prev[0], [field]: value }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedLoft) { toast.error("Please select a loft/team"); return; }
    if (reservedBirds === 0) { toast.error("Please enter number of reserved birds"); return; }

    const registrationData = {
      loftName: selectedLoft,
      reservedBirds,
      birds: selectedBirds.map((bird) => ({ birdId: bird.id })),
      payments: payments.map((payment) => ({
        amountPaid: payment.amountPaid,
        amountToPay: payment.amountToPay,
        currency: "USD",
        method: payment.method,
        paymentType: payment.paymentType,
        description: `Fee for ${reservedBirds} birds`,
      })),
    };

    try {
      const response = await fetch(`/api/breeder/event/${eventId}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registrationData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Registration failed");
      }

      toast.success("Registration successful!");
      setSelectedLoft("");
      setReservedBirds(0);
      setSelectedBirds([]);
      setPayments([]);
    } catch (error: any) {
      toast.error(error.message || "Failed to register");
      console.error("Registration error:", error);
    }
  };

  if (isSessionPending) {
    return (
      <Card>
        <CardHeader><CardTitle>Register for {event.name}</CardTitle></CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground">Loading...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!session?.user) {
    return (
      <Card>
        <CardHeader><CardTitle>Register for {event.name}</CardTitle></CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground mb-4">
              Please log in to register for this event
            </p>
            <Button onClick={() => router.push("/login")}>Login to Register</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const selectedBirdIds = new Set(selectedBirds.map((b) => b.id));
  const unselectedBirds = availableBirds.filter((b) => !selectedBirdIds.has(b.id));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Register for {event.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Breeder Information */}
            <div className="space-y-4">
              <h3 className="font-semibold">Breeder Information</h3>
              <div className="p-4 bg-transparent rounded-lg">
                <p className="text-sm text-muted-foreground">Registering as:</p>
                <p className="font-medium">
                  {session.user.name} ({session.user.email})
                </p>
              </div>
            </div>

            {/* Loft/Team Selection */}
            <div className="space-y-2">
              <Label htmlFor="loft">Select Loft/Team *</Label>
              <div className="flex gap-2">
                <Select value={selectedLoft} onValueChange={setSelectedLoft}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select loft/team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.length === 0 ? (
                      <div className="px-2 py-4 text-sm text-center text-muted-foreground">
                        No teams created
                      </div>
                    ) : (
                      teams.map((team: any) => (
                        <SelectItem key={team.id} value={team.name}>
                          {team.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" onClick={() => setIsAddTeamOpen(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Reserved Birds */}
            {selectedLoft && (
              <div className="space-y-2">
                <Label htmlFor="reservedBirds">
                  Reserved Birds *{maxBirds > 0 ? ` (Max: ${maxBirds})` : ""}
                </Label>
                <Input
                  id="reservedBirds"
                  type="number"
                  min={1}
                  max={maxBirds > 0 ? maxBirds : undefined}
                  value={reservedBirds || ""}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0;
                    if (maxBirds > 0 && value > maxBirds) {
                      toast.error(`Maximum birds allowed: ${maxBirds}`);
                      setReservedBirds(maxBirds);
                    } else {
                      setReservedBirds(value);
                    }
                  }}
                  required
                />
              </div>
            )}

            {/* Bird Selection */}
            {reservedBirds > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">
                    Select Birds{" "}
                    <span className="text-muted-foreground font-normal text-sm">
                      ({selectedBirds.length}/{reservedBirds} selected)
                    </span>
                  </h3>
                  {selectedBirds.length < reservedBirds && unselectedBirds.length > 0 && (
                    <Select value="" onValueChange={addBird}>
                      <SelectTrigger className="w-56">
                        <SelectValue placeholder="Add bird" />
                      </SelectTrigger>
                      <SelectContent>
                        {unselectedBirds.map((bird) => (
                          <SelectItem key={bird.id} value={String(bird.id)}>
                            {bird.band} · {bird.birdName || "Unnamed"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Selected birds list */}
                {selectedBirds.map((bird) => (
                  <div key={bird.id} className="border rounded-lg p-4 flex items-center justify-between">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm flex-1">
                      <div>
                        <p className="text-muted-foreground">Band</p>
                        <p className="font-medium">{bird.band}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Name</p>
                        <p className="font-medium">{bird.birdName || "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Color</p>
                        <p className="font-medium">{bird.color || "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Sex</p>
                        <p className="font-medium">{SEX_LABELS[bird.sex] || "Unknown"}</p>
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeBird(bird.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                {/* Empty state */}
                {selectedBirds.length === 0 && (
                  <div className="border rounded-lg p-6 text-center text-sm text-muted-foreground">
                    {availableBirds.length === 0 ? (
                      <p>
                        No birds yet.{" "}
                        <Link href="/birds" className="text-primary underline">
                          Add birds first
                        </Link>
                      </p>
                    ) : (
                      <p>Use the dropdown above to add birds to this registration.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Payment Information */}
            {reservedBirds > 0 && payments.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-semibold">Payment Information</h3>
                <div className="border rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="payment-amountToPay">Total Amount To Pay</Label>
                      <Input
                        id="payment-amountToPay"
                        type="number"
                        step="0.01"
                        value={payments[0].amountToPay}
                        disabled
                        className="bg-gray-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="payment-amountPaid">Amount Paid</Label>
                      <Input
                        id="payment-amountPaid"
                        type="number"
                        step="0.01"
                        value={payments[0].amountPaid}
                        onChange={(e) =>
                          handlePaymentChange("amountPaid", parseFloat(e.target.value) || 0)
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="payment-method">Payment Method</Label>
                      <Select
                        value={payments[0].method}
                        onValueChange={(value: "CREDIT_CARD" | "PAYPAL" | "BANK_TRANSFER" | "CASH") =>
                          handlePaymentChange("method", value)
                        }
                      >
                        <SelectTrigger className="w-full">
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
                  </div>

                  {/* Fee Breakdown */}
                  <div className="mt-4 pt-4 border-t space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Per Bird Fee ({reservedBirds} birds × ${birdFee}):</span>
                      <span className="font-medium">${(birdFee * reservedBirds).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Per Bird Fee:</span>
                      <span className="font-medium">${calculateBirdFee().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold pt-2 border-t">
                      <span>Total:</span>
                      <span>${payments[0].amountToPay.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            {reservedBirds > 0 && (
              <div className="flex justify-end">
                <Button type="submit">Register for Event</Button>
              </div>
            )}
          </form>

          {/* Add Team Dialog */}
          <Dialog open={isAddTeamOpen} onOpenChange={setIsAddTeamOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Team</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddTeam} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="team-name">Team Name *</Label>
                  <Input
                    id="team-name"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Enter team name"
                    required
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsAddTeamOpen(false);
                      setTeamName("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createTeamMutation.isPending}>
                    {createTeamMutation.isPending ? "Creating..." : "Create Team"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
