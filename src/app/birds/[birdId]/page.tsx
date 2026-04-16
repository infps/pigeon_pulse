"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useGetBreederBird } from "@/lib/api/breeder";
import { useApiMutation } from "@/hooks/useApiMutation";
import { apiEndpoints } from "@/lib/endpoints";
import { ImageCapture } from "@/components/image-capture";
import { BirdDetailsPanel } from "./bird-details-panel";
import { PedigreePanel } from "./pedigree-panel";
import type { Bird } from "@/lib/types";

export default function BirdDetailPage({
  params,
}: {
  params: Promise<{ birdId: string }>;
}) {
  const { birdId } = use(params);
  const router = useRouter();

  const { data, isPending, isError, refetch } = useGetBreederBird({ birdId });

  const bird: Bird | undefined = data?.bird;
  const isOwner: boolean = data?.isOwner ?? false;

  const handleImageChange = async (
    imageUrl: string | null,
    imageFile?: File | null
  ) => {
    if (imageFile) {
      // Upload
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
      // Delete
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
        <p className="text-red-500 text-lg mb-4">Bird not found or unavailable.</p>
        <Button variant="outline" onClick={() => router.push("/birds")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to My Birds
        </Button>
      </div>
    );
  }

  const bandDisplay = [bird.band1, bird.band2, bird.band3, bird.band4]
    .filter(Boolean)
    .join("-");

  return (
    <div className="container mx-auto p-6">
      <Button
        variant="ghost"
        onClick={() => router.push("/birds")}
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to My Birds
      </Button>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Image + Name */}
        <div className="space-y-3">
          <ImageCapture
            value={bird.image}
            onChange={handleImageChange}
            disabled={!isOwner}
          />
          <div>
            <h1 className="text-xl font-bold">
              {bird.birdName || "Unnamed Bird"}
            </h1>
            <p className="text-muted-foreground font-mono text-sm">
              {bandDisplay || "No band"}
            </p>
          </div>
        </div>

        {/* Center: Details */}
        <Card>
          <CardContent className="pt-6">
            <BirdDetailsPanel
              bird={bird}
              isOwner={isOwner}
              onUpdate={() => refetch()}
            />
          </CardContent>
        </Card>

        {/* Right: Pedigree */}
        <Card>
          <CardContent className="pt-6">
            <PedigreePanel
              bird={bird}
              isOwner={isOwner}
              onUpdate={() => refetch()}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
