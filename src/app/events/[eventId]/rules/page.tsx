"use client";

import { use, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Printer } from "lucide-react";

interface Section {
  id: number;
  title: string;
  body: string;
  updatedAt: string;
}

interface RulesPayload {
  event: {
    id: number;
    name: string | null;
    shortName: string | null;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    contactAddress: string | null;
  };
  season: { id: number; name: string; startDate: string; endDate: string };
  sections: Section[];
}

/**
 * The event's rules and fees, readable without an account.
 *
 * These are the terms a breeder agrees to by entering, so they stay public even
 * when the rest of the event is gated — somebody deciding whether to enter has
 * to be able to read them first.
 */
export default function EventRulesPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const [data, setData] = useState<RulesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/public/event/${eventId}/rules`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.message ?? "These rules are not available.");
          return;
        }
        setData(await res.json());
      })
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading) {
    return (
      <div className="container mx-auto max-w-3xl p-6 space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto max-w-3xl p-6">
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            {error ?? "These rules are not available."}
          </CardContent>
        </Card>
      </div>
    );
  }

  const { event, season, sections } = data;

  return (
    <div className="container mx-auto max-w-3xl p-6">
      <div className="flex items-start justify-between gap-4 mb-2 print:mb-1">
        <div>
          <h1 className="text-2xl font-bold">Event Rules &amp; Fees</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {event.name}
            {season?.name ? ` · ${season.name}` : ""}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-3.5 w-3.5" />
            Print
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a
              href={`/api/admin/reports/rules-and-fees?format=pdf&seasonId=${season.id}`}
              target="_blank"
              rel="noopener"
            >
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              PDF
            </a>
          </Button>
        </div>
      </div>

      {sections.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="py-16 text-center text-muted-foreground">
            <FileText className="mx-auto mb-3 h-10 w-10" />
            <p className="text-sm">
              The organizer has not published rules for this season yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6 mt-6">
          {sections.map((section) => (
            <section key={section.id} className="break-inside-avoid">
              <h2 className="text-lg font-semibold border-b pb-1.5 mb-3">{section.title}</h2>
              <div
                className="prose prose-sm dark:prose-invert max-w-none
                  prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 prose-headings:mt-4"
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.body}</ReactMarkdown>
              </div>
            </section>
          ))}
        </div>
      )}

      {(event.contactName || event.contactEmail || event.contactPhone) && (
        <div className="mt-10 pt-4 border-t text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Questions</p>
          {event.contactName && <p>{event.contactName}</p>}
          {event.contactPhone && <p>{event.contactPhone}</p>}
          {event.contactEmail && <p>{event.contactEmail}</p>}
          {event.contactAddress && <p>{event.contactAddress}</p>}
        </div>
      )}

      <p className="mt-8 text-xs text-muted-foreground">
        By sending your birds to this race you agree to these rules.
      </p>
    </div>
  );
}
