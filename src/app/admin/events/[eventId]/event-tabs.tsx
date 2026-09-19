"use client";

import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/**
 * The event's nineteen tabs.
 *
 * They used to sit in a fixed nineteen-column grid, which gave every tab the
 * same width whatever its label: "Result" floated in a wide empty cell while
 * "Accounting" pressed against its edges, and because permissions hide some
 * tabs, the remaining ones kept the gaps of the ones that were gone. The strip
 * read as ragged because the layout was describing a grid that was no longer
 * there.
 *
 * Now each tab takes the width of its own label and the row wraps. The order
 * is grouped by the job being done — setting the event up, running the racing,
 * handling the money, publishing to breeders — with a little extra air between
 * groups, so the eye has four landmarks instead of nineteen equal words.
 */
interface TabDef {
  value: string;
  label: string;
  /** Permission that must be held for this tab to appear. */
  permission: string;
  /** First tab of a group: gets the extra space that separates clusters. */
  startsGroup?: boolean;
}

const TABS: TabDef[] = [
  // Setting the event up
  { value: "details", label: "Details", permission: "events.view" },
  { value: "breeders", label: "Breeders", permission: "breeders.view" },
  { value: "birds", label: "Birds", permission: "birds.view" },
  { value: "groups", label: "Groups", permission: "groups.view" },
  { value: "baskets", label: "Baskets", permission: "baskets.view" },
  { value: "stations", label: "Stations", permission: "stations.view" },

  // Running the racing
  { value: "races", label: "Races", permission: "races.view", startsGroup: true },
  { value: "result", label: "Result", permission: "races.view" },
  { value: "averages", label: "Averages", permission: "races.view" },
  { value: "tournaments", label: "Knockout", permission: "tournaments.view" },
  { value: "classes", label: "Classes", permission: "classes.view" },

  // Handling the money
  { value: "betting", label: "Betting", permission: "betting.view", startsGroup: true },
  { value: "calcutta", label: "Calcutta", permission: "calcutta.view" },
  { value: "store", label: "Store", permission: "store.view" },
  { value: "defaulters", label: "Defaulters", permission: "payments.view" },
  { value: "accounting", label: "Accounting", permission: "accounting.view" },

  // Publishing to breeders
  { value: "messages", label: "Messages", permission: "messages.view", startsGroup: true },
  { value: "history", label: "History", permission: "birds.view" },
  { value: "content", label: "Rules", permission: "content.view" },
];

export function EventTabsList({
  isAllowed,
}: {
  /** True while permissions are still loading, so the strip does not flash empty. */
  isAllowed: (permission: string) => boolean;
}) {
  const visible = TABS.filter((tab) => isAllowed(tab.permission));

  return (
    <TabsList
      className={cn(
        "h-auto w-full flex-wrap justify-start gap-1 rounded-xl p-1.5",
        // The list is a landmark on a dense page, so it gets a border rather
        // than relying on the muted fill alone.
        "border border-border/60"
      )}
    >
      {visible.map((tab, index) => (
        <TabsTrigger
          key={tab.value}
          value={tab.value}
          className={cn(
            "h-8 flex-none rounded-lg px-3 text-sm",
            "data-[state=active]:bg-background data-[state=active]:shadow-sm",
            "text-muted-foreground data-[state=active]:text-foreground",
            // Extra air ahead of a new group. Never on the first tab, where it
            // would just push the strip off its own left edge.
            tab.startsGroup && index > 0 && "ml-4"
          )}
        >
          {tab.label}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}
