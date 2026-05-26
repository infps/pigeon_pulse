"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useListEvents } from "@/lib/api/events";
import { useListFeeSchemes } from "@/lib/api/fee-schemes";
import { useListPrizeSchemes } from "@/lib/api/prize-schemes";
import { useListBettingSchemes } from "@/lib/api/betting-schemes";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import type { BettingScheme, Event, FeeScheme, PrizeScheme } from "@/lib/types";
import { EditEventTab } from "./edit-event-tab";
import { BreedersTab } from "./breeders-tab";
import { BirdsTab } from "./birds-tab";

import { BasketsTab } from "./baskets-tab";
import { RacesTab } from "./races-tab";
import { RegisterTab } from "./register-tab";
import { MessagesTab } from "./messages-tab";
import { StationsTab } from "./stations-tab";
import { EventHistoryTab } from "@/app/events/[eventId]/event-history-tab";
import { EventResultTab } from "@/app/events/[eventId]/event-result-tab";

export default function EventDetailsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  const router = useRouter();

  const { data: eventData, isPending, isError } = useListEvents({ params: { eventId } });
  const { data: feeSchemesData } = useListFeeSchemes({});
  const { data: prizeSchemesData } = useListPrizeSchemes({});
  const { data: bettingSchemesData } = useListBettingSchemes({});

  const event: Event | undefined = eventData?.event;
  const feeSchemes: FeeScheme[] = feeSchemesData?.feeSchemes || [];
  const prizeSchemes: PrizeScheme[] = prizeSchemesData?.prizeSchemes || [];
  const bettingSchemes: BettingScheme[] = bettingSchemesData?.bettingSchemes || [];

  if (isPending) {
    return (
      <div className="p-8">
        <div className="space-y-4">
          <Skeleton className="h-8 w-62.5" />
          <Skeleton className="h-100 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !event) {
    return (
        <div className="p-8 w-full mx-auto text-center min-h-200 flex flex-col items-center justify-center">
            <p className="text-red-500">Error loading event details. Please try again.</p>
            <Button
              variant="ghost"
              onClick={() => router.push("/admin/events")}
              className="mt-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Events
            </Button>
        </div>
    )
  }

  return (
    <div className="p-8 w-full mx-auto">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push("/admin/events")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Events
        </Button>
        <h1 className="text-3xl font-bold text-center">{event.name}</h1>
      </div>

      <Tabs defaultValue="edit" className="w-full">
        <TabsList className="grid w-full grid-cols-10">
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="breeders">Breeders</TabsTrigger>
          <TabsTrigger value="birds">Birds</TabsTrigger>
          <TabsTrigger value="baskets">Baskets</TabsTrigger>
          <TabsTrigger value="races">Races</TabsTrigger>
          <TabsTrigger value="result">Result</TabsTrigger>
          <TabsTrigger value="stations">Stations</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="register">Register</TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="mt-6">
          <EditEventTab
            event={event}
            eventId={eventId}
            feeSchemes={feeSchemes}
            prizeSchemes={prizeSchemes}
            bettingSchemes={bettingSchemes}
          />
        </TabsContent>

        <TabsContent value="breeders" className="mt-6">
          <BreedersTab event={event} eventId={eventId} />
        </TabsContent>

        <TabsContent value="birds" className="mt-6">
          <BirdsTab event={event} eventId={eventId} />
        </TabsContent>

        <TabsContent value="baskets" className="mt-6">
          <BasketsTab eventId={eventId} />
        </TabsContent>

        <TabsContent value="races" className="mt-6">
          <RacesTab event={event} eventId={eventId} />
        </TabsContent>

        <TabsContent value="result" className="mt-6">
          <EventResultTab event={event} eventId={eventId} />
        </TabsContent>

        <TabsContent value="stations" className="mt-6">
          <StationsTab eventId={eventId} />
        </TabsContent>

        <TabsContent value="messages" className="mt-6">
          <MessagesTab eventId={eventId} />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <EventHistoryTab eventId={eventId} />
        </TabsContent>

        <TabsContent value="register" className="mt-6">
          <RegisterTab event={event} eventId={eventId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
