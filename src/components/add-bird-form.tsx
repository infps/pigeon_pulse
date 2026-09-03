"use client";

import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Wifi, WifiOff, Usb } from "lucide-react";
import { FEDERATIONS, COLORS } from "@/lib/bird-constants";
import type { BettingScheme } from "@/lib/types";
import { ImageCapture } from "@/components/image-capture";

// ── Types ──────────────────────────────────────────────────────────────────

export interface AddBirdFormState {
  // band
  band1: string;
  band2: string;
  band3: string;
  band4: string;
  // properties
  color: string;
  sex: "0" | "1" | "2";
  rfid: string;
  name: string;
  // status
  isActive: boolean;
  isLost: boolean;
  lostDate: string;
  lostRaceId: string;
  // meta
  attention: boolean;
  note: string;
  // event
  arrivalTime: string;
  departureTime: string;
  isBackup: boolean;
  // fees
  perchFeeValue: string;
  entryFeeValue: string;
  hotSpotFeeValue: string;
  raceFeeValue: string;
  // betting classes
  belgianShowBet1: boolean;
  belgianShowBet2: boolean;
  belgianShowBet3: boolean;
  belgianShowBet4: boolean;
  belgianShowBet5: boolean;
  belgianShowBet6: boolean;
  belgianShowBet7: boolean;
  standardShowBet1: boolean;
  standardShowBet2: boolean;
  standardShowBet3: boolean;
  standardShowBet4: boolean;
  standardShowBet5: boolean;
  wtaBet1: boolean;
  wtaBet2: boolean;
  wtaBet3: boolean;
  wtaBet4: boolean;
  wtaBet5: boolean;
}

export type AddBirdFormSetters = {
  [K in keyof AddBirdFormState as `set${Capitalize<string & K>}`]: (v: AddBirdFormState[K]) => void;
};

export interface AddBirdFormProps {
  state: AddBirdFormState;
  setters: AddBirdFormSetters;
  bettingScheme?: BettingScheme | null;
  // RFID scanner controls — pass from parent
  rfidPolling?: boolean;
  onStartRfidPoll?: () => void;
  onStopRfidPoll?: () => void;
  isSerial?: boolean;
  serialError?: string | null;
  onConnectSerial?: () => void;
  onDisconnectSerial?: () => void;
  // optional band number ref for external focus control
  bandNumberRef?: React.RefObject<HTMLInputElement | null>;
  // optional: hide fees / classes sections
  showFees?: boolean;
  showClasses?: boolean;
  // image
  imageUrl?: string | null;
  onImageChange?: (imageUrl: string | null, imageFile?: File | null) => void;
}

// ── Default state factory ──────────────────────────────────────────────────

export function createAddBirdFormState(): AddBirdFormState {
  return {
    band1: "",
    band2: String(new Date().getFullYear()).slice(-2),
    band3: "",
    band4: "",
    color: "",
    sex: "1",
    rfid: "",
    name: "",
    isActive: true,
    isLost: false,
    lostDate: "",
    lostRaceId: "",
    attention: false,
    note: "",
    arrivalTime: new Date().toISOString().split("T")[0],
    departureTime: "",
    isBackup: false,
    perchFeeValue: "",
    entryFeeValue: "",
    hotSpotFeeValue: "",
    raceFeeValue: "",
    belgianShowBet1: false,
    belgianShowBet2: false,
    belgianShowBet3: false,
    belgianShowBet4: false,
    belgianShowBet5: false,
    belgianShowBet6: false,
    belgianShowBet7: false,
    standardShowBet1: false,
    standardShowBet2: false,
    standardShowBet3: false,
    standardShowBet4: false,
    standardShowBet5: false,
    wtaBet1: false,
    wtaBet2: false,
    wtaBet3: false,
    wtaBet4: false,
    wtaBet5: false,
  };
}

// ── Build payload for API ──────────────────────────────────────────────────

export function buildAddBirdPayload(s: AddBirdFormState, breederId: number, birdName?: string) {
  return {
    breederId,
    name: birdName || s.name || `${s.band1}-${s.band2}-${s.band3}-${s.band4}`,
    band1: s.band1,
    band2: s.band2,
    band3: s.band3,
    band4: s.band4,
    color: s.color,
    sex: parseInt(s.sex),
    rfid: s.rfid || undefined,
    attention: s.attention,
    isBackup: s.isBackup,
    isActive: s.isActive,
    isLost: s.isLost,
    lostDate: s.lostDate || null,
    lostRaceId: s.lostRaceId ? parseInt(s.lostRaceId) : null,
    note: s.note || null,
    arrivalTime: s.arrivalTime || null,
    departureTime: s.departureTime || null,
    perchFeeValue: s.perchFeeValue ? parseFloat(s.perchFeeValue) : null,
    entryFeeValue: s.entryFeeValue ? parseFloat(s.entryFeeValue) : null,
    hotSpotFeeValue: s.hotSpotFeeValue ? parseFloat(s.hotSpotFeeValue) : null,
    raceFeeValue: s.raceFeeValue ? parseFloat(s.raceFeeValue) : null,
    belgianShowBet1: s.belgianShowBet1 ? 1 : null,
    belgianShowBet2: s.belgianShowBet2 ? 1 : null,
    belgianShowBet3: s.belgianShowBet3 ? 1 : null,
    belgianShowBet4: s.belgianShowBet4 ? 1 : null,
    belgianShowBet5: s.belgianShowBet5 ? 1 : null,
    belgianShowBet6: s.belgianShowBet6 ? 1 : null,
    belgianShowBet7: s.belgianShowBet7 ? 1 : null,
    standardShowBet1: s.standardShowBet1 ? 1 : null,
    standardShowBet2: s.standardShowBet2 ? 1 : null,
    standardShowBet3: s.standardShowBet3 ? 1 : null,
    standardShowBet4: s.standardShowBet4 ? 1 : null,
    standardShowBet5: s.standardShowBet5 ? 1 : null,
    wtaBet1: s.wtaBet1 ? 1 : null,
    wtaBet2: s.wtaBet2 ? 1 : null,
    wtaBet3: s.wtaBet3 ? 1 : null,
    wtaBet4: s.wtaBet4 ? 1 : null,
    wtaBet5: s.wtaBet5 ? 1 : null,
  };
}

// ── Validate ───────────────────────────────────────────────────────────────

export function validateAddBirdForm(s: AddBirdFormState): string | null {
  if (!s.band1) return "Select a federation";
  if (!s.band2) return "Enter a year";
  if (!s.band3) return "Enter letters";
  if (!s.band4) return "Enter a band number";
  if (!s.color) return "Select a color";
  return null;
}

// ── Component ──────────────────────────────────────────────────────────────

export function AddBirdForm({
  state: s,
  setters: set,
  bettingScheme: bs,
  rfidPolling,
  onStartRfidPoll,
  onStopRfidPoll,
  isSerial,
  serialError,
  onConnectSerial,
  onDisconnectSerial,
  bandNumberRef,
  showFees = true,
  showClasses = true,
  imageUrl,
  onImageChange,
}: AddBirdFormProps) {
  const internalBandRef = useRef<HTMLInputElement>(null);
  const bandRef = bandNumberRef ?? internalBandRef;

  return (
    <div className="space-y-5">

      {/* ── Grid 1: Band ID and Details ── */}
      <div className="grid grid-cols-[3fr_2fr] gap-3 items-stretch">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Band ID</Label>
          <div className="flex items-end gap-1.5">
            {/* Assoc / Federation */}
            <div className="space-y-1 min-w-0">
              <Label className="text-xs">Assoc. *</Label>
              <Select value={s.band1} onValueChange={set.setBand1}>
                <SelectTrigger className="h-9 w-24">
                  <SelectValue placeholder="AU…" />
                </SelectTrigger>
                <SelectContent>
                  {FEDERATIONS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <span className="pb-2 text-muted-foreground select-none">-</span>
            {/* Year */}
            <div className="space-y-1">
              <Label className="text-xs">Year *</Label>
              <Input
                className="h-9 w-14"
                value={s.band2}
                onChange={(e) => set.setBand2(e.target.value.replace(/[^0-9]/g, ""))}
                maxLength={4}
              />
            </div>
            <span className="pb-2 text-muted-foreground select-none">-</span>
            {/* Letter */}
            <div className="space-y-1">
              <Label className="text-xs">Letter *</Label>
              <Input
                className="h-9 w-20 uppercase"
                value={s.band3}
                onChange={(e) => set.setBand3(e.target.value.toUpperCase())}
                maxLength={4}
              />
            </div>
            <span className="pb-2 text-muted-foreground select-none">-</span>
            {/* Number */}
            <div className="space-y-1">
              <Label className="text-xs">Number *</Label>
              <Input
                ref={bandRef as React.RefObject<HTMLInputElement>}
                className="h-9 w-24"
                value={s.band4}
                onChange={(e) => set.setBand4(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">EID (RFID)</Label>
            <div className="flex items-end">
              <div className="flex gap-1">
                <Input
                  className="flex-1 h-9 font-mono text-sm"
                  placeholder="scan or type…"
                  value={s.rfid}
                  onChange={(e) => set.setRfid(e.target.value)}
                />
                {onStartRfidPoll && (
                  <Button
                    type="button"
                    variant={rfidPolling ? "default" : "outline"}
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={rfidPolling ? onStopRfidPoll : onStartRfidPoll}
                    title="Poll scanner"
                  >
                    {rfidPolling ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                  </Button>
                )}
                {onConnectSerial && (
                  <Button
                    type="button"
                    variant={isSerial ? "default" : "outline"}
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={isSerial ? onDisconnectSerial : onConnectSerial}
                    title="Web Serial"
                  >
                    <Usb className="h-4 w-4" />
                  </Button>
                )}
              </div>
                {rfidPolling && <p className="text-xs text-green-600 animate-pulse">Poll active — scan a bird</p>}
                {isSerial && <p className="text-xs text-blue-600 animate-pulse">Web Serial active</p>}
                {serialError && <p className="text-xs text-red-600">{serialError}</p>}
              <button>RFID</button>{/* Need to implement this RFID Scanner fetcher button from the forms*/}
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Properties</Label>
          <div className="flex items-end gap-1 5">
            {/* Color */}
            <div className="space-y-1">
              <Label className="text-xs">Color *</Label>
              <Select value={s.color} onValueChange={set.setColor}>
                <SelectTrigger className="h-9 w-28">
                  <SelectValue placeholder="…" />
                </SelectTrigger>
                <SelectContent>
                  {COLORS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* Sex */}
            <div className="space-y-1">
              <Label className="text-xs">Sex *</Label>
              <Select value={s.sex} onValueChange={(v) => set.setSex(v as "0" | "1" | "2")}>
                <SelectTrigger className="h-9 w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Cock</SelectItem>
                  <SelectItem value="2">Hen</SelectItem>
                  <SelectItem value="0">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-0.5">
            <Label className="text-xs">Name</Label>
            <Input className="h-9" placeholder="e.g. Blue Arrow" value={s.name} onChange={(e) => set.setName(e.target.value)} />
          </div>
        </div>
      </div>

      {/* ── Row 2: Status ── */}
      <div className="grid grid-cols-[3fr_2fr] gap-3 items-stretch">
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Images</Label>
          <div className="max-w-[180px]">
            <ImageCapture
              value={imageUrl ?? null}
              onChange={onImageChange ?? (() => {})}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</Label>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Checkbox checked={s.isActive} onCheckedChange={(v) => set.setIsActive(!!v)} />
              <span className="text-sm">Active</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Checkbox checked={s.isLost} onCheckedChange={(v) => set.setIsLost(!!v)} />
              <span className="text-sm">Lost</span>
            </label>
            {s.isLost && (
              <>
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs whitespace-nowrap text-muted-foreground">Lost date</Label>
                  <Input type="date" className="h-8 w-36" value={s.lostDate} onChange={(e) => set.setLostDate(e.target.value)} />
                </div>
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs whitespace-nowrap text-muted-foreground">Lost race #</Label>
                  <Input className="h-8 w-20" value={s.lostRaceId} onChange={(e) => set.setLostRaceId(e.target.value)} />
                </div>
              </>
            )}
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Checkbox checked={s.attention} onCheckedChange={(v) => set.setAttention(!!v)} />
            <span className="text-sm">Play attention sound on basketing</span>
          </label>
          <div className="space-y-1.5">
            <Label className="text-xs">Note</Label>
            <Input className="h-9" placeholder="Additional notes…" value={s.note} onChange={(e) => set.setNote(e.target.value)} />
          </div>
        </div>
      </div>

      {/* ── Row 6: Dates + Backup + Fees ── */}
      {showFees && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Event Details &amp; Fees</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Arrival date</Label>
              <Input type="date" className="h-9" value={s.arrivalTime} onChange={(e) => set.setArrivalTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Departure date</Label>
              <Input type="date" className="h-9" value={s.departureTime} onChange={(e) => set.setDepartureTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Perch fee ($)</Label>
              <Input className="h-9" type="number" step="0.01" min="0" value={s.perchFeeValue} onChange={(e) => set.setPerchFeeValue(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Entry fee ($)</Label>
              <Input className="h-9" type="number" step="0.01" min="0" value={s.entryFeeValue} onChange={(e) => set.setEntryFeeValue(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Hot spot fee ($)</Label>
              <Input className="h-9" type="number" step="0.01" min="0" value={s.hotSpotFeeValue} onChange={(e) => set.setHotSpotFeeValue(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Race fee ($)</Label>
              <Input className="h-9" type="number" step="0.01" min="0" value={s.raceFeeValue} onChange={(e) => set.setRaceFeeValue(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none mt-1">
            <Checkbox checked={s.isBackup} onCheckedChange={(v) => set.setIsBackup(!!v)} />
            <span className="text-sm">Backup bird</span>
          </label>
        </div>
      )}

      {/* ── Row 7: Betting Classes ── */}
      {showClasses && bs && (
        <div className="space-y-3 border rounded-lg p-3">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Classes</Label>

          {/* Belgian Show */}
          {([bs.belgianShow1, bs.belgianShow2, bs.belgianShow3, bs.belgianShow4, bs.belgianShow5, bs.belgianShow6, bs.belgianShow7] as (number | null)[]).some(Boolean) && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium">Belgian Show</p>
              <div className="flex flex-wrap gap-3">
                {(
                  [
                    [bs.belgianShow1, s.belgianShowBet1, set.setBelgianShowBet1, "A"],
                    [bs.belgianShow2, s.belgianShowBet2, set.setBelgianShowBet2, "B"],
                    [bs.belgianShow3, s.belgianShowBet3, set.setBelgianShowBet3, "C"],
                    [bs.belgianShow4, s.belgianShowBet4, set.setBelgianShowBet4, "D"],
                    [bs.belgianShow5, s.belgianShowBet5, set.setBelgianShowBet5, "E"],
                    [bs.belgianShow6, s.belgianShowBet6, set.setBelgianShowBet6, "F"],
                    [bs.belgianShow7, s.belgianShowBet7, set.setBelgianShowBet7, "G"],
                  ] as [number | null, boolean, (v: boolean) => void, string][]
                ).filter(([amt]) => amt != null && amt > 0).map(([amt, checked, setter, lbl]) => (
                  <label key={lbl} className="flex items-center gap-1.5 cursor-pointer select-none">
                    <Checkbox checked={checked} onCheckedChange={(v) => setter(!!v)} />
                    <span className="text-sm">{lbl} (${amt})</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Standard Show */}
          {([bs.standardShow1, bs.standardShow2, bs.standardShow3, bs.standardShow4, bs.standardShow5] as (number | null)[]).some(Boolean) && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium">Standard Show</p>
              <div className="flex flex-wrap gap-3">
                {(
                  [
                    [bs.standardShow1, s.standardShowBet1, set.setStandardShowBet1, "D"],
                    [bs.standardShow2, s.standardShowBet2, set.setStandardShowBet2, "E"],
                    [bs.standardShow3, s.standardShowBet3, set.setStandardShowBet3, "F"],
                    [bs.standardShow4, s.standardShowBet4, set.setStandardShowBet4, "G"],
                    [bs.standardShow5, s.standardShowBet5, set.setStandardShowBet5, "H"],
                  ] as [number | null, boolean, (v: boolean) => void, string][]
                ).filter(([amt]) => amt != null && amt > 0).map(([amt, checked, setter, lbl]) => (
                  <label key={lbl} className="flex items-center gap-1.5 cursor-pointer select-none">
                    <Checkbox checked={checked} onCheckedChange={(v) => setter(!!v)} />
                    <span className="text-sm">{lbl} (${amt})</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* WTA */}
          {([bs.wta1, bs.wta2, bs.wta3, bs.wta4, bs.wta5] as (number | null)[]).some(Boolean) && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium">WTA (Winner Takes All)</p>
              <div className="flex flex-wrap gap-3">
                {(
                  [
                    [bs.wta1, s.wtaBet1, set.setWtaBet1, "E"],
                    [bs.wta2, s.wtaBet2, set.setWtaBet2, "F"],
                    [bs.wta3, s.wtaBet3, set.setWtaBet3, "G"],
                    [bs.wta4, s.wtaBet4, set.setWtaBet4, "H"],
                    [bs.wta5, s.wtaBet5, set.setWtaBet5, "I"],
                  ] as [number | null, boolean, (v: boolean) => void, string][]
                ).filter(([amt]) => amt != null && amt > 0).map(([amt, checked, setter, lbl]) => (
                  <label key={lbl} className="flex items-center gap-1.5 cursor-pointer select-none">
                    <Checkbox checked={checked} onCheckedChange={(v) => setter(!!v)} />
                    <span className="text-sm">{lbl} (${amt})</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
