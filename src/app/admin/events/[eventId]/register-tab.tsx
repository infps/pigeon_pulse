"use client";

import type { Event } from "@/lib/types";
import { calculateFees } from "@/lib/fee-calculator";
import { useState, useEffect, useMemo } from "react";
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
import { Plus, X } from "lucide-react";
import { useListBreeders, useListBreederBirds } from "@/lib/api/breeders";
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

interface ExistingBirdSlot {
  type: "existing";
  birdId: number;
  name: string;
  color: string;
  sex: string;
  band: string;
}

interface NewBirdSlot {
  type: "new";
  name: string;
  color: string;
  sex: "COCK" | "HEN" | "UNKNOWN";
  band1: string;
  band2: string;
  band3: string;
  band4: string;
}

type BirdSlot = ExistingBirdSlot | NewBirdSlot;

interface PaymentData {
  amountPaid: number;
  amountToPay: number;
  method: "CREDIT_CARD" | "PAYPAL" | "BANK_TRANSFER" | "CASH";
  paymentType: "ENTRY_FEE" | "PERCH_FEE";
}

const emptyNewBird = (): NewBirdSlot => ({
  type: "new",
  name: "",
  color: "",
  sex: "COCK",
  band1: "",
  band2: "",
  band3: "",
  band4: "",
});

export function RegisterTab({ event, eventId }: RegisterTabProps) {
  const queryClient = useQueryClient();
  const [selectedBreederId, setSelectedBreederId] = useState("");
  const [selectedLoft, setSelectedLoft] = useState("");
  const [reservedBirds, setReservedBirds] = useState<number>(0);
  const [birdSlots, setBirdSlots] = useState<BirdSlot[]>([]);
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [isAddBreederOpen, setIsAddBreederOpen] = useState(false);
  const [isAddTeamOpen, setIsAddTeamOpen] = useState(false);
  const [teamName, setTeamName] = useState("");

  const { data: breedersData } = useListBreeders({});
  const breeders: any[] = breedersData?.breeders || [];

  const { data: teamsData } = useListTeams({
    params: selectedBreederId ? { breederId: selectedBreederId } : undefined,
    enabled: !!selectedBreederId,
  });
  const teams = teamsData?.teams || [];

  const { data: breederBirdsData } = useListBreederBirds(selectedBreederId || null);
  const existingBirds: any[] = breederBirdsData?.birds || [];

  const createTeamMutation = useCreateTeam({});

  const maxBirds = event.feeScheme?.maxBirds || 0;

  const fees = useMemo(() => {
    if (!event.feeScheme || reservedBirds <= 0) return null;
    return calculateFees({
      numBirds: reservedBirds,
      feeScheme: {
        entryFee: event.feeScheme.entryFee,
        raceFeeMode: event.feeScheme.raceFeeMode ?? "PER_BIRD_PER_RACE",
        hotSpot1Fee: event.feeScheme.hotSpot1Fee,
        hotSpot2Fee: event.feeScheme.hotSpot2Fee,
        hotSpot3Fee: event.feeScheme.hotSpot3Fee,
        hotSpotFinalFee: event.feeScheme.hotSpotFinalFee,
        birdFeeItems: (event.feeScheme.birdFeeItems || []).map((b) => ({
          birdNo: b.birdNo,
          birdFee: b.birdFee,
        })),
        raceTypeFees: (event.feeScheme.raceTypeFees || []).map((rt) => ({
          raceTypeId: rt.raceTypeId,
          fee: rt.fee,
        })),
      },
      races: (event.races || []).map((r) => ({ raceTypeId: r.raceTypeId })),
    });
  }, [event.feeScheme, event.races, reservedBirds]);

  // Update payment total when fees change
  useEffect(() => {
    if (reservedBirds > 0 && fees) {
      const totalAmount = fees.total;
      setPayments([
        {
          amountPaid: totalAmount,
          amountToPay: totalAmount,
          method: "CASH",
          paymentType: "PERCH_FEE",
        },
      ]);
    } else if (reservedBirds === 0) {
      setPayments([]);
    }
  }, [fees, reservedBirds]);

  const handleBreederChange = (breederId: string) => {
    setSelectedBreederId(breederId);
    setSelectedLoft("");
    setBirdSlots([]);
  };

  const handleBreederCreated = () => {
    queryClient.invalidateQueries({ queryKey: ["breeders"] });
  };

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) { toast.error("Team name is required"); return; }
    if (!selectedBreederId) { toast.error("No breeder selected"); return; }
    try {
      if (!createTeamMutation.mutateAsync) return;
      await createTeamMutation.mutateAsync({ name: teamName, breederId: selectedBreederId });
      toast.success("Team created successfully");
      setIsAddTeamOpen(false);
      setTeamName("");
      setSelectedLoft(teamName);
    } catch {
      toast.error("Failed to create team");
    }
  };

  // Add an existing bird slot
  const addExistingBird = (bird: any) => {
    if (birdSlots.length >= reservedBirds) {
      toast.error(`Maximum ${reservedBirds} birds for this registration`);
      return;
    }
    if (birdSlots.some((s) => s.type === "existing" && s.birdId === bird.id)) {
      toast.error("Bird already added");
      return;
    }
    setBirdSlots((prev) => [
      ...prev,
      {
        type: "existing",
        birdId: bird.id,
        name: bird.birdName || "",
        color: bird.color || "",
        sex: bird.sex === 1 ? "COCK" : bird.sex === 2 ? "HEN" : "UNKNOWN",
        band: bird.band || `${bird.band1}-${bird.band2}-${bird.band3}-${bird.band4}`,
      },
    ]);
  };

  // Add a blank new-bird slot
  const addNewBirdSlot = () => {
    if (birdSlots.length >= reservedBirds) {
      toast.error(`Maximum ${reservedBirds} birds for this registration`);
      return;
    }
    setBirdSlots((prev) => [...prev, emptyNewBird()]);
  };

  const removeSlot = (index: number) => {
    setBirdSlots((prev) => prev.filter((_, i) => i !== index));
  };

  const updateNewBirdField = (index: number, field: keyof NewBirdSlot, value: string) => {
    setBirdSlots((prev) =>
      prev.map((slot, i) =>
        i === index && slot.type === "new" ? { ...slot, [field]: value } : slot
      )
    );
  };

  const handlePaymentChange = (field: keyof PaymentData, value: any) => {
    setPayments((prev) => [{ ...prev[0], [field]: value }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedBreederId) { toast.error("Please select a breeder"); return; }
    if (!selectedLoft) { toast.error("Please select a loft/team"); return; }
    if (reservedBirds === 0) { toast.error("Please enter number of reserved birds"); return; }

    // Validate new bird slots have all required fields
    for (let i = 0; i < birdSlots.length; i++) {
      const slot = birdSlots[i];
      if (slot.type === "new") {
        if (!slot.name || !slot.color || !slot.band1 || !slot.band2 || !slot.band3 || !slot.band4) {
          toast.error(`Please fill all fields for new bird ${i + 1}`);
          return;
        }
      }
    }

    const birds = birdSlots.map((slot) =>
      slot.type === "existing"
        ? { birdId: slot.birdId }
        : { name: slot.name, color: slot.color, sex: slot.sex, band1: slot.band1, band2: slot.band2, band3: slot.band3, band4: slot.band4 }
    );

    const registrationData = {
      breederId: selectedBreederId,
      loftName: selectedLoft,
      reservedBirds,
      birds,
      payments: payments.map((p) => ({
        amountPaid: p.amountPaid,
        amountToPay: p.amountToPay,
        currency: "USD",
        method: p.method,
        paymentType: p.paymentType,
        description: `${p.paymentType === "ENTRY_FEE" ? "Perch" : "Per Bird"} fee for ${reservedBirds} birds`,
      })),
    };

    try {
      const response = await fetch(`/api/admin/event/${eventId}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registrationData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Registration failed");
      }

      toast.success("Registration successful!");
      queryClient.invalidateQueries({ queryKey: ["event-inventory", "list", eventId] });
      queryClient.invalidateQueries({ queryKey: ["event-inventory-items", "list", eventId] });

      // Reset form
      setSelectedBreederId("");
      setSelectedLoft("");
      setReservedBirds(0);
      setBirdSlots([]);
      setPayments([]);
    } catch (error: any) {
      toast.error(error.message || "Failed to register");
      console.error("Registration error:", error);
    }
  };

  const selectedBirdIds = new Set(
    birdSlots.filter((s) => s.type === "existing").map((s) => (s as ExistingBirdSlot).birdId)
  );

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Breeder Selection */}
        <div className="space-y-4">
          <h3 className="font-semibold">Breeder Information</h3>
          <div className="flex gap-2">
            <div className="flex-1 space-y-2">
              <Label htmlFor="breeder">Select Breeder *</Label>
              <Select value={selectedBreederId} onValueChange={handleBreederChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select breeder" />
                </SelectTrigger>
                <SelectContent>
                  {breeders.map((breeder: any) => (
                    <SelectItem key={breeder.id} value={String(breeder.id)}>
                      {breeder.firstName} {breeder.lastName || ""} ({breeder.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="pt-8">
              <Button type="button" variant="outline" size="icon" onClick={() => setIsAddBreederOpen(true)}>
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
                  <SelectValue placeholder={teams.length === 0 ? "No teams — create one first" : "Select loft/team"} />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team: any) => (
                    <SelectItem key={team.id} value={team.name}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="icon" onClick={() => setIsAddTeamOpen(true)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Reserved Birds */}
        {selectedLoft && (
          <div className="space-y-2">
            <Label htmlFor="reservedBirds">
              Reserved Birds * {maxBirds > 0 && `(Max: ${maxBirds})`}
            </Label>
            <Input
              id="reservedBirds"
              type="number"
              min={1}
              max={maxBirds || undefined}
              value={reservedBirds || ""}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 0;
                if (maxBirds > 0 && value > maxBirds) {
                  toast.error(`Maximum birds allowed: ${maxBirds}`);
                  setReservedBirds(maxBirds);
                } else {
                  setReservedBirds(value);
                  // Trim slots if count decreased
                  if (value < birdSlots.length) {
                    setBirdSlots((prev) => prev.slice(0, value));
                  }
                }
              }}
              required
            />
          </div>
        )}

        {/* Birds Section */}
        {reservedBirds > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">
                Birds <span className="text-muted-foreground font-normal text-sm">({birdSlots.length}/{reservedBirds} selected — optional)</span>
              </h3>
              <div className="flex gap-2">
                {existingBirds.length > 0 && (
                  <Select
                    value=""
                    onValueChange={(birdId) => {
                      const bird = existingBirds.find((b) => String(b.id) === birdId);
                      if (bird) addExistingBird(bird);
                    }}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Add existing bird" />
                    </SelectTrigger>
                    <SelectContent>
                      {existingBirds
                        .filter((b) => !selectedBirdIds.has(b.id))
                        .map((bird: any) => (
                          <SelectItem key={bird.id} value={String(bird.id)}>
                            {bird.birdName || bird.band} · {bird.color}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
                {birdSlots.length < reservedBirds && (
                  <Button type="button" variant="outline" size="sm" onClick={addNewBirdSlot}>
                    <Plus className="h-4 w-4 mr-1" /> New Bird
                  </Button>
                )}
              </div>
            </div>

            {birdSlots.map((slot, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">
                    Bird {index + 1} —{" "}
                    <span className="text-muted-foreground">
                      {slot.type === "existing" ? "existing" : "new"}
                    </span>
                  </h4>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeSlot(index)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {slot.type === "existing" ? (
                  // Read-only display for existing birds
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Name</p>
                      <p className="font-medium">{slot.name || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Color</p>
                      <p className="font-medium">{slot.color || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Sex</p>
                      <p className="font-medium">{slot.sex}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Band</p>
                      <p className="font-medium">{slot.band}</p>
                    </div>
                  </div>
                ) : (
                  // Editable fields for new birds
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor={`bird-${index}-name`}>Name *</Label>
                        <Input
                          id={`bird-${index}-name`}
                          value={slot.name}
                          onChange={(e) => updateNewBirdField(index, "name", e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`bird-${index}-color`}>Color *</Label>
                        <Input
                          id={`bird-${index}-color`}
                          value={slot.color}
                          onChange={(e) => updateNewBirdField(index, "color", e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`bird-${index}-sex`}>Sex *</Label>
                        <Select
                          value={slot.sex}
                          onValueChange={(v: "COCK" | "HEN" | "UNKNOWN") =>
                            updateNewBirdField(index, "sex", v)
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
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {(["band1", "band2", "band3", "band4"] as const).map((band) => (
                        <div key={band} className="space-y-1">
                          <Label htmlFor={`bird-${index}-${band}`}>
                            Band {band.slice(-1)} *
                          </Label>
                          <Input
                            id={`bird-${index}-${band}`}
                            value={slot[band]}
                            onChange={(e) => updateNewBirdField(index, band, e.target.value)}
                            required
                          />
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}

            {birdSlots.length === 0 && (
              <p className="text-sm text-muted-foreground border rounded-lg p-4 text-center">
                No birds added yet. Use the buttons above to add existing or new birds. You can also register without birds.
              </p>
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
                  <Label>Total Amount To Pay</Label>
                  <Input
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
                  <Label>Payment Method</Label>
                  <Select
                    value={payments[0].method}
                    onValueChange={(v: "CREDIT_CARD" | "PAYPAL" | "BANK_TRANSFER" | "CASH") =>
                      handlePaymentChange("method", v)
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

              {fees && (
                <div className="mt-4 pt-4 border-t space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Purge Fee:</span>
                    <span className="font-medium">${fees.purgeFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Per Bird Fees ({reservedBirds} birds):</span>
                    <span className="font-medium">${fees.perchFees.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Race Fees:</span>
                    <span className="font-medium">${fees.raceFees.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Hotspot Fees:</span>
                    <span className="font-medium">${fees.hotspotFees.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t">
                    <span>Total:</span>
                    <span>${fees.total.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Submit */}
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
              <Button type="button" variant="outline" onClick={() => { setIsAddTeamOpen(false); setTeamName(""); }}>
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
