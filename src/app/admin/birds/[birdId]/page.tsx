"use client";

import { use, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, User } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { useBird, useUpdateBird } from "@/lib/api/bird";
import { apiEndpoints } from "@/lib/endpoints";
import { ImageCapture } from "@/components/image-capture";
import { BirdHistoryPanel } from "./bird-history-panel";
import { BirdActions } from "./bird-actions";
import { BirdPropertiesCard } from "./bird-properties-card";
import { BirdFeesCard } from "./bird-fees-card";
import { BirdClassesCard } from "./bird-classes-card";
import { BirdNotesCard } from "./bird-notes-card";
import type { InventoryItemView } from "./bird-event-section";
import type { Bird, UserRole } from "@/lib/types";

interface BirdResponse {
  bird?: Bird & {
    inventoryItems?: InventoryItemView[];
  };
  isOwner?: boolean;
}

export default function BirdDetailPage({
  params,
}: {
  params: Promise<{ birdId: string }>;
}) {
  const { birdId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventIdParam = searchParams.get("eventId");
  const eventContextId = eventIdParam ? parseInt(eventIdParam) : null;
  const { data: session } = authClient.useSession();
  const role = session?.user?.role as UserRole | undefined;
  const isAdmin = role === "ADMIN" || role === "SUPERADMIN";

  const { data, isPending, isError, refetch } = useBird(
    birdId,
    role ?? "BREEDER"
  );
  const resp = data as BirdResponse | undefined;
  const bird = resp?.bird;
  const isOwner = isAdmin || (resp?.isOwner ?? false);

  const updateBird = useUpdateBird(birdId);
  const [attentionOptimistic, setAttentionOptimistic] = useState<
    boolean | null
  >(null);

  const handleImageChange = async (
    imageUrl: string | null,
    imageFile?: File | null
  ) => {
    if (imageFile) {
      const formData = new FormData();
      formData.append("image", imageFile);
      try {
        const res = await fetch(apiEndpoints.breeder.birdImage(birdId), {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          toast.success("Image uploaded");
          refetch();
        } else {
          toast.error("Failed to upload image");
        }
      } catch {
        toast.error("Failed to upload image");
      }
    } else {
      try {
        const res = await fetch(apiEndpoints.breeder.birdImage(birdId), {
          method: "DELETE",
        });
        if (res.ok) {
          toast.success("Image removed");
          refetch();
        } else {
          toast.error("Failed to remove image");
        }
      } catch {
        toast.error("Failed to remove image");
      }
    }
  };

  if (isPending) {
    return (
      <div className="container mx-auto p-6">
        <Skeleton className="h-8 w-24 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="aspect-square rounded-lg" />
          <Skeleton className="h-80 rounded-lg" />
          <Skeleton className="h-80 rounded-lg" />
        </div>
      </div>
    );
  }

  if (isError || !bird) {
    return (
      <div className="container mx-auto p-6 text-center min-h-[400px] flex flex-col items-center justify-center">
        <p className="text-red-500 text-lg mb-4">
          Bird not found or unavailable.
        </p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
      </div>
    );
  }

  const bandDisplay = [bird.band1, bird.band2, bird.band3, bird.band4]
    .filter(Boolean)
    .join("-");
  const allItems = bird.inventoryItems ?? [];
  const scopedItems =
    eventContextId != null
      ? allItems.filter((it) => it.eventInventory?.event?.id === eventContextId)
      : allItems;
  const showEventScopedCards = eventContextId != null && scopedItems.length > 0;
  const ownerName = bird.breeder
    ? [bird.breeder.firstName, bird.breeder.lastName]
        .filter(Boolean)
        .join(" ") || "Unknown"
    : "Unknown";
  const chipA = [bird.band1, bird.band2].filter(Boolean).join("-");
  const chipB = [bird.band3, bird.band4].filter(Boolean).join("-");

  const attentionValue =
    attentionOptimistic ?? bird.attention ?? false;

  const handleAttentionToggle = async (next: boolean) => {
    setAttentionOptimistic(next);
    try {
      await updateBird.mutateAsync({ attention: next });
      toast.success(next ? "Marked for attention" : "Attention cleared");
      refetch();
    } catch {
      setAttentionOptimistic(!next);
      toast.error("Failed to update");
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:row-span-2">
          <CardContent className="pt-6 space-y-4">
            <ImageCapture
              value={bird.image}
              onChange={handleImageChange}
              disabled={!isOwner}
            />

            {(chipA || chipB) && (
              <div className="flex flex-wrap gap-2">
                {chipA && (
                  <Badge variant="outline" className="font-mono">
                    {chipA}
                  </Badge>
                )}
                {chipB && (
                  <Badge variant="outline" className="font-mono">
                    {chipB}
                  </Badge>
                )}
              </div>
            )}

            <div>
              <h1 className="text-2xl font-bold leading-tight">
                {bird.birdName || "Unnamed Bird"}
              </h1>
              <p className="text-muted-foreground font-mono text-xs mt-1">
                {bandDisplay || "No band"}
              </p>
            </div>

            {isAdmin && (
              <BirdActions bird={bird} onUpdated={() => refetch()} />
            )}

            {isAdmin && (
              <div className="flex items-center justify-between pt-2 border-t">
                <Label
                  htmlFor="attention-toggle"
                  className="text-sm font-normal"
                >
                  Pay attention during basketing
                </Label>
                <Switch
                  id="attention-toggle"
                  checked={attentionValue}
                  onCheckedChange={handleAttentionToggle}
                  disabled={updateBird.isPending}
                />
              </div>
            )}

            <div className="flex items-center gap-2 pt-2 border-t text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Owner</span>
              <span className="ml-auto font-medium">{ownerName}</span>
            </div>
          </CardContent>
        </Card>

        <BirdPropertiesCard bird={bird} />
        {showEventScopedCards ? (
          <BirdFeesCard items={scopedItems} />
        ) : (
          <BirdHistoryPanel birdId={birdId} />
        )}
        {showEventScopedCards && <BirdClassesCard items={scopedItems} />}
        {showEventScopedCards && <BirdHistoryPanel birdId={birdId} />}
      </div>

      <BirdNotesCard
        birdId={birdId}
        note={bird.note}
        canEdit={isAdmin}
        onUpdated={() => refetch()}
      />
    </div>
  );
}
