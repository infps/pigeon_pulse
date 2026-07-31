"use client";

import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useUpdateEventInventoryItem } from "@/lib/api/event-inventory-item";
import { useScanLoftBasket } from "@/lib/api/event-baskets";
import { useListRaces } from "@/lib/api/races";
import { useQuery } from "@tanstack/react-query";
import type { EventInventoryItem, Race, Event } from "@/lib/types";
import { Wifi, WifiOff, Usb } from "lucide-react";
import { useWebSerial } from "@/hooks/useWebSerial";
import { apiEndpoints } from "@/lib/endpoints";

const FEDERATIONS = ["AU", "IF", "NPA", "CU", "BB", "ARPU", "IPB"];
const COLORS = [
  "BB", "BC", "BBWF", "BBPD", "BCWF", "BCPD", "SPLA", "CHOC", "RC", "SIL",
  "RCSP", "RR", "BLK", "OPAL", "SLAT", "PENC", "WHIT", "GRIZ", "DC", "DCWF",
];

interface EditBirdDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventInventoryItem: EventInventoryItem | null;
  event: Event;
  eventId: number;
  onSuccess?: () => void;
  inline?: boolean;
}

export function EditBirdDialog({
  open,
  onOpenChange,
  eventInventoryItem,
  event,
  eventId,
  onSuccess,
  inline,
}: EditBirdDialogProps) {
  const updateMutation = useUpdateEventInventoryItem({
    onSuccess: () => {
      toast.success("Bird updated successfully");
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error) => {
      const errorMessage = JSON.parse(error.message).message || "Failed to update bird";
      toast.error(errorMessage);
    },
    eventInventoryItemId: eventInventoryItem?.id ? String(eventInventoryItem.id) : "",
  });

  const scanLoftMutation = useScanLoftBasket(eventId);

  const { data: racesData } = useListRaces({
    params: { eventId: String(eventId) },
  });
  const races:Race[] = racesData?.races || [];

  // Bird fields
  const [band1, setBand1] = useState("");
  const [band2, setBand2] = useState("");
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

  // Loft basketing
  const [capacity, setCapacity] = useState("10");

  // Breeder transfer
  const [transferBreederId, setTransferBreederId] = useState("");
  const [transferring, setTransferring] = useState(false);

  // Polling state
  const [isPolling, setIsPolling] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastScannedRfidRef = useRef<string | null>(null);

  useEffect(() => {
    if (eventInventoryItem) {
      const bird = eventInventoryItem.bird;
      // Set bird fields
      setBand1(bird?.band1 ?? "");
      setBand2(bird?.band2 ?? "");
      setBand3(bird?.band3 ?? "");
      setBand4(bird?.band4 ?? "");
      setBirdName(bird?.birdName ?? "");
      setColor(bird?.color ?? "");
      setSex(bird?.sex === 1 ? "COCK" : bird?.sex === 2 ? "HEN" : "UNKNOWN");
      setRfid(bird?.rfid ?? "");
      setIsActive(!!bird?.isActive);
      setIsLost(!!bird?.isLost);
      setLostDate(
        bird?.lostDate
          ? new Date(bird.lostDate).toISOString().slice(0, 16)
          : ""
      );
      setLostRaceId(bird?.lostRaceId ? String(bird.lostRaceId) : "");
      setNote(bird?.note ?? "");

      // Set event inventory item fields
      setArrivalTime(
        eventInventoryItem.arrivalTime
          ? new Date(eventInventoryItem.arrivalTime).toISOString().slice(0, 10)
          : ""
      );
      setDepartureTime(
        eventInventoryItem.departureTime
          ? new Date(eventInventoryItem.departureTime).toISOString().slice(0, 10)
          : ""
      );
      setIsBackup(!!eventInventoryItem.isBackup);

      // Set betting classes
      setBelgianShowBet1(!!eventInventoryItem.belgianShowBet1);
      setBelgianShowBet2(!!eventInventoryItem.belgianShowBet2);
      setBelgianShowBet3(!!eventInventoryItem.belgianShowBet3);
      setBelgianShowBet4(!!eventInventoryItem.belgianShowBet4);
      setBelgianShowBet5(!!eventInventoryItem.belgianShowBet5);
      setBelgianShowBet6(!!eventInventoryItem.belgianShowBet6);
      setBelgianShowBet7(!!eventInventoryItem.belgianShowBet7);
      setStandardShowBet1(!!eventInventoryItem.standardShowBet1);
      setStandardShowBet2(!!eventInventoryItem.standardShowBet2);
      setStandardShowBet3(!!eventInventoryItem.standardShowBet3);
      setStandardShowBet4(!!eventInventoryItem.standardShowBet4);
      setStandardShowBet5(!!eventInventoryItem.standardShowBet5);
      setWtaBet1(!!eventInventoryItem.wtaBet1);
      setWtaBet2(!!eventInventoryItem.wtaBet2);
      setWtaBet3(!!eventInventoryItem.wtaBet3);
      setWtaBet4(!!eventInventoryItem.wtaBet4);
      setWtaBet5(!!eventInventoryItem.wtaBet5);
    }
  }, [eventInventoryItem]);

  // Shared: handle incoming rfid from either source (dedupe + assign + update field)
  const handleRfidScanned = async (rfid: string) => {
    if (!eventInventoryItem) return;
    if (rfid === lastScannedRfidRef.current) return;
    lastScannedRfidRef.current = rfid;

    try {
      const result = await scanLoftMutation.mutateAsync({
        eventInventoryItemId: eventInventoryItem.id,
        rfid,
        capacity: parseInt(capacity) || 10,
      }) as any;

      setRfid(rfid);
      if (result?.alreadyAssigned) {
        toast.info(`Already basketed: ${result.basket?.label || ""}`);
      } else {
        toast.success(`Scanned & basketed → ${result?.basket?.label || ""}`);
      }
      // For poll we stop; for serial keep open (user stops)
    } catch (error: any) {
      toast.error(error?.message || "Scan failed");
    }
  };

  const handleSerialScan = (rfid: string) => {
    handleRfidScanned(rfid);
  };

  const pollStartedAtRef = useRef<string | null>(null);

  // Polling management — scans RFID + assigns loft basket in one step
  const pollScanner = async () => {
    if (!eventInventoryItem) return;
    try {
      const response = await fetch('/api/scanner/poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startedAt: pollStartedAtRef.current }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0 && data[0].el) {
          const newRfid = data[0].el;
          await handleRfidScanned(newRfid);
          stopPolling();
        }
      }
    } catch (error) {
      console.error('Error polling scanner:', error);
    }
  };

  const startPolling = () => {
    if (pollingIntervalRef.current) {
      return; // Already polling
    }

    // Stop serial if running (mutually exclusive for testing)
    if (isSerial) disconnectSerial();

    setIsPolling(true);
    lastScannedRfidRef.current = null;
    pollStartedAtRef.current = new Date().toISOString();
    toast.success('Scanner connected - polling started');
    
    // Poll immediately
    pollScanner();
    
    // Then poll every 2 seconds
    pollingIntervalRef.current = setInterval(pollScanner, 2000);
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsPolling(false);
    toast.info('Scanner disconnected');
  };

  const startSerial = async () => {
    if (isPolling) stopPolling();
    lastScannedRfidRef.current = null;
    toast.success('Web Serial connecting... (grant port in browser)');
    await connectSerial();
  };

  const stopSerial = async () => {
    await disconnectSerial();
    toast.info('Web Serial disconnected');
  };

  const { data: breedersData } = useQuery<{ breeders: { id: number; firstName: string | null; lastName: string | null }[] }>({
    queryKey: ["breeders"],
    queryFn: () => fetch(apiEndpoints.breeders.base).then((r) => r.json()),
    enabled: open,
  });
  const breeders = breedersData?.breeders ?? [];

  async function handleTransferBreeder() {
    if (!eventInventoryItem || !transferBreederId) return;
    setTransferring(true);
    try {
      const res = await fetch(apiEndpoints.groups.transferBreeder(eventInventoryItem.id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newBreederId: parseInt(transferBreederId) }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      toast.success("Breeder transferred");
      setTransferBreederId("");
      onSuccess?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setTransferring(false);
    }
  }

  // Web Serial hook (placed after handler defs to avoid TDZ)
  const { isConnected: isSerial, error: serialError, connect: connectSerial, disconnect: disconnectSerial } =
    useWebSerial({ onScan: handleSerialScan });

  // Cleanup on unmount or dialog close
  useEffect(() => {
    if (!open) {
      stopPolling();
      disconnectSerial();
    }
    return () => {
      stopPolling();
      disconnectSerial();
    };
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!eventInventoryItem) return;

    const data = {
      band1,
      band2,
      band3,
      band4,
      birdName,
      color,
      sex: sex === "COCK" ? 1 : sex === "HEN" ? 2 : 0,
      rfid: rfid || null,
      isActive,
      isLost,
      lostDate: lostDate || null,
      lostRaceId: lostRaceId || null,
      note: note || null,
      arrivalTime: arrivalTime || null,
      departureTime: departureTime || null,
      isBackup,
      belgianShowBet1: belgianShowBet1 ? 1 : 0,
      belgianShowBet2: belgianShowBet2 ? 1 : 0,
      belgianShowBet3: belgianShowBet3 ? 1 : 0,
      belgianShowBet4: belgianShowBet4 ? 1 : 0,
      belgianShowBet5: belgianShowBet5 ? 1 : 0,
      belgianShowBet6: belgianShowBet6 ? 1 : 0,
      belgianShowBet7: belgianShowBet7 ? 1 : 0,
      standardShowBet1: standardShowBet1 ? 1 : 0,
      standardShowBet2: standardShowBet2 ? 1 : 0,
      standardShowBet3: standardShowBet3 ? 1 : 0,
      standardShowBet4: standardShowBet4 ? 1 : 0,
      standardShowBet5: standardShowBet5 ? 1 : 0,
      wtaBet1: wtaBet1 ? 1 : 0,
      wtaBet2: wtaBet2 ? 1 : 0,
      wtaBet3: wtaBet3 ? 1 : 0,
      wtaBet4: wtaBet4 ? 1 : 0,
      wtaBet5: wtaBet5 ? 1 : 0,
    };
    if(!updateMutation.mutateAsync) return;
    await updateMutation.mutateAsync(
      data,
    );
  };

  const form = (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Band Information - 6 columns with separators */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Band Information</h3>
            <div className="flex items-end gap-1 ">
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
              <span className="pb-2 text-muted-foreground mb-2">-</span>
              <div className="flex-1 space-y-2 mb-2">
                <Label htmlFor="band2">Year</Label>
                <Input
                  id="band2"
                  value={band2}
                  className="h-9"
                  onChange={(e) => setBand2(e.target.value.replace(/[^0-9]/g, ""))}
                  required
                />
              </div>
              <span className="pb-2 text-muted-foreground mb-2">-</span>
              <div className="flex-1 space-y-2 mb-2">
                <Label htmlFor="band3">Letters</Label>
                <Input
                  id="band3"
                  value={band3}
                  className="h-9"
                  onChange={(e) => setBand3(e.target.value.toUpperCase())}
                  required
                />
              </div>
              <span className="pb-2 text-muted-foreground mb-2">-</span>
              <div className="flex-1 space-y-2 mb-2">
                <Label htmlFor="band4">Band No.</Label>
                <Input
                  id="band4"
                  value={band4}
                  className="h-9"
                  onChange={(e) => setBand4(e.target.value)}
                  required
                />
              </div>
              <span className="pb-2 text-muted-foreground mb-2">-</span>
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
              <span className="pb-2 text-muted-foreground mb-2">-</span>
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
            <div className="grid grid-cols-3 gap-4">
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
                <div className="flex gap-1">
                  <Input
                    id="rfid"
                    value={rfid}
                    onChange={(e) => setRfid(e.target.value)}
                    className="flex-1"
                  />
                  {/* Poll path button (python client push or tipes) */}
                  <Button
                    type="button"
                    variant={isPolling ? "default" : "outline"}
                    size="icon"
                    onClick={isPolling ? stopPolling : startPolling}
                    title="Poll Scanner (python / tipes)"
                  >
                    {isPolling ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                  </Button>
                  {/* Web Serial direct button */}
                  <Button
                    type="button"
                    variant={isSerial ? "default" : "outline"}
                    size="icon"
                    onClick={isSerial ? stopSerial : startSerial}
                    title="Web Serial (browser COM port, Chrome/Edge)"
                  >
                    <Usb className="h-4 w-4" />
                  </Button>
                </div>
                {isPolling && (
                  <p className="text-xs text-green-600 animate-pulse">Poll Active</p>
                )}
                {isSerial && (
                  <p className="text-xs text-blue-600 animate-pulse">Web Serial active — scan to assign</p>
                )}
                {serialError && (
                  <p className="text-xs text-red-600">{serialError}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="basket-capacity">Basket Cap.</Label>
                <Input
                  id="basket-capacity"
                  type="number"
                  min="1"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
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
                          <SelectItem key={race.id} value={String(race.id)}>
                            {race.description ?? `Race ${race.raceNumber}`}
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

          {/* Breeder Transfer */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Breeder Transfer</h3>
            {eventInventoryItem?.eventInventory?.breeder && (
              <p className="text-sm text-muted-foreground">
                Current: {[eventInventoryItem.eventInventory.breeder.firstName, eventInventoryItem.eventInventory.breeder.lastName].filter(Boolean).join(" ")}
              </p>
            )}
            <div className="flex gap-2">
              <Select value={transferBreederId} onValueChange={setTransferBreederId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select new breeder…" />
                </SelectTrigger>
                <SelectContent>
                  {breeders.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {[b.firstName, b.lastName].filter(Boolean).join(" ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" onClick={handleTransferBreeder} disabled={!transferBreederId || transferring}>
                {transferring ? "Transferring…" : "Transfer"}
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2">
            {!inline && (
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
  );

  if (inline) return form;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Bird</DialogTitle>
        </DialogHeader>
        {form}
      </DialogContent>
    </Dialog>
  );
}
