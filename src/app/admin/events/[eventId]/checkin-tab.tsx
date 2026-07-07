"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
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
import { Radio, Square, CheckCircle2, Wifi, WifiOff, Usb } from "lucide-react";
import { useWebSerial } from "@/hooks/useWebSerial";
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
  const qc = useQueryClient();
  const { data, isPending, refetch } = useCheckinStatus(eventId);
  const checkinMutation = useCheckinBird(eventId);
  const uncheckMutation = useUncheckBird(eventId);
  const scanLoftMutation = useScanLoftBasket(eventId);

  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CheckinStatusItem | null>(null);
  const [rfidInput, setRfidInput] = useState("");
  const [isPollActive, setIsPollActive] = useState(false);
  const [breederFilter, setBreederFilter] = useState<string>("all");
  const [capacityWarningOpen, setCapacityWarningOpen] = useState(false);
  const [capacityWarningInfo, setCapacityWarningInfo] = useState<{ groupNo: number; pct: number } | null>(null);

  const { data: groupsData } = useQuery<Array<{ id: number; groupNo: number; status: string; capacity: number; _count: { members: number } }>>({
    queryKey: ["loft-groups", eventId],
    queryFn: () => fetch(`/api/admin/event/${eventId}/loft-groups`).then((r) => r.json()),
  });
  const activeGroup = groupsData?.find((g) => g.status === "OPEN");
  const lastScannedRfidRef = useRef<string | null>(null);
  const scannerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const selectedItemRef = useRef<CheckinStatusItem | null>(null);
  const webSerialOnScanRef = useRef<(rfid: string) => void>(() => {});

  // Keep ref in sync for scanner callback
  selectedItemRef.current = selectedItem;

  // Web Serial hook early (safe for TDZ in callbacks)
  const { isConnected: isSerialActive, error: serialError, connect: connectSerial, disconnect: disconnectSerial } =
    useWebSerial({ onScan: (rfid) => webSerialOnScanRef.current(rfid) });

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
    const anyScanner = isPollActive || isSerialActive;
    if (!anyScanner) {
      // Open link dialog for manual RFID entry
      setRfidInput("");
      setLinkDialogOpen(true);
    } else {
      toast.info(`Selected: ${item.bird?.birdName || "bird"} — waiting for scan`);
    }
  };

  const handleScanSuccess = useCallback(
    (result: any, birdLabel: string) => {
      if (result?.alreadyAssigned) {
        toast.info(`Already in Group ${result.groupNo ?? ""}`);
        return;
      }
      toast.success(`Scanned: ${birdLabel} → Group ${result?.loftGroup?.groupNo ?? ""}`);
      if (result?.capacityWarning && result?.loftGroup) {
        setCapacityWarningInfo({
          groupNo: result.loftGroup.groupNo,
          pct: Math.round((result.loftGroup.memberCount / result.loftGroup.capacity) * 100),
        });
        setCapacityWarningOpen(true);
      }
      qc.invalidateQueries({ queryKey: ["loft-groups", eventId] });
      refetch();
    },
    [qc, eventId, refetch]
  );

  const handleConfirmLink = async () => {
    if (!selectedItem || !rfidInput.trim()) {
      toast.error("Enter an RFID tag");
      return;
    }
    if (!activeGroup) {
      toast.error("No active group. Create a group in the Groups tab first.");
      return;
    }
    try {
      const result = await scanLoftMutation.mutateAsync({
        eventInventoryItemId: selectedItem.id,
        rfid: rfidInput.trim(),
      });
      setLinkDialogOpen(false);
      setSelectedItem(null);
      setRfidInput("");
      handleScanSuccess(result, selectedItem.bird?.birdName || "bird");
    } catch (error: any) {
      toast.error(error?.message || "Failed to scan");
    }
  };

  // Scanner poll → call scan-loft (RFID link + group assign in one step)
  const handleScanResult = useCallback(
    async (rfid: string) => {
      const current = selectedItemRef.current;
      if (!current) {
        toast.warning("Select a bird first (click a row)");
        return;
      }
      if (!activeGroup) {
        toast.error("No active group. Create a group in the Groups tab first.");
        return;
      }
      try {
        const res = await scanLoftMutation.mutateAsync({
          eventInventoryItemId: current.id,
          rfid,
        });
        setSelectedItem(null);
        setLinkDialogOpen(false);
        handleScanSuccess(res as any, current.bird?.birdName || "bird");
      } catch (error: any) {
        toast.error(error?.message || "Scan failed");
      }
    },
    [scanLoftMutation, activeGroup, handleScanSuccess]
  );

  // Direct from web serial
  const handleWebSerialScan = (rfid: string) => {
    if (rfid === lastScannedRfidRef.current) return;
    lastScannedRfidRef.current = rfid;
    if (selectedItemRef.current) {
      handleScanResult(rfid);
    } else {
      setRfidInput(rfid);
      toast.info(`Scanned: ${rfid} — select a bird to assign`);
    }
  };
  // Keep ref current for the early hook
  webSerialOnScanRef.current = handleWebSerialScan;

  // Poll path (python push or tipes)
  const startPollScanner = useCallback(() => {
    if (isSerialActive) disconnectSerial(); // mutually exclusive
    setIsPollActive(true);
    lastScannedRfidRef.current = null;
    toast.success("Poll scanner started — select a bird then scan");

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
        // silent
      }
    }, 2000);
  }, [handleScanResult, isSerialActive, disconnectSerial]);

  const stopPollScanner = useCallback(() => {
    if (scannerIntervalRef.current) {
      clearInterval(scannerIntervalRef.current);
      scannerIntervalRef.current = null;
    }
    setIsPollActive(false);
    lastScannedRfidRef.current = null;
    toast.info("Poll scanner stopped");
  }, []);

  // Web serial connect/stop wrappers
  const startSerialScanner = async () => {
    if (isPollActive) stopPollScanner();
    lastScannedRfidRef.current = null;
    toast.success("Web Serial: select port in browser");
    await connectSerial();
  };

  const stopSerialScanner = async () => {
    await disconnectSerial();
    lastScannedRfidRef.current = null;
    toast.info("Web Serial stopped");
  };

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
      {/* Active group status bar */}
      {activeGroup ? (
        <div className={`flex items-center justify-between rounded-lg border px-4 py-2 ${activeGroup._count.members / activeGroup.capacity >= 0.85 ? "border-amber-400 bg-amber-50" : "border-green-300 bg-green-50"}`}>
          <div className="flex items-center gap-3">
            {activeGroup._count.members / activeGroup.capacity >= 0.85 && (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            )}
            <span className="font-medium text-sm">Group {activeGroup.groupNo}</span>
            <Badge variant="default" className="text-xs">OPEN</Badge>
            <span className="text-sm text-muted-foreground">
              {activeGroup._count.members} / {activeGroup.capacity} birds
              {" "}({Math.round((activeGroup._count.members / activeGroup.capacity) * 100)}%)
            </span>
          </div>
          <span className="text-xs text-muted-foreground">Scan to add birds to this group</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-2 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4" />
          No active group — go to the <strong className="mx-1">Groups</strong> tab to create one before scanning
        </div>
      )}

      {/* Capacity warning dialog */}
      <Dialog open={capacityWarningOpen} onOpenChange={setCapacityWarningOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Group {capacityWarningInfo?.groupNo} is {capacityWarningInfo?.pct}% full
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            This group is nearly at capacity. You can continue scanning or close this group and start a new one from the <strong>Groups</strong> tab.
          </p>
          <DialogFooter>
            <Button onClick={() => setCapacityWarningOpen(false)}>Continue Scanning</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Progress + Scanner + Controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Loft Basketing</CardTitle>
            <div className="flex items-center gap-2">
              {/* Poll button (python / tipes) */}
              {isPollActive ? (
                <Button
                  onClick={stopPollScanner}
                  size="sm"
                  className="gap-2 bg-red-600 hover:bg-red-700"
                >
                  <Square className="h-4 w-4" />
                  Stop Poll
                </Button>
              ) : (
                <Button onClick={startPollScanner} size="sm" variant="outline" className="gap-2">
                  <Wifi className="h-4 w-4" />
                  Poll
                </Button>
              )}

              {/* Web Serial direct */}
              {isSerialActive ? (
                <Button
                  onClick={stopSerialScanner}
                  size="sm"
                  className="gap-2 bg-red-600 hover:bg-red-700"
                >
                  <Square className="h-4 w-4" />
                  Stop USB
                </Button>
              ) : (
                <Button onClick={startSerialScanner} size="sm" className="gap-2">
                  <Usb className="h-4 w-4" />
                  Web Serial
                </Button>
              )}
            </div>
            {serialError && (
              <div className="text-xs text-red-600 mt-1">Serial: {serialError}</div>
            )}
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

      {/* Link RFID + Group Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scan Bird → Group {activeGroup?.groupNo ?? "?"}</DialogTitle>
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
                placeholder={(isPollActive || isSerialActive) ? "Waiting for scanner..." : "Enter RFID tag"}
                value={rfidInput}
                onChange={(e) => setRfidInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConfirmLink()}
                autoFocus
              />
              {(isPollActive || isSerialActive) && (
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
              disabled={scanLoftMutation.isPending || !rfidInput.trim() || !activeGroup}
            >
              {scanLoftMutation.isPending ? "Scanning..." : "Scan & Assign to Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
