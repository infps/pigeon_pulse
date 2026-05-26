"use client";

import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare } from "lucide-react";
import { useListBreederEventMessages } from "@/lib/api/event-messages";

interface Author {
  id: string;
  name: string | null;
  lastName: string | null;
  image: string | null;
}

interface EventMessage {
  id: number;
  eventId: number;
  authorId: string;
  title: string | null;
  body: string;
  mediaUrls: string[];
  createdAt: string;
  updatedAt: string;
  author: Author;
}

const VIDEO_RE = /\.(mp4|webm|ogg|mov)$/i;

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function authorName(a: Author): string {
  return [a.name, a.lastName].filter(Boolean).join(" ") || "Unknown";
}

function authorInitial(a: Author): string {
  return (a.name?.[0] || a.lastName?.[0] || "?").toUpperCase();
}

export function EventMessagesTab({ eventId }: { eventId: string }) {
  const { data, isPending, isError, error } = useListBreederEventMessages({ eventId });

  if (isPending) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-red-500 text-center py-8">
        {(error as Error)?.message ?? "Failed to load messages."}
      </p>
    );
  }

  const messages: EventMessage[] = data?.messages ?? [];

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <MessageSquare className="h-12 w-12 mb-3" />
        <p>No messages yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((m) => (
        <Card key={m.id} className="overflow-hidden p-0 gap-0">
          <div className="bg-muted/60 border-b py-3 px-4 flex items-center gap-3">
            <Avatar className="size-10">
              {m.author.image && <AvatarImage src={m.author.image} alt={authorName(m.author)} />}
              <AvatarFallback>{authorInitial(m.author)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              {m.title && <p className="font-bold truncate">{m.title}</p>}
              <p className="text-xs text-muted-foreground">
                {authorName(m.author)} · {formatFullDate(m.createdAt)}
              </p>
            </div>
          </div>
          <CardContent className="p-4 space-y-4">
            <div className="rich-editor-content" dangerouslySetInnerHTML={{ __html: m.body }} />
            {m.mediaUrls.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {m.mediaUrls.map((url, i) => {
                  const isVideo = VIDEO_RE.test(url);
                  if (isVideo) {
                    return (
                      <video
                        key={i}
                        src={url}
                        controls
                        className="w-full rounded-md border bg-black aspect-video object-contain"
                      />
                    );
                  }
                  return (
                    <div
                      key={i}
                      className="relative w-full aspect-square rounded-md overflow-hidden border bg-muted"
                    >
                      <Image
                        src={url}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
