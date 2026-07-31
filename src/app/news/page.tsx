"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Newspaper } from "lucide-react";
import { useListBreederMessages } from "@/lib/api/event-messages";
import { plainSnippet } from "@/lib/text";

interface NewsMessage {
  id: number;
  eventId: number;
  title: string | null;
  body: string;
  mediaUrls: string[];
  createdAt: string;
  event: {
    id: number;
    name: string;
    shortName: string | null;
    logoImage: string | null;
    bannerImage: string | null;
  };
}

export default function NewsPage() {
  const router = useRouter();
  const [limit, setLimit] = useState(20);
  const { data, isPending } = useListBreederMessages({ limit, offset: 0 });

  const messages: NewsMessage[] = (data?.messages ?? []).filter(
    (m: NewsMessage) => m?.event?.id
  );
  const total: number = data?.total ?? 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <Button variant="ghost" onClick={() => router.push("/")} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Button>
        <div className="flex items-center gap-2">
          <Newspaper className="h-5 w-5" />
          <h1 className="text-2xl font-bold">News & Updates</h1>
          {!isPending && <Badge variant="secondary" className="text-xs">{total}</Badge>}
        </div>
      </div>

      {isPending ? (
        <div className="rounded-md border divide-y">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-none" />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Newspaper className="h-12 w-12 mb-3" />
          <p>No messages yet.</p>
        </div>
      ) : (
        <>
          <div className="rounded-md border divide-y">
            {messages.map((m) => (
              <Link
                key={m.id}
                href={`/events/${m.event.id}?tab=messages`}
                className="flex items-start gap-3 p-4 hover:bg-muted/50 transition-colors"
              >
                {m.event.logoImage ? (
                  <div className="relative w-10 h-10 rounded-full overflow-hidden border bg-white shrink-0">
                    <Image src={m.event.logoImage} alt={m.event.name} fill className="object-contain p-1" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-linear-to-br from-indigo-500 to-purple-500 flex items-center justify-center shrink-0">
                    <span className="text-white font-bold text-xs">
                      {m.event.name.substring(0, 2).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">
                    {new Date(m.createdAt).toLocaleDateString()} — {m.event.name}
                    {m.title && <span className="text-muted-foreground"> · {m.title}</span>}
                  </p>
                  <p className="text-sm text-muted-foreground line-clamp-3 mt-1">
                    {plainSnippet(m.body, 300)}
                  </p>
                  <span className="text-xs text-purple-600 mt-1 inline-block">Read More →</span>
                </div>
              </Link>
            ))}
          </div>

          {messages.length < total && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => setLimit((l) => l + 20)}>
                Load More
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
