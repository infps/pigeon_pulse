"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const ACTION_COLORS: Record<string, string> = {
  GROUP_ASSIGNED: "bg-blue-100 text-blue-700",
  GROUP_MOVED: "bg-amber-100 text-amber-700",
  GROUP_REMOVED: "bg-red-100 text-red-700",
  RFID_LINKED: "bg-purple-100 text-purple-700",
  BASKET_ASSIGNED: "bg-green-100 text-green-700",
  STATUS_CHANGED: "bg-orange-100 text-orange-700",
  RELEASED: "bg-sky-100 text-sky-700",
  ARRIVED: "bg-emerald-100 text-emerald-700",
};

export function BirdEventHistoryPanel({ birdId }: { birdId: string | number }) {
  const { data, isPending } = useQuery({
    queryKey: ["bird-event-history", birdId],
    queryFn: () => fetch(`/api/admin/bird/${birdId}/event-history`).then((r) => r.json()),
  });

  const history: any[] = data?.history ?? [];

  return (
    <Card>
      <CardHeader className="py-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" />
          Event Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No event activity yet.</p>
        ) : (
          <ol className="relative max-h-80 space-y-3 overflow-y-auto border-l pl-4 pr-1">
            {history.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[22px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-background ring-2 ring-border" />
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_COLORS[e.action] ?? "bg-gray-100 text-gray-700"}`}>
                      {e.action.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</span>
                  </div>
                  {e.detail && <p className="text-sm">{e.detail}</p>}
                  {e.performedBy?.name && <p className="text-xs text-muted-foreground">{e.performedBy.name}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
