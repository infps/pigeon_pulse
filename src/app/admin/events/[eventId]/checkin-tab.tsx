"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { Radio, Square, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  useCheckinStatus,
  useCheckinBird,
  useUncheckBird,
  useScanLoftBasket,
} from "@/lib/api/event-baskets";
import { createCheckinColumns } from "./checkin-columns";
import type { CheckinStatusItem, CheckinSummary } from "@/lib/types";

interface CheckinTabProps {
  eventId: string;
}

export function CheckinTab({ eventId }: CheckinTabProps) {
  const { data, isPending, refetch } = useCheckinStatus(eventId);
  const checkinMutation = useCheckinBird(eventId);
  const uncheckMutation = useUncheckBird(eventId);
  const scanLoftMutation = useScanLoftBasket(eventId);

  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CheckinStatusItem | null>(null);
  const [rfidInput, setRfidInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [capacity, setCapacity] = useState("10");
  const [breederFilter, setBreederFilter] = useState<string>("all");
  const lastScannedRfidRef = useRef<string | null>(null);
  const scannerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const selectedItemRef = useRef<CheckinStatusItem | null>(null);

  // Keep ref in sync for scanner callback
  selectedItemRef.current = selectedItem;

  const items: CheckinStatusItem[] = data?.items || [];
  const summary: CheckinSummary = data?.summary || { total: 0, checkedIn: 0, notCheckedIn: 0 };

  // Unique breeders for filter
  const breeders = useMemo(() => {
    const seen = new Map<number, string>();
    for (const item of items) {
      if (item.breeder?.id && !seen.has(item.breeder.id)) {
        seen.set(
          item.breeder.id,
          [item.breeder.firstName, item.breeder.lastName].filter(Boolean).join(" ")
        );
      }
    }
    return [...seen.entries()].sort(([, a], [, b]) => a.localeCompare(b));
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    if (breederFilter === "all") return items;
    const id = parseInt(breederFilter);
    return items.filter((i) => i.breeder?.id === id);
  }, [items, breederFilter]);

  // Loft basketed count
  const loftBasketedCount = items.filter((i) => i.isLoftBasketed).length;

  const handleLink = (item: CheckinStatusItem) => {
    setSelectedItem(item);
    setRfidInput("");
    setLinkDialogOpen(true);
  };

  const handleUnlink = async (item: CheckinStatusItem) => {
    if (!confirm("Unlink RFID from this bird?")) return;
    try {
      await uncheckMutation.mutateAsync({ eventInventoryItemId: item.id });
      toast.success("RFID unlinked");
      refetch();
    } catch (error: any) {
      toast.error(error?.message || "Failed to unlink RFID");
    }
  };

  // Row click = select bird for scanning
  const handleRowClick = (item: CheckinStatusItem) => {
    if (item.isLoftBasketed) {
      toast.info("Bird already assigned to loft basket");
      return;
    }
    setSelectedItem(item);
    if (!isScanning) {
      // Open link dialog for manual RFID entry
      setRfidInput("");
      setLinkDialogOpen(true);
    } else {
      toast.info(`Selected: ${item.bird?.birdName || "bird"} — waiting for scan`);
    }
  };

  const handleConfirmLink = async () => {
    if (!selectedItem || !rfidInput.trim()) {
      toast.error("Enter an RFID tag");
      return;
    }
    try {
      await scanLoftMutation.mutateAsync({
        eventInventoryItemId: selectedItem.id,
        rfid: rfidInput.trim(),
        capacity: parseInt(capacity) || 10,
      });
      toast.success(`Scanned & basketed: ${selectedItem.bird?.birdName || "bird"}`);
      setLinkDialogOpen(false);
      setSelectedItem(null);
      setRfidInput("");
      refetch();
    } catch (error: any) {
      toast.error(error?.message || "Failed to scan");
    }
  };

  // Scanner poll → call scan-loft (RFID link + basket assign in one step)
  const handleScanResult = useCallback(
    async (rfid: string) => {
      const current = selectedItemRef.current;
      if (!current) {
        toast.warning("Select a bird first (click a row)");
        return;
      }
      try {
        const res = await scanLoftMutation.mutateAsync({
          eventInventoryItemId: current.id,
          rfid,
          capacity: parseInt(capacity) || 10,
        });
        const result = res as any;
        if (result?.alreadyAssigned) {
          toast.info(`Already basketed: ${result.basket?.label || ""}`);
        } else {
          toast.success(
            `Scanned & basketed: ${current.bird?.birdName || "bird"} → ${result?.basket?.label || ""}`
          );
        }
        setSelectedItem(null);
        setLinkDialogOpen(false);
        refetch();
      } catch (error: any) {
        toast.error(error?.message || "Scan failed");
      }
    },
    [scanLoftMutation, capacity, refetch]
  );

  const startScanner = useCallback(() => {
    setIsScanning(true);
    lastScannedRfidRef.current = null;
    toast.success("Scanner started — select a bird then scan");

    scannerIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/scanner/poll", { method: "POST" });
        const data = await res.json();
        if (data && data.length > 0 && data[0].el) {
          const rfid = data[0].el;
          if (rfid !== lastScannedRfidRef.current) {
            lastScannedRfidRef.current = rfid;
            if (selectedItemRef.current) {
              handleScanResult(rfid);
            } else {
              setRfidInput(rfid);
              toast.info(`Scanned: ${rfid} — select a bird to assign`);
            }
          }
        }
      } catch {
        // silent fail on poll
      }
    }, 2000);
  }, [handleScanResult]);

  const stopScanner = useCallback(() => {
    if (scannerIntervalRef.current) {
      clearInterval(scannerIntervalRef.current);
      scannerIntervalRef.current = null;
    }
    setIsScanning(false);
    lastScannedRfidRef.current = null;
    toast.info("Scanner stopped");
  }, []);

  const columns = createCheckinColumns(handleLink, handleUnlink);

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  const progressPercent = summary.total > 0 ? (summary.checkedIn / summary.total) * 100 : 0;
  const basketPercent = summary.total > 0 ? (loftBasketedCount / summary.total) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Progress + Scanner + Controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Loft Basketing</CardTitle>
            <div className="flex items-center gap-2">
              {isScanning ? (
                <Button
                  onClick={stopScanner}
                  size="sm"
                  className="gap-2 bg-red-600 hover:bg-red-700"
                >
                  <Square className="h-4 w-4" />
                  Stop Scanner
                </Button>
              ) : (
                <Button onClick={startScanner} size="sm" className="gap-2">
                  <Radio className="h-4 w-4" />
                  Start Scanner
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Progress bars */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>
                Checked In: <span className="font-semibold">{summary.checkedIn}/{summary.total}</span>
              </span>
              <Badge variant={summary.checkedIn === summary.total ? "default" : "secondary"}>
                {Math.round(progressPercent)}%
              </Badge>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>
                Loft Basketed: <span className="font-semibold">{loftBasketedCount}/{summary.total}</span>
              </span>
              <Badge variant={loftBasketedCount === summary.total ? "default" : "outline"}>
                {Math.round(basketPercent)}%
              </Badge>
            </div>
            <Progress value={basketPercent} className="h-2" />
          </div>

          {/* Controls row */}
          <div className="flex items-end gap-3 pt-1">
            <div className="flex-1 max-w-[200px]">
              <Label htmlFor="breeder-filter">Breeder</Label>
              <Select value={breederFilter} onValueChange={setBreederFilter}>
                <SelectTrigger id="breeder-filter">
                  <SelectValue placeholder="All Breeders" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Breeders</SelectItem>
                  {breeders.map(([id, name]) => (
                    <SelectItem key={id} value={String(id)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[120px]">
              <Label htmlFor="basket-capacity">Basket Cap.</Label>
              <Input
                id="basket-capacity"
                type="number"
                min="1"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
            </div>
            {selectedItem && (
              <Badge variant="secondary" className="py-1.5">
                Selected: {selectedItem.bird?.birdName || selectedItem.bird?.band || "bird"}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredItems}
        onRowClick={handleRowClick}
        filterableColumns={[
          { id: "band", title: "Band" },
          { id: "birdName", title: "Bird Name" },
        ]}
      />

      {/* Done button */}
      {loftBasketedCount > 0 && (
        <div className="flex justify-end">
          <Button
            size="lg"
            className="gap-2"
            onClick={() => toast.success(`Basketing complete: ${loftBasketedCount} birds in loft baskets`)}
          >
            <CheckCircle2 className="h-4 w-4" />
            Done ({loftBasketedCount} basketed)
          </Button>
        </div>
      )}

      {/* Link RFID + Basket Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scan & Basket Bird</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p>
                <span className="font-medium">Bird:</span>{" "}
                {selectedItem?.bird?.birdName || "N/A"}
              </p>
              <p>
                <span className="font-medium">Band:</span>{" "}
                <span className="font-mono">{selectedItem?.bird?.band || "N/A"}</span>
              </p>
              <p>
                <span className="font-medium">Breeder:</span>{" "}
                {[selectedItem?.breeder?.firstName, selectedItem?.breeder?.lastName]
                  .filter(Boolean)
                  .join(" ")}
              </p>
              {!selectedItem?.hasPaid && (
                <Badge variant="destructive" className="mt-1">Unpaid</Badge>
              )}
            </div>
            <div>
              <Label htmlFor="rfid">RFID Tag</Label>
              <Input
                id="rfid"
                placeholder={isScanning ? "Waiting for scanner..." : "Enter RFID tag"}
                value={rfidInput}
                onChange={(e) => setRfidInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConfirmLink()}
                autoFocus
              />
              {isScanning && (
                <p className="text-xs text-muted-foreground mt-1 animate-pulse">
                  Scanner active — scan a tag to auto-fill
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmLink}
              disabled={scanLoftMutation.isPending || !rfidInput.trim()}
            >
              {scanLoftMutation.isPending ? "Scanning..." : "Scan & Basket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
