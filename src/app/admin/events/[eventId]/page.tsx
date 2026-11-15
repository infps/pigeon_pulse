"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
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
import { ArrowLeft, HelpCircle } from "lucide-react";
import { GuidedTour } from "@/components/guided-tour";
import { tabHelp } from "@/lib/help-content";
import type { BettingScheme, Event, FeeScheme, PrizeScheme } from "@/lib/types";
import { DetailsTab } from "./details-tab";
import { usePermissions } from "@/hooks/usePermissions";

// Non-default tabs code-split: chunk fetched only when tab first opened (messages pulls tiptap ~750KB).
const TabLoading = () => <Skeleton className="h-64 w-full" />;
const BreedersTab = dynamic(() => import("./breeders-tab").then((m) => m.BreedersTab), { loading: TabLoading });
const BirdsTab = dynamic(() => import("./birds-tab").then((m) => m.BirdsTab), { loading: TabLoading });
const BasketsTab = dynamic(() => import("./baskets-tab").then((m) => m.BasketsTab), { loading: TabLoading });
const RacesTab = dynamic(() => import("./races-tab").then((m) => m.RacesTab), { loading: TabLoading });
const BettingTab = dynamic(() => import("./betting-tab").then((m) => m.BettingTab), { loading: TabLoading });
const MessagesTab = dynamic(() => import("./messages-tab").then((m) => m.MessagesTab), { loading: TabLoading });
const StationsTab = dynamic(() => import("./stations-tab").then((m) => m.StationsTab), { loading: TabLoading });
const EventHistoryTab = dynamic(() => import("@/app/events/[eventId]/event-history-tab").then((m) => m.EventHistoryTab), { loading: TabLoading });
const EventResultTab = dynamic(() => import("@/app/events/[eventId]/event-result-tab").then((m) => m.EventResultTab), { loading: TabLoading });
const DefaultersTab = dynamic(() => import("./defaulters-tab").then((m) => m.DefaultersTab), { loading: TabLoading });
const EventStoreTab = dynamic(() => import("./event-store-tab").then((m) => m.EventStoreTab), { loading: TabLoading });
const GroupsTab = dynamic(() => import("./groups-tab").then((m) => m.GroupsTab), { loading: TabLoading });
const CalcuttaTab = dynamic(() => import("./calcutta-tab").then((m) => m.CalcuttaTab), { loading: TabLoading });
const AveragesTab = dynamic(() => import("./averages-tab").then((m) => m.AveragesTab), { loading: TabLoading });
const AvgSpeedPrizesCard = dynamic(() => import("./avg-speed-prizes-card").then((m) => m.AvgSpeedPrizesCard), { loading: TabLoading });
const TournamentsTab = dynamic(() => import("./tournaments-tab").then((m) => m.TournamentsTab), { loading: TabLoading });
const ClassesTab = dynamic(() => import("./classes-tab").then((m) => m.ClassesTab), { loading: TabLoading });
const ContentTab = dynamic(() => import("./content-tab").then((m) => m.ContentTab), { loading: TabLoading });
const AccountingTab = dynamic(() => import("./accounting-tab").then((m) => m.AccountingTab), { loading: TabLoading });

export default function EventDetailsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const isSuperAdmin = session?.user?.role === "SUPERADMIN";

  const { data: eventData, isPending, isError } = useListEvents({ params: { eventId } });
  const { data: feeSchemesData } = useListFeeSchemes({});
  const { data: prizeSchemesData } = useListPrizeSchemes({});
  const { data: bettingSchemesData } = useListBettingSchemes({});

  const [activeTab, setActiveTab] = useState("details");
  const [tourOpen, setTourOpen] = useState(false);


  // Tabs are hidden when the viewer lacks the permission behind them. While

  // permissions are still loading every tab shows, so the page does not flash

  // empty for someone who does have access.

  const { can, isPending: permissionsLoading } = usePermissions();

  const tabAllowed = (permission: string) => permissionsLoading || can(permission);
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set(["details"]));
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setTourOpen(true)}>
            <HelpCircle className="h-4 w-4 mr-2" />
            Take a tour
          </Button>
          <SeasonSelector eventId={eventId} isSuperAdmin={isSuperAdmin} />
        </div>
      </div>

      {tourOpen && (
        <GuidedTour
          onGoToTab={(tab) => {
            setActiveTab(tab);
            setVisitedTabs((prev) => new Set(prev).add(tab));
          }}
          onClose={() => setTourOpen(false)}
        />
      )}

      <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); setVisitedTabs(prev => new Set(prev).add(val)); }} className="w-full">
        <TabsList className="grid w-full grid-cols-19">
          {tabAllowed("events.view") && <TabsTrigger value="details" data-tour="details" title={tabHelp.details.blurb}>Details</TabsTrigger>}
          {tabAllowed("breeders.view") && <TabsTrigger value="breeders" data-tour="breeders" title={tabHelp.breeders.blurb}>Breeders</TabsTrigger>}
          {tabAllowed("birds.view") && <TabsTrigger value="birds" data-tour="birds" title={tabHelp.birds.blurb}>Birds</TabsTrigger>}
          {tabAllowed("groups.view") && <TabsTrigger value="groups" data-tour="groups" title={tabHelp.groups.blurb}>Groups</TabsTrigger>}
          {tabAllowed("baskets.view") && <TabsTrigger value="baskets" data-tour="baskets" title={tabHelp.baskets.blurb}>Baskets</TabsTrigger>}
          {tabAllowed("races.view") && <TabsTrigger value="races" data-tour="races" title={tabHelp.races.blurb}>Races</TabsTrigger>}
          {tabAllowed("betting.view") && <TabsTrigger value="betting" data-tour="betting" title={tabHelp.betting.blurb}>Betting</TabsTrigger>}
          {tabAllowed("races.view") && <TabsTrigger value="result" data-tour="result" title={tabHelp.result.blurb}>Result</TabsTrigger>}
          {tabAllowed("stations.view") && <TabsTrigger value="stations" data-tour="stations" title={tabHelp.stations.blurb}>Stations</TabsTrigger>}
          {tabAllowed("messages.view") && <TabsTrigger value="messages" data-tour="messages" title={tabHelp.messages.blurb}>Messages</TabsTrigger>}
          {tabAllowed("birds.view") && <TabsTrigger value="history" data-tour="history" title={tabHelp.history.blurb}>History</TabsTrigger>}
          {tabAllowed("payments.view") && <TabsTrigger value="defaulters" data-tour="defaulters" title={tabHelp.defaulters.blurb}>Defaulters</TabsTrigger>}
          {tabAllowed("store.view") && <TabsTrigger value="store" data-tour="store" title={tabHelp.store.blurb}>Store</TabsTrigger>}
          {tabAllowed("calcutta.view") && <TabsTrigger value="calcutta" data-tour="calcutta" title={tabHelp.calcutta.blurb}>Calcutta</TabsTrigger>}
          {tabAllowed("races.view") && <TabsTrigger value="averages" data-tour="averages" title={tabHelp.averages.blurb}>Averages</TabsTrigger>}
          {tabAllowed("tournaments.view") && <TabsTrigger value="tournaments" data-tour="tournaments" title={tabHelp.tournaments.blurb}>Knockout</TabsTrigger>}
          {tabAllowed("classes.view") && <TabsTrigger value="classes" data-tour="classes" title={tabHelp.classes.blurb}>Classes</TabsTrigger>}
          {tabAllowed("content.view") && <TabsTrigger value="content" data-tour="content" title={tabHelp.content.blurb}>Rules</TabsTrigger>}
          {tabAllowed("accounting.view") && <TabsTrigger value="accounting" data-tour="accounting" title={tabHelp.accounting.blurb}>Accounting</TabsTrigger>}
        </TabsList>

        <TabsContent value="details" className="mt-6">
          <DetailsTab
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
          {visitedTabs.has("averages") && (
            <div className="space-y-6">
              <AveragesTab eventId={eventId} />
              <AvgSpeedPrizesCard eventId={eventId} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="tournaments" className="mt-6">
          {visitedTabs.has("tournaments") && <TournamentsTab eventId={eventId} />}
        </TabsContent>

        <TabsContent value="classes" className="mt-6">
          {visitedTabs.has("classes") && <ClassesTab eventId={eventId} />}
        </TabsContent>

        <TabsContent value="content" className="mt-6">
          {visitedTabs.has("content") && <ContentTab eventId={eventId} />}
        </TabsContent>

        <TabsContent value="accounting" className="mt-6">
          {visitedTabs.has("accounting") && <AccountingTab eventId={eventId} />}
        </TabsContent>
      </Tabs>
    </div>
    </SeasonProvider>
  );
}
