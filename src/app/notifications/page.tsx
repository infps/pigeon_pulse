"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell } from "lucide-react";

interface Notification {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

const SAMPLE: Notification[] = [];

export default function NotificationsPage() {
  const notifications: Notification[] = SAMPLE;

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Bell className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Notifications</h1>
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Bell className="h-12 w-12 mb-3" />
            <p>No notifications yet.</p>
            <p className="text-xs mt-1">You&apos;ll see race updates, event announcements and payment alerts here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <Card key={n.id} className={n.read ? "opacity-70" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{n.title}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {new Date(n.createdAt).toLocaleString()}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">{n.body}</CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
