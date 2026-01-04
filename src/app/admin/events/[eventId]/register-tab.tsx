"use client";

import type { Event, User } from "@/lib/types";
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
import { Plus } from "lucide-react";
import { useListUsers } from "@/lib/api/users";
import { useListTeams, useCreateTeam } from "@/lib/api/teams";
import { toast } from "sonner";
import { AddEditBreederDialog } from "@/components/add-edit-breeder-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";

interface RegisterTabProps {
  event: Event;
  eventId: string;
}

interface BirdData {
  name: string;
  color: string;
  sex: "COCK" | "HEN" | "UNKNOWN";
  band1: string;
  band2: string;
  band3: string;
  band4: string;
}

interface PaymentData {
  amountPaid: number;
  amountToPay: number;
  method: "CREDIT_CARD" | "PAYPAL" | "BANK_TRANSFER" | "CASH";
  paymentType: "ENTRY_FEE" | "PERCH_FEE";
}

export function RegisterTab({ event, eventId }: RegisterTabProps) {
  const queryClient = useQueryClient();
  const [selectedBreederId, setSelectedBreederId] = useState("");
  const [selectedLoft, setSelectedLoft] = useState("");
  const [reservedBirds, setReservedBirds] = useState<number>(0);
  const [birds, setBirds] = useState<BirdData[]>([]);
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [isAddBreederOpen, setIsAddBreederOpen] = useState(false);
  const [isAddTeamOpen, setIsAddTeamOpen] = useState(false);
  const [teamName, setTeamName] = useState("");

  const { data: usersData } = useListUsers({ params: { role: "BREEDER" } });
  const breeders: User[] = usersData?.users || [];

  const { data: teamsData } = useListTeams({
    params: selectedBreederId ? { breederId: selectedBreederId } : undefined,
  });
  const teams = teamsData?.teams || [];

  const createTeamMutation = useCreateTeam({});

  const maxBirds = event.feeScheme?.maxBirds || 0;
  const entryFee = event.feeScheme?.entryFee || 0;
  const perchFeeItems = event.feeScheme?.perchFeeItems || [];

  const calculatePerchFee = () => {
    let totalPerchFee = 0;
    console.log(perchFeeItems)
    for (let i = 0; i < reservedBirds; i++) {
      const perchFeeItem = perchFeeItems.find(
        (item) => item.birdNo === i + 1
      );
      if (perchFeeItem) {
        totalPerchFee += perchFeeItem.fee;
      }
    }
    return totalPerchFee;
  };

  // Initialize birds array when reservedBirds changes
  useEffect(() => {
    if (reservedBirds > 0 && reservedBirds <= maxBirds) {
      const newBirds: BirdData[] = Array.from({ length: reservedBirds }, (_, i) => ({
        name: birds[i]?.name || "",
        color: birds[i]?.color || "",
        sex: birds[i]?.sex || "COCK",
        band1: birds[i]?.band1 || "",
        band2: birds[i]?.band2 || "",
        band3: birds[i]?.band3 || "",
        band4: birds[i]?.band4 || "",
      }));
      setBirds(newBirds);

      // Initialize payments
      const entryFeeTotal = entryFee * reservedBirds;
      const perchFeeTotal = calculatePerchFee();

      setPayments([
        {
          amountPaid: entryFeeTotal,
          amountToPay: entryFeeTotal,
          method: "CASH",
          paymentType: "ENTRY_FEE",
        },
        {
          amountPaid: perchFeeTotal,
          amountToPay: perchFeeTotal,
          method: "CASH",
          paymentType: "PERCH_FEE",
        },
      ]);
    } else {
      setBirds([]);
      setPayments([]);
    }
  }, [reservedBirds]);

  const handleBreederCreated = (result: any) => {
    // Set the newly created breeder as selected
    if (result?.data?.user?.id) {
      setSelectedBreederId(result.data.user.id);
    }
  };

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!teamName.trim()) {
      toast.error("Team name is required");
      return;
    }

    if (!selectedBreederId) {
      toast.error("No breeder selected");
      return;
    }

    try {
      if (!createTeamMutation.mutateAsync) return;
      await createTeamMutation.mutateAsync({
        name: teamName,
        breederId: selectedBreederId,
      });
      toast.success("Team created successfully");
      setIsAddTeamOpen(false);
      setTeamName("");
      setSelectedLoft(teamName);
    } catch (error) {
      toast.error("Failed to create team");
    }
  };

  const handleBirdChange = (index: number, field: keyof BirdData, value: string) => {
    const newBirds = [...birds];
    newBirds[index] = { ...newBirds[index], [field]: value };
    setBirds(newBirds);
  };

  const handlePaymentChange = (index: number, field: keyof PaymentData, value: any) => {
    const newPayments = [...payments];
    newPayments[index] = { ...newPayments[index], [field]: value };
    setPayments(newPayments);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedBreederId) {
      toast.error("Please select a breeder");
      return;
    }

    if (!selectedLoft) {
      toast.error("Please select a loft/team");
      return;
    }

    if (reservedBirds === 0) {
      toast.error("Please enter number of reserved birds");
      return;
    }

    // Validate all birds have required fields
    for (let i = 0; i < birds.length; i++) {
      const bird = birds[i];
      if (!bird.name || !bird.color || !bird.band1 || !bird.band2 || !bird.band3 || !bird.band4) {
        toast.error(`Please fill all fields for bird ${i + 1}`);
        return;
      }
    }

    const registrationData = {
      breederId: selectedBreederId,
      loftName: selectedLoft,
      reservedBirds,
      birds: birds.map((bird) => ({
        name: bird.name,
        color: bird.color,
        sex: bird.sex,
        band1: bird.band1,
        band2: bird.band2,
        band3: bird.band3,
        band4: bird.band4,
      })),
      payments: payments.map((payment) => ({
        amountPaid: payment.amountPaid,
        amountToPay: payment.amountToPay,
        currency: "USD",
        method: payment.method,
        paymentType: payment.paymentType,
        description: `${payment.paymentType === "ENTRY_FEE" ? "Entry" : "Perch"} fee for ${reservedBirds} birds`,
      })),
    };

    try {
      const response = await fetch(`/api/event/${eventId}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(registrationData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Registration failed");
      }

      toast.success("Registration successful!");
      
      // Invalidate queries to refresh breeders and birds tabs
      queryClient.invalidateQueries({ queryKey: ["event-inventory", "list", eventId] });
      queryClient.invalidateQueries({ queryKey: ["event-inventory-items", "list", eventId] });
      
      // Reset form
      setSelectedBreederId("");
      setSelectedLoft("");
      setReservedBirds(0);
      setBirds([]);
      setPayments([]);
    } catch (error: any) {
      toast.error(error.message || "Failed to register");
      console.error("Registration error:", error);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Breeder Selection */}
        <div className="space-y-4">
          <h3 className="font-semibold">Breeder Information</h3>
          <div className="flex gap-2">
            <div className="flex-1 space-y-2">
              <Label htmlFor="breeder">Select Breeder *</Label>
              <Select
                value={selectedBreederId}
                onValueChange={(value) => {
                  setSelectedBreederId(value);
                  setSelectedLoft("");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select breeder" />
                </SelectTrigger>
                <SelectContent>
                  {breeders.map((breeder: any) => (
                    <SelectItem key={breeder.id} value={breeder.id}>
                      {breeder.name} {breeder.lastName || ""} ({breeder.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="pt-8">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setIsAddBreederOpen(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Loft/Team Selection */}
        {selectedBreederId && (
          <div className="space-y-2">
            <Label htmlFor="loft">Select Loft/Team *</Label>
            <div className="flex gap-2">
              <Select value={selectedLoft} onValueChange={setSelectedLoft}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select loft/team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team: any) => (
                    <SelectItem key={team.id} value={team.name}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setIsAddTeamOpen(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Reserved Birds */}
        {selectedLoft && (
          <div className="space-y-2">
            <Label htmlFor="reservedBirds">
              Reserved Birds * (Max: {maxBirds})
            </Label>
            <Input
              id="reservedBirds"
              type="number"
              min={1}
              max={maxBirds}
              value={reservedBirds || ""}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                if (value > maxBirds) {
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

        {/* Birds Input */}
        {reservedBirds > 0 && birds.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold">Birds Information</h3>
            {birds.map((bird, index) => (
              <div
                key={index}
                className="border rounded-lg p-4 space-y-4"
              >
                <h4 className="font-medium">Bird {index + 1}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`bird-${index}-name`}>Name *</Label>
                    <Input
                      id={`bird-${index}-name`}
                      value={bird.name}
                      onChange={(e) =>
                        handleBirdChange(index, "name", e.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`bird-${index}-color`}>Color *</Label>
                    <Input
                      id={`bird-${index}-color`}
                      value={bird.color}
                      onChange={(e) =>
                        handleBirdChange(index, "color", e.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`bird-${index}-sex`}>Sex *</Label>
                    <Select
                      value={bird.sex}
                      onValueChange={(value: "COCK" | "HEN" | "UNKNOWN") =>
                        handleBirdChange(index, "sex", value)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="COCK">Cock</SelectItem>
                        <SelectItem value="HEN">Hen</SelectItem>
                        <SelectItem value="UNKNOWN">Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`bird-${index}-band1`}>Band 1 *</Label>
                    <Input
                      id={`bird-${index}-band1`}
                      value={bird.band1}
                      onChange={(e) =>
                        handleBirdChange(index, "band1", e.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`bird-${index}-band2`}>Band 2 *</Label>
                    <Input
                      id={`bird-${index}-band2`}
                      value={bird.band2}
                      onChange={(e) =>
                        handleBirdChange(index, "band2", e.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`bird-${index}-band3`}>Band 3 *</Label>
                    <Input
                      id={`bird-${index}-band3`}
                      value={bird.band3}
                      onChange={(e) =>
                        handleBirdChange(index, "band3", e.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`bird-${index}-band4`}>Band 4 *</Label>
                    <Input
                      id={`bird-${index}-band4`}
                      value={bird.band4}
                      onChange={(e) =>
                        handleBirdChange(index, "band4", e.target.value)
                      }
                      required
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Payment Information */}
        {reservedBirds > 0 && payments.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold">Payment Information</h3>
            {payments.map((payment, index) => (
              <div key={index} className="border rounded-lg p-4">
                <h4 className="font-medium mb-4">
                  {payment.paymentType === "ENTRY_FEE" ? "Entry Fee" : "Perch Fee"}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`payment-${index}-type`}>Payment Type</Label>
                    <Input
                      id={`payment-${index}-type`}
                      value={payment.paymentType === "ENTRY_FEE" ? "Entry Fee" : "Perch Fee"}
                      disabled
                      className="bg-gray-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`payment-${index}-amountToPay`}>Amount To Pay</Label>
                    <Input
                      id={`payment-${index}-amountToPay`}
                      type="number"
                      step="0.01"
                      value={payment.amountToPay}
                      disabled
                      className="bg-gray-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`payment-${index}-amountPaid`}>Amount Paid</Label>
                    <Input
                      id={`payment-${index}-amountPaid`}
                      type="number"
                      step="0.01"
                      value={payment.amountPaid}
                      onChange={(e) =>
                        handlePaymentChange(index, "amountPaid", parseFloat(e.target.value) || 0)
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`payment-${index}-method`}>Payment Method</Label>
                    <Select
                      value={payment.method}
                      onValueChange={(value: "CREDIT_CARD" | "PAYPAL" | "BANK_TRANSFER" | "CASH") =>
                        handlePaymentChange(index, "method", value)
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
              </div>
            ))}
            
            {/* Total Summary */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="flex justify-between text-lg font-bold">
                <span>Total Amount To Pay:</span>
                <span>${payments.reduce((sum, p) => sum + p.amountToPay, 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold mt-2">
                <span>Total Amount Paid:</span>
                <span>${payments.reduce((sum, p) => sum + p.amountPaid, 0).toFixed(2)}</span>
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

      {/* Add Breeder Dialog */}
      <AddEditBreederDialog
        open={isAddBreederOpen}
        onOpenChange={setIsAddBreederOpen}
        onSuccess={handleBreederCreated}
      />

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
  );
}
