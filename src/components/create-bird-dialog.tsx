"use client";

import { useReducer, useRef, useState } from "react";
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
  inline,
}: CreateBirdDialogProps) {
  const [state, dispatch] = useReducer(formReducer, createAddBirdFormState());
  const setters = makeSetters(dispatch);
  const bandNumberRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const createMutation = useCreateBird({
    onSuccess: () => {
      toast.success("Bird created successfully");
      dispatch(createAddBirdFormState());
      setImageUrl(null);
      setImageFile(null);
      onSuccess?.();
      onOpenChange(false);
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
        onImageChange={(url, file) => {
          setImageUrl(url ?? null);
          setImageFile(file ?? null);
        }}
      />
      <div className="flex justify-end gap-2 pt-2">
        {!inline && (
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
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
