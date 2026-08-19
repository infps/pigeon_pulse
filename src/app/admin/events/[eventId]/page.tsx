"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useListEvents } from "@/lib/api/events";
import { useListFeeSchemes } from "@/lib/api/fee-schemes";
import { useListPrizeSchemes } from "@/lib/api/prize-schemes";
import { useListBettingSchemes } from "@/lib/api/betting-schemes";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { SeasonProvider } from "@/lib/season-context";
import { SeasonSelector } from "@/components/season-selector";
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
import { BettingTab } from "./betting-tab";
import { MessagesTab } from "./messages-tab";
import { StationsTab } from "./stations-tab";
import { EventHistoryTab } from "@/app/events/[eventId]/event-history-tab";
import { EventResultTab } from "@/app/events/[eventId]/event-result-tab";
import { DefaultersTab } from "./defaulters-tab";
import { EventStoreTab } from "./event-store-tab";
import { GroupsTab } from "./groups-tab";
import { CalcuttaTab } from "./calcutta-tab";
import { AveragesTab } from "./averages-tab";

export default function EventDetailsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const isSuperAdmin = session?.user?.role === "SUPERADMIN";

  const { data: eventData, isPending, isError } = useListEvents({ params: { eventId } });
  const { data: feeSchemesData } = useListFeeSchemes({});
  const { data: prizeSchemesData } = useListPrizeSchemes({});
  const { data: bettingSchemesData } = useListBettingSchemes({});

  const [activeTab, setActiveTab] = useState("edit");
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set(["edit"]));
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
    <SeasonProvider eventId={eventId}>
    <div className="p-8 w-full mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => router.push("/admin/events")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Events
        </Button>
        <SeasonSelector eventId={eventId} isSuperAdmin={isSuperAdmin} />
      </div>

      <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); setVisitedTabs(prev => new Set(prev).add(val)); }} className="w-full">
        <TabsList className="grid w-full grid-cols-15">
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="breeders">Breeders</TabsTrigger>
          <TabsTrigger value="birds">Birds</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
          <TabsTrigger value="baskets">Baskets</TabsTrigger>
          <TabsTrigger value="races">Races</TabsTrigger>
          <TabsTrigger value="betting">Betting</TabsTrigger>
          <TabsTrigger value="result">Result</TabsTrigger>
          <TabsTrigger value="stations">Stations</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="defaulters">Defaulters</TabsTrigger>
          <TabsTrigger value="store">Store</TabsTrigger>
          <TabsTrigger value="calcutta">Calcutta</TabsTrigger>
          <TabsTrigger value="averages">Averages</TabsTrigger>
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
          {visitedTabs.has("breeders") && <BreedersTab event={event} eventId={eventId} />}
        </TabsContent>

        <TabsContent value="birds" className="mt-6">
          {visitedTabs.has("birds") && <BirdsTab event={event} eventId={eventId} />}
        </TabsContent>

        <TabsContent value="groups" className="mt-6">
          {visitedTabs.has("groups") && <GroupsTab eventId={eventId} />}
        </TabsContent>

        <TabsContent value="baskets" className="mt-6">
          {visitedTabs.has("baskets") && <BasketsTab eventId={eventId} />}
        </TabsContent>

        <TabsContent value="races" className="mt-6">
          {visitedTabs.has("races") && <RacesTab event={event} eventId={eventId} />}
        </TabsContent>

        <TabsContent value="betting" className="mt-6">
          {visitedTabs.has("betting") && <BettingTab event={event} eventId={eventId} />}
        </TabsContent>

        <TabsContent value="result" className="mt-6">
          {visitedTabs.has("result") && <EventResultTab event={event} eventId={eventId} />}
        </TabsContent>

        <TabsContent value="stations" className="mt-6">
          {visitedTabs.has("stations") && <StationsTab eventId={eventId} event={event} />}
        </TabsContent>

        <TabsContent value="messages" className="mt-6">
          {visitedTabs.has("messages") && <MessagesTab eventId={eventId} />}
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          {visitedTabs.has("history") && <EventHistoryTab eventId={eventId} />}
        </TabsContent>

        <TabsContent value="defaulters" className="mt-6">
          {visitedTabs.has("defaulters") && <DefaultersTab eventId={eventId} event={event} />}
        </TabsContent>

        <TabsContent value="calcutta" className="mt-6">
          {visitedTabs.has("calcutta") && <CalcuttaTab eventId={eventId} />}
        </TabsContent>

        <TabsContent value="store" className="mt-6">
          {visitedTabs.has("store") && <EventStoreTab eventId={eventId} />}
        </TabsContent>

        <TabsContent value="averages" className="mt-6">
          {visitedTabs.has("averages") && <AveragesTab eventId={eventId} />}
        </TabsContent>
      </Tabs>
    </div>
    </SeasonProvider>
  );
}
