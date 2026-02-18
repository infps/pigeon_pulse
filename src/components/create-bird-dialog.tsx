"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useCreateBird } from "@/lib/api/event-inventory-item";
import { useListRaces } from "@/lib/api/races";
import type { Event, Race } from "@/lib/types";

const FEDERATIONS = ["AU", "IF", "NPA", "CU", "BB", "ARPU", "IPB"];
const COLORS = [
  "BB", "BC", "BBWF", "BBPD", "BCWF", "BCPD", "SPLA", "CHOC", "RC", "SIL",
  "RCSP", "RR", "BLK", "OPAL", "SLAT", "PENC", "WHIT", "GRIZ", "DC", "DCWF",
];

interface CreateBirdDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventInventoryId: string;
  breederId: string;
  event: Event;
  onSuccess?: () => void;
}

export function CreateBirdDialog({
  open,
  onOpenChange,
  eventInventoryId,
  breederId,
  event,
  onSuccess,
}: CreateBirdDialogProps) {
  const createMutation = useCreateBird({
    onSuccess: () => {
      toast.success("Bird created successfully");
      resetForm();
      onSuccess?.();
      onOpenChange(false);
    },
  });

  const { data: racesData } = useListRaces({
    params: { eventId: event.eventId },
  });
  const races:Race[] = racesData?.races || [];

  // Bird fields
  const [band1, setBand1] = useState("");
  const [band2, setBand2] = useState(new Date().getFullYear().toString());
  const [band3, setBand3] = useState("");
  const [band4, setBand4] = useState("");
  const [birdName, setBirdName] = useState("");
  const [color, setColor] = useState("");
  const [sex, setSex] = useState<"COCK" | "HEN" | "UNKNOWN">("COCK");
  const [rfid, setRfid] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isLost, setIsLost] = useState(false);
  const [lostDate, setLostDate] = useState("");
  const [lostRaceId, setLostRaceId] = useState("");
  const [note, setNote] = useState("");

  // Event Inventory Item fields
  const [arrivalTime, setArrivalTime] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [isBackup, setIsBackup] = useState(false);

  // Betting classes
  const [belgianShowBet1, setBelgianShowBet1] = useState(false);
  const [belgianShowBet2, setBelgianShowBet2] = useState(false);
  const [belgianShowBet3, setBelgianShowBet3] = useState(false);
  const [belgianShowBet4, setBelgianShowBet4] = useState(false);
  const [belgianShowBet5, setBelgianShowBet5] = useState(false);
  const [belgianShowBet6, setBelgianShowBet6] = useState(false);
  const [belgianShowBet7, setBelgianShowBet7] = useState(false);
  const [standardShowBet1, setStandardShowBet1] = useState(false);
  const [standardShowBet2, setStandardShowBet2] = useState(false);
  const [standardShowBet3, setStandardShowBet3] = useState(false);
  const [standardShowBet4, setStandardShowBet4] = useState(false);
  const [standardShowBet5, setStandardShowBet5] = useState(false);
  const [wtaBet1, setWtaBet1] = useState(false);
  const [wtaBet2, setWtaBet2] = useState(false);
  const [wtaBet3, setWtaBet3] = useState(false);
  const [wtaBet4, setWtaBet4] = useState(false);
  const [wtaBet5, setWtaBet5] = useState(false);

  const resetForm = () => {
    setBand1("");
    setBand2(new Date().getFullYear().toString());
    setBand3("");
    setBand4("");
    setBirdName("");
    setColor("");
    setSex("COCK");
    setRfid("");
    setIsActive(true);
    setIsLost(false);
    setLostDate("");
    setLostRaceId("");
    setNote("");
    setArrivalTime("");
    setDepartureTime("");
    setIsBackup(false);
    setBelgianShowBet1(false);
    setBelgianShowBet2(false);
    setBelgianShowBet3(false);
    setBelgianShowBet4(false);
    setBelgianShowBet5(false);
    setBelgianShowBet6(false);
    setBelgianShowBet7(false);
    setStandardShowBet1(false);
    setStandardShowBet2(false);
    setStandardShowBet3(false);
    setStandardShowBet4(false);
    setStandardShowBet5(false);
    setWtaBet1(false);
    setWtaBet2(false);
    setWtaBet3(false);
    setWtaBet4(false);
    setWtaBet5(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      eventInventoryId,
      breederId,
      band1,
      band2,
      band3,
      band4,
      birdName,
      color,
      sex,
      rfid: rfid || null,
      isActive,
      isLost,
      lostDate: lostDate || null,
      lostRaceId: lostRaceId || null,
      note: note || null,
      arrivalTime: arrivalTime || null,
      departureTime: departureTime || null,
      isBackup,
      belgianShowBet1,
      belgianShowBet2,
      belgianShowBet3,
      belgianShowBet4,
      belgianShowBet5,
      belgianShowBet6,
      belgianShowBet7,
      standardShowBet1,
      standardShowBet2,
      standardShowBet3,
      standardShowBet4,
      standardShowBet5,
      wtaBet1,
      wtaBet2,
      wtaBet3,
      wtaBet4,
      wtaBet5,
    };

    if (!createMutation.mutateAsync) return;
    await createMutation.mutateAsync(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Bird</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Band Information - 6 columns with separators */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Band Information</h3>
            <div className="flex items-end gap-1">
              <div className="flex-1 space-y-2">
                <Label htmlFor="band1">Federation</Label>
                <Select value={band1} onValueChange={setBand1}>
                  <SelectTrigger className="w-full h-9">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {FEDERATIONS.map((fed) => (
                      <SelectItem key={fed} value={fed}>{fed}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <span className="pb-2 text-muted-foreground">-</span>
              <div className="flex-1 space-y-2">
                <Label htmlFor="band2">Year</Label>
                <Input
                  id="band2"
                  value={band2}
                  className="h-9"
                  onChange={(e) => setBand2(e.target.value.replace(/[^0-9]/g, ""))}
                  required
                />
              </div>
              <span className="pb-2 text-muted-foreground">-</span>
              <div className="flex-1 space-y-2">
                <Label htmlFor="band3">Letters</Label>
                <Input
                  id="band3"
                  value={band3}
                  className="h-9"
                  onChange={(e) => setBand3(e.target.value.toUpperCase())}
                  required
                />
              </div>
              <span className="pb-2 text-muted-foreground">-</span>
              <div className="flex-1 space-y-2">
                <Label htmlFor="band4">Band No.</Label>
                <Input
                  id="band4"
                  value={band4}
                  className="h-9"
                  onChange={(e) => setBand4(e.target.value)}
                  required
                />
              </div>
              <span className="pb-2 text-muted-foreground">-</span>
              <div className="flex-1 space-y-2">
                <Label htmlFor="color">Color</Label>
                <Select value={color} onValueChange={setColor}>
                  <SelectTrigger className="w-full h-9">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {COLORS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <span className="pb-2 text-muted-foreground">-</span>
              <div className="flex-1 space-y-2">
                <Label htmlFor="sex">Sex</Label>
                <Select value={sex} onValueChange={(value: "COCK" | "HEN" | "UNKNOWN") => setSex(value)}>
                  <SelectTrigger className="w-full h-9">
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
          </div>

          {/* Bird Details */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Bird Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="birdName">Name</Label>
                <Input
                  id="birdName"
                  value={birdName}
                  onChange={(e) => setBirdName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rfid">RFID</Label>
                <Input
                  id="rfid"
                  value={rfid}
                  onChange={(e) => setRfid(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Status Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Status</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isActive"
                  checked={isActive}
                  onCheckedChange={(checked) => setIsActive(checked as boolean)}
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isLost"
                  checked={isLost}
                  onCheckedChange={(checked) => setIsLost(checked as boolean)}
                />
                <Label htmlFor="isLost">Lost</Label>
              </div>
              {isLost && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="lostDate">Lost Date</Label>
                    <Input
                      id="lostDate"
                      type="datetime-local"
                      value={lostDate}
                      onChange={(e) => setLostDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lostRaceId">Lost Race</Label>
                    <Select value={lostRaceId} onValueChange={setLostRaceId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select race" />
                      </SelectTrigger>
                      <SelectContent>
                        {races.map((race) => (
                          <SelectItem key={race.raceId} value={race.raceId}>
                            {race.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Event Details */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Event Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="arrivalTime">Arrival Date</Label>
                <Input
                  id="arrivalTime"
                  type="date"
                  value={arrivalTime}
                  onChange={(e) => setArrivalTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="departureTime">Departure Date</Label>
                <Input
                  id="departureTime"
                  type="date"
                  value={departureTime}
                  onChange={(e) => setDepartureTime(e.target.value)}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isBackup"
                  checked={isBackup}
                  onCheckedChange={(checked) => setIsBackup(checked as boolean)}
                />
                <Label htmlFor="isBackup">Backup Bird</Label>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="note">Notes</Label>
            <Input
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Additional notes..."
            />
          </div>

          {/* Betting Classes */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Betting Classes</h3>
            
            <div className="space-y-3">
              <h4 className="font-medium">Belgian Show</h4>
              <div className="grid grid-cols-4 gap-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="belgianShowBet1"
                    checked={belgianShowBet1}
                    onCheckedChange={(checked) => setBelgianShowBet1(checked as boolean)}
                  />
                  <Label htmlFor="belgianShowBet1">Class 1 (${event.bettingScheme?.belgianShow1 || 0})</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="belgianShowBet2"
                    checked={belgianShowBet2}
                    onCheckedChange={(checked) => setBelgianShowBet2(checked as boolean)}
                  />
                  <Label htmlFor="belgianShowBet2">Class 2 (${event.bettingScheme?.belgianShow2 || 0})</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="belgianShowBet3"
                    checked={belgianShowBet3}
                    onCheckedChange={(checked) => setBelgianShowBet3(checked as boolean)}
                  />
                  <Label htmlFor="belgianShowBet3">Class 3 (${event.bettingScheme?.belgianShow3 || 0})</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="belgianShowBet4"
                    checked={belgianShowBet4}
                    onCheckedChange={(checked) => setBelgianShowBet4(checked as boolean)}
                  />
                  <Label htmlFor="belgianShowBet4">Class 4 (${event.bettingScheme?.belgianShow4 || 0})</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="belgianShowBet5"
                    checked={belgianShowBet5}
                    onCheckedChange={(checked) => setBelgianShowBet5(checked as boolean)}
                  />
                  <Label htmlFor="belgianShowBet5">Class 5 (${event.bettingScheme?.belgianShow5 || 0})</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="belgianShowBet6"
                    checked={belgianShowBet6}
                    onCheckedChange={(checked) => setBelgianShowBet6(checked as boolean)}
                  />
                  <Label htmlFor="belgianShowBet6">Class 6 (${event.bettingScheme?.belgianShow6 || 0})</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="belgianShowBet7"
                    checked={belgianShowBet7}
                    onCheckedChange={(checked) => setBelgianShowBet7(checked as boolean)}
                  />
                  <Label htmlFor="belgianShowBet7">Class 7 (${event.bettingScheme?.belgianShow7 || 0})</Label>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium">Standard Show</h4>
              <div className="grid grid-cols-4 gap-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="standardShowBet1"
                    checked={standardShowBet1}
                    onCheckedChange={(checked) => setStandardShowBet1(checked as boolean)}
                  />
                  <Label htmlFor="standardShowBet1">Class 1 (${event.bettingScheme?.standardShow1 || 0})</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="standardShowBet2"
                    checked={standardShowBet2}
                    onCheckedChange={(checked) => setStandardShowBet2(checked as boolean)}
                  />
                  <Label htmlFor="standardShowBet2">Class 2 (${event.bettingScheme?.standardShow2 || 0})</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="standardShowBet3"
                    checked={standardShowBet3}
                    onCheckedChange={(checked) => setStandardShowBet3(checked as boolean)}
                  />
                  <Label htmlFor="standardShowBet3">Class 3 (${event.bettingScheme?.standardShow3 || 0})</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="standardShowBet4"
                    checked={standardShowBet4}
                    onCheckedChange={(checked) => setStandardShowBet4(checked as boolean)}
                  />
                  <Label htmlFor="standardShowBet4">Class 4 (${event.bettingScheme?.standardShow4 || 0})</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="standardShowBet5"
                    checked={standardShowBet5}
                    onCheckedChange={(checked) => setStandardShowBet5(checked as boolean)}
                  />
                  <Label htmlFor="standardShowBet5">Class 5 (${event.bettingScheme?.standardShow5 || 0})</Label>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium">WTA (Winner Takes All)</h4>
              <div className="grid grid-cols-4 gap-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="wtaBet1"
                    checked={wtaBet1}
                    onCheckedChange={(checked) => setWtaBet1(checked as boolean)}
                  />
                  <Label htmlFor="wtaBet1">WTA 1 (${event.bettingScheme?.wta1 || 0})</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="wtaBet2"
                    checked={wtaBet2}
                    onCheckedChange={(checked) => setWtaBet2(checked as boolean)}
                  />
                  <Label htmlFor="wtaBet2">WTA 2 (${event.bettingScheme?.wta2 || 0})</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="wtaBet3"
                    checked={wtaBet3}
                    onCheckedChange={(checked) => setWtaBet3(checked as boolean)}
                  />
                  <Label htmlFor="wtaBet3">WTA 3 (${event.bettingScheme?.wta3 || 0})</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="wtaBet4"
                    checked={wtaBet4}
                    onCheckedChange={(checked) => setWtaBet4(checked as boolean)}
                  />
                  <Label htmlFor="wtaBet4">WTA 4 (${event.bettingScheme?.wta4 || 0})</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="wtaBet5"
                    checked={wtaBet5}
                    onCheckedChange={(checked) => setWtaBet5(checked as boolean)}
                  />
                  <Label htmlFor="wtaBet5">WTA 5 (${event.bettingScheme?.wta5 || 0})</Label>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Bird"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
