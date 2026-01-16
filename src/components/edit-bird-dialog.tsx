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
import { useListRaces } from "@/lib/api/races";
import type { EventInventoryItem, Race, Event } from "@/lib/types";
import { Wifi, WifiOff } from "lucide-react";

interface EditBirdDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventInventoryItem: EventInventoryItem | null;
  event: Event;
  eventId: string;
  onSuccess?: () => void;
}

export function EditBirdDialog({
  open,
  onOpenChange,
  eventInventoryItem,
  event,
  eventId,
  onSuccess,
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
    eventInventoryItemId: eventInventoryItem?.eventInventoryItemId || "",
  });

  const { data: racesData } = useListRaces({
    params: { eventId },
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

  // WebSocket state
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intentionalDisconnectRef = useRef(false);

  useEffect(() => {
    if (eventInventoryItem) {
      // Set bird fields
      setBand1(eventInventoryItem?.bird.band1);
      setBand2(eventInventoryItem?.bird.band2);
      setBand3(eventInventoryItem?.bird.band3);
      setBand4(eventInventoryItem?.bird.band4);
      setBirdName(eventInventoryItem?.bird.birdName);
      setColor(eventInventoryItem?.bird.color);
      setSex(eventInventoryItem?.bird.sex);
      setRfid(eventInventoryItem?.bird.rfid || "");
      setIsActive(eventInventoryItem?.bird.isActive);
      setIsLost(eventInventoryItem?.bird.isLost);
      setLostDate(
        eventInventoryItem.bird.lostDate
          ? new Date(eventInventoryItem.bird.lostDate).toISOString().slice(0, 16)
          : ""
      );
      setLostRaceId(eventInventoryItem.bird.lostRaceId || "");
      setNote(eventInventoryItem.bird.note || "");

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
      setIsBackup(eventInventoryItem.isBackup);

      // Set betting classes
      setBelgianShowBet1(eventInventoryItem.belgianShowBet1);
      setBelgianShowBet2(eventInventoryItem.belgianShowBet2);
      setBelgianShowBet3(eventInventoryItem.belgianShowBet3);
      setBelgianShowBet4(eventInventoryItem.belgianShowBet4);
      setBelgianShowBet5(eventInventoryItem.belgianShowBet5);
      setBelgianShowBet6(eventInventoryItem.belgianShowBet6);
      setBelgianShowBet7(eventInventoryItem.belgianShowBet7);
      setStandardShowBet1(eventInventoryItem.standardShowBet1);
      setStandardShowBet2(eventInventoryItem.standardShowBet2);
      setStandardShowBet3(eventInventoryItem.standardShowBet3);
      setStandardShowBet4(eventInventoryItem.standardShowBet4);
      setStandardShowBet5(eventInventoryItem.standardShowBet5);
      setWtaBet1(eventInventoryItem.wtaBet1);
      setWtaBet2(eventInventoryItem.wtaBet2);
      setWtaBet3(eventInventoryItem.wtaBet3);
      setWtaBet4(eventInventoryItem.wtaBet4);
      setWtaBet5(eventInventoryItem.wtaBet5);
    }
  }, [eventInventoryItem]);

  // WebSocket connection management
  const connectWebSocket = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN || !eventInventoryItem?.bird.birdId) {
      return;
    }

    intentionalDisconnectRef.current = false; // Reset the flag when connecting

    try {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "wss://ws.infps-demo.com";
      const ws = new WebSocket(`${wsUrl}/ws?type=web&id=web-edit-bird-${eventInventoryItem.bird.birdId}`);

      ws.onopen = () => {
        console.log("WebSocket connected");
        setWsConnected(true);

        // Copy birdId to clipboard
        navigator.clipboard.writeText(eventInventoryItem.bird.birdId).then(() => {
          toast.success(`Scanner connected - Bird ID copied to clipboard`);
        }).catch(() => {
          toast.success("Scanner connected");
        });

        // Subscribe to this bird's channel
        const subscribeMessage = {
          type: "subscribe",
          channel: `bird:${eventInventoryItem.bird.birdId}`,
        };
        ws.send(JSON.stringify(subscribeMessage));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("WebSocket message:", data);

          if (data.type === "scan" && data.ringNo) {
            // Auto-fill the RFID input
            setRfid(data.ringNo);
            toast.success(`RFID scanned: ${data.ringNo}`);
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        toast.error("Scanner connection error");
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected");
        setWsConnected(false);
        wsRef.current = null;

        // Auto-reconnect after 3 seconds if dialog is still open AND disconnect was not intentional
        if (open && !intentionalDisconnectRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            toast.info("Attempting to reconnect scanner...");
            connectWebSocket();
          }, 3000);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("Error connecting to WebSocket:", error);
      toast.error("Failed to connect to scanner");
    }
  };

  const disconnectWebSocket = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      intentionalDisconnectRef.current = true; // Mark as intentional disconnect
      wsRef.current.close();
      wsRef.current = null;
      setWsConnected(false);
      toast.info("Scanner disconnected");
    }
  };

  // Cleanup on unmount or dialog close
  useEffect(() => {
    if (!open) {
      disconnectWebSocket();
    }
    return () => {
      disconnectWebSocket();
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
    if(!updateMutation.mutateAsync) return;
    await updateMutation.mutateAsync(
      data,
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Bird</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Band Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Band Information</h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="band1">Band 1</Label>
                <Input
                  id="band1"
                  value={band1}
                  onChange={(e) => setBand1(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="band2">Band 2</Label>
                <Input
                  id="band2"
                  value={band2}
                  onChange={(e) => setBand2(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="band3">Band 3</Label>
                <Input
                  id="band3"
                  value={band3}
                  onChange={(e) => setBand3(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="band4">Band 4</Label>
                <Input
                  id="band4"
                  value={band4}
                  onChange={(e) => setBand4(e.target.value)}
                  required
                />
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
                <Label htmlFor="color">Color</Label>
                <Input
                  id="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sex">Sex</Label>
                <Select value={sex} onValueChange={(value: "COCK" | "HEN" | "UNKNOWN") => setSex(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COCK">Cock</SelectItem>
                    <SelectItem value="HEN">Hen</SelectItem>
                    <SelectItem value="UNKNOWN">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rfid">RFID</Label>
                <div className="flex gap-2">
                  <Input
                    id="rfid"
                    value={rfid}
                    onChange={(e) => setRfid(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant={wsConnected ? "default" : "outline"}
                    size="icon"
                    onClick={wsConnected ? disconnectWebSocket : connectWebSocket}
                    title={wsConnected ? "Disconnect scanner" : "Connect to scanner"}
                  >
                    {wsConnected ? (
                      <Wifi className="h-4 w-4" />
                    ) : (
                      <WifiOff className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {wsConnected && (
                  <p className="text-xs text-green-600">Scanner connected - waiting for scan...</p>
                )}
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
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
