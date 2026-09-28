"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import { toast } from "sonner";

type NotificationKind =
  | "RACE_STARTED"
  | "BIRD_ARRIVED"
  | "RACE_ENDED"
  | "BETTING_OPEN"
  | "PAYMENT_DUE"
  | "EVENT_MESSAGE"
  | "BIRD_LOST"
  | "STORE_LISTING";

interface Notification {
  id: number;
  kind: NotificationKind;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

const KIND_LABEL: Record<NotificationKind, string> = {
  RACE_STARTED: "Race released",
  BIRD_ARRIVED: "Arrival",
  RACE_ENDED: "Results",
  BETTING_OPEN: "Betting",
  PAYMENT_DUE: "Payment",
  EVENT_MESSAGE: "Announcement",
  BIRD_LOST: "Lost bird",
  STORE_LISTING: "Event store",
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=100");
      if (!res.ok) {
        if (res.status !== 401) toast.error("Could not load notifications");
        return;
      }
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Race day moves quickly, so the feed refreshes itself.
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  const markAllRead = async () => {
    setMarking(true);
    try {
      const res = await fetch("/api/notifications", { method: "POST" });
      if (!res.ok) {
        toast.error("Could not mark notifications as read");
        return;
      }
      await load();
    } finally {
      setMarking(false);
    }
  };

  const markOneRead = async (id: number) => {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Notifications</h1>
          {unreadCount > 0 && <Badge>{unreadCount} unread</Badge>}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead} disabled={marking}>
            <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
            {marking ? "Marking…" : "Mark all read"}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <BellOff className="h-12 w-12 mb-3" />
            <p>Nothing yet.</p>
            <p className="text-xs mt-1">
              Race releases, arrivals, results, betting and payment reminders land here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const unread = n.readAt == null;
            const card = (
              <Card
                className={
                  unread ? "border-l-2 border-l-primary" : "opacity-75"
                }
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-start justify-between gap-3">
                    <span className="leading-snug">{n.title}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        {KIND_LABEL[n.kind] ?? n.kind}
                      </Badge>
                      <span className="text-xs font-normal text-muted-foreground">
                        {relativeTime(n.createdAt)}
                      </span>
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{n.body}</CardContent>
              </Card>
            );

            return (
              <div key={n.id} onClick={() => unread && markOneRead(n.id)}>
                {n.link ? (
                  <Link href={n.link} className="block no-underline">
                    {card}
                  </Link>
                ) : (
                  card
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
