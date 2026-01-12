"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useGetBreederEvent } from "@/lib/api/breeder";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import type { Event } from "@/lib/types";
import { EventDetailsTab } from "./event-details-tab";
import { EventBirdsTab } from "./event-birds-tab";
import { EventBreedersTab } from "./event-breeders-tab";
import { EventRacesTab } from "./event-races-tab";
import { EventRegisterTab } from "./event-register-tab";

export default function PublicEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  const router = useRouter();

  const { data: eventData, isPending, isError } = useGetBreederEvent({ eventId });

  const event: Event | undefined = eventData?.event;

  if (isPending) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !event) {
    return (
      <div className="container mx-auto p-6 text-center min-h-[400px] flex flex-col items-center justify-center">
        <p className="text-red-500 text-lg mb-4">Event not found or unavailable.</p>
        <Button
          variant="outline"
          onClick={() => router.push("/")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push("/")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Button>
        <h1 className="text-3xl font-bold text-center">{event.name}</h1>
        {event.shortName && (
          <p className="text-center text-muted-foreground mt-2">{event.shortName}</p>
        )}
      </div>

      <Tabs defaultValue="details" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="breeders">Breeders</TabsTrigger>
          <TabsTrigger value="birds">Birds</TabsTrigger>
          <TabsTrigger value="races">Races</TabsTrigger>
          <TabsTrigger value="register">Register</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-6">
          <EventDetailsTab event={event} />
        </TabsContent>

        <TabsContent value="breeders" className="mt-6">
          <EventBreedersTab eventId={eventId} />
        </TabsContent>

        <TabsContent value="birds" className="mt-6">
          <EventBirdsTab eventId={eventId} />
        </TabsContent>

        <TabsContent value="races" className="mt-6">
          <EventRacesTab event={event} eventId={eventId} />
        </TabsContent>

        <TabsContent value="register" className="mt-6">
          <EventRegisterTab event={event} eventId={eventId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
