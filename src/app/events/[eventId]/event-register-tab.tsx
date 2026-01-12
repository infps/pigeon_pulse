"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Event } from "@/lib/types";

interface EventRegisterTabProps {
  event: Event;
  eventId: string;
}

export function EventRegisterTab({ event }: EventRegisterTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Register for {event.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12">
          <p className="text-lg text-muted-foreground mb-4">
            Registration functionality coming soon!
          </p>
          <p className="text-sm text-muted-foreground">
            Please contact the event organizer for registration details.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
