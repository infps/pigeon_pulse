"use client";

import { use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useGetBreederEvent } from "@/lib/api/breeder";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ArrowLeft, MapPin } from "lucide-react";
import type { Event } from "@/lib/types";
import { EventBirdsTab } from "./event-birds-tab";
import { EventBreedersTab } from "./event-breeders-tab";
import { EventResultTab } from "./event-result-tab";
import { EventRegisterTab } from "./event-register-tab";
import { EventMessagesTab } from "./event-messages-tab";
import { EventStationsTab } from "./event-stations-tab";
import { EventHistoryTab } from "./event-history-tab";

const VALID_TABS = ["breeders", "birds", "result", "stations", "messages", "history", "register"] as const;

export default function PublicEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab = (VALID_TABS as readonly string[]).includes(tabParam ?? "")
    ? (tabParam as string)
    : "breeders";

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
        {event.locationAddress && (
          <p className="text-center text-sm text-muted-foreground flex items-center justify-center gap-1.5 mt-1">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            Liberation Point: {event.locationAddress}
          </p>
        )}
      </div>

      <Tabs defaultValue={initialTab} className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="breeders">Breeders</TabsTrigger>
          <TabsTrigger value="birds">Birds</TabsTrigger>
          <TabsTrigger value="result">Result</TabsTrigger>
          <TabsTrigger value="stations">Stations</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="register">Register</TabsTrigger>
        </TabsList>

        <TabsContent value="breeders" className="mt-6">
          <EventBreedersTab eventId={eventId} />
        </TabsContent>

        <TabsContent value="birds" className="mt-6">
          <EventBirdsTab eventId={eventId} />
        </TabsContent>

        <TabsContent value="result" className="mt-6">
          <EventResultTab event={event} eventId={eventId} />
        </TabsContent>

        <TabsContent value="stations" className="mt-6">
          <EventStationsTab eventId={eventId} event={event} />
        </TabsContent>

        <TabsContent value="messages" className="mt-6">
          <EventMessagesTab eventId={eventId} />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <EventHistoryTab eventId={eventId} />
        </TabsContent>

        <TabsContent value="register" className="mt-6">
          <EventRegisterTab event={event} eventId={eventId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
