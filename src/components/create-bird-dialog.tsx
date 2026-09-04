"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useCreateBird } from "@/lib/api/event-inventory-item";
import type { Event } from "@/lib/types";
import {
  AddBirdForm,
  createAddBirdFormState,
  validateAddBirdForm,
  buildAddBirdPayload,
} from "@/components/add-bird-form";
import type { AddBirdFormState } from "@/components/add-bird-form";
import { apiEndpoints } from "@/lib/endpoints";

interface CreateBirdDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventInventoryId: number;
  breederId: number;
  event: Event;
  onSuccess?: () => void;
  onAddAnother?: () => void;
  inline?: boolean;
}

function formReducer(s: AddBirdFormState, patch: Partial<AddBirdFormState>): AddBirdFormState {
  return { ...s, ...patch };
}

function makeSetters(dispatch: React.Dispatch<Partial<AddBirdFormState>>) {
  const keys = Object.keys(createAddBirdFormState()) as (keyof AddBirdFormState)[];
  return Object.fromEntries(
    keys.map((k) => [
      `set${k.charAt(0).toUpperCase()}${k.slice(1)}`,
      (v: AddBirdFormState[typeof k]) => dispatch({ [k]: v } as Partial<AddBirdFormState>),
    ])
  ) as any;
}

export function CreateBirdDialog({
  open,
  onOpenChange,
  eventInventoryId,
  breederId,
  event,
  onSuccess,
  onAddAnother,
  inline,
}: CreateBirdDialogProps) {
  const [state, dispatch] = useReducer(formReducer, createAddBirdFormState());
  const setters = makeSetters(dispatch);
  const bandNumberRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const addAnotherRef = useRef(false);

  // RFID poll scanner
  const [isPolling, setIsPolling] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollStartedAtRef = useRef<string | null>(null);
  const lastScannedRfidRef = useRef<string | null>(null);

  const pollOnce = useCallback(async () => {
    try {
      const res = await fetch("/api/scanner/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startedAt: pollStartedAtRef.current }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0 && data[0].el) {
        const rfid: string = data[0].el;
        if (rfid !== lastScannedRfidRef.current) {
          lastScannedRfidRef.current = rfid;
          dispatch({ rfid });
          stopPolling();
        }
      }
    } catch { /* network, ignore */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) return;
    setIsPolling(true);
    lastScannedRfidRef.current = null;
    pollStartedAtRef.current = new Date().toISOString();
    toast.success("Scanner connected");
    pollIntervalRef.current = setInterval(pollOnce, 2000);
  }, [pollOnce]);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  // Cleanup on unmount / close
  useEffect(() => {
    if (!open) stopPolling();
  }, [open, stopPolling]);

  const createMutation = useCreateBird({
    onSuccess: () => {
      toast.success("Bird created successfully");
      const keepBand = { band1: state.band1, band2: state.band2, band3: state.band3 };
      const nextBand4 = String((parseInt(state.band4) || 0) + 1);
      dispatch(createAddBirdFormState());
      setImageUrl(null);
      setImageFile(null);
      onSuccess?.();
      if (addAnotherRef.current) {
        addAnotherRef.current = false;
        dispatch({ ...keepBand, band4: nextBand4 });
        onAddAnother?.();
      } else {
        onOpenChange(false);
      }
    },
  });

  async function uploadImage(birdId: number, file: File) {
    const fd = new FormData();
    fd.append("image", file);
    const res = await fetch(apiEndpoints.breeder.birdImage(birdId), { method: "POST", body: fd });
    if (!res.ok) toast.error("Bird created but image upload failed");
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateAddBirdForm(state);
    if (err) { toast.error(err); return; }

    const payload = buildAddBirdPayload(state, breederId);

    const result = await createMutation.mutateAsync({
      eventInventoryId,
      breederId: payload.breederId,
      band1: payload.band1,
      band2: payload.band2,
      band3: payload.band3,
      band4: payload.band4,
      birdName: payload.name,
      color: payload.color,
      sex: payload.sex,
      rfid: payload.rfid ?? null,
      isActive: payload.isActive,
      isLost: payload.isLost,
      lostDate: payload.lostDate,
      lostRaceId: payload.lostRaceId,
      note: payload.note,
      arrivalTime: payload.arrivalTime,
      departureTime: payload.departureTime,
      isBackup: payload.isBackup,
      belgianShowBet1: payload.belgianShowBet1,
      belgianShowBet2: payload.belgianShowBet2,
      belgianShowBet3: payload.belgianShowBet3,
      belgianShowBet4: payload.belgianShowBet4,
      belgianShowBet5: payload.belgianShowBet5,
      belgianShowBet6: payload.belgianShowBet6,
      belgianShowBet7: payload.belgianShowBet7,
      standardShowBet1: payload.standardShowBet1,
      standardShowBet2: payload.standardShowBet2,
      standardShowBet3: payload.standardShowBet3,
      standardShowBet4: payload.standardShowBet4,
      standardShowBet5: payload.standardShowBet5,
      wtaBet1: payload.wtaBet1,
      wtaBet2: payload.wtaBet2,
      wtaBet3: payload.wtaBet3,
      wtaBet4: payload.wtaBet4,
      wtaBet5: payload.wtaBet5,
    });

    const createdBirdId = (result as any)?.data?.bird?.id ?? (result as any)?.data?.inventoryItem?.bird?.id;
    if (createdBirdId && imageFile) await uploadImage(createdBirdId, imageFile);
  };

  const bs = event.bettingScheme ?? null;
  const fs = event.feeScheme ?? null;
  const schemeDefaults = fs ? {
    entryFee: fs.entryFee ?? null,
    birdFee: fs.birdFeeItems?.[0]?.birdFee ?? null,
    hotSpot1Fee: fs.hotSpot1Fee ?? null,
    hotSpot2Fee: fs.hotSpot2Fee ?? null,
    hotSpot3Fee: fs.hotSpot3Fee ?? null,
    hotSpotFinalFee: fs.hotSpotFinalFee ?? null,
  } : null;

  const form = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <AddBirdForm
        state={state}
        setters={setters}
        bettingScheme={bs}
        showFees
        showClasses
        bandNumberRef={bandNumberRef}
        imageUrl={imageUrl}
        schemeDefaults={schemeDefaults}
        onImageChange={(url, file) => {
          setImageUrl(url ?? null);
          setImageFile(file ?? null);
        }}
        rfidPolling={isPolling}
        onStartRfidPoll={startPolling}
        onStopRfidPoll={stopPolling}
      />
      <div className="flex justify-end gap-2 pt-2">
        {!inline && (
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        )}
        {onAddAnother && (
          <Button type="submit" variant="secondary" disabled={createMutation.isPending}
            onClick={() => { addAnotherRef.current = true; }}>
            {createMutation.isPending ? "Saving…" : "Add Another"}
          </Button>
        )}
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Creating..." : "Create Bird"}
        </Button>
      </div>
    </form>
  );

  if (inline) return form;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Bird</DialogTitle>
        </DialogHeader>
        {form}
      </DialogContent>
    </Dialog>
  );
}
