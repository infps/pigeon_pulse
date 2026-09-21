"use client";

import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import type { EnrichedRaceItem } from "./race-results-columns";
import type { Race } from "@/lib/types";

function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    // youtu.be/ID or youtube.com/watch?v=ID or youtube.com/live/ID
    let id: string | null = null;
    if (u.hostname === "youtu.be") id = u.pathname.slice(1);
    else if (u.hostname.includes("youtube.com")) {
      id = u.searchParams.get("v") ?? u.pathname.split("/").pop() ?? null;
    }
    if (!id) return null;
    return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1`;
  } catch {
    return null;
  }
}

/**
 * Facebook has no id to extract — its player takes the whole post URL as a
 * parameter, so anything that parses as a URL is worth handing over. Muted
 * because a stream that starts making noise on page load is a stream people
 * close.
 */
function getFacebookEmbedUrl(url: string): string | null {
  try {
    new URL(url);
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(
      url
    )}&autoplay=true&mute=true`;
  } catch {
    return null;
  }
}

function formatArrivalTime(d: string): string {
  const dt = new Date(d);
  return `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}:${String(dt.getSeconds()).padStart(2, "0")}.${String(dt.getMilliseconds()).padStart(3, "0")}`;
}

function countryToFlag(code: string | null): string {
  if (!code || code.length !== 2) return "";
  const A = 0x1f1e6;
  const cc = code.toUpperCase();
  return (
    String.fromCodePoint(A + cc.charCodeAt(0) - 65) +
    String.fromCodePoint(A + cc.charCodeAt(1) - 65)
  );
}

interface GoLiveTabProps {
  race: Race;
  enriched: EnrichedRaceItem[];
  released: number;
  returned: number;
  velocityUnit: "YPM" | "MPM";
}

export function GoLiveTab({ race, enriched, released, returned, velocityUnit }: GoLiveTabProps) {
  // YouTube first, then Facebook, then the placeholder. An organiser who has
  // filled in both is streaming to both, and YouTube embeds more reliably.
  const embedUrl =
    (race.youtubeUrl ? getYouTubeEmbedUrl(race.youtubeUrl) : null) ??
    (race.facebookStreamUrl ? getFacebookEmbedUrl(race.facebookStreamUrl) : null);

  // Stats for filter bar
  const arrived = enriched.filter((e) => e.rank != null);
  const stillOut = Math.max(0, released - returned);
  const strays = enriched.filter((e) => (e.status as string) === "FOREIGN_BIRD").length;
  // avg speed of leader
  const leaderSpeed = enriched.find((e) => e.rank === 1)?.ypm ?? null;
  const avgSpeedDisplay = leaderSpeed != null
    ? (velocityUnit === "MPM" ? (leaderSpeed * 0.9144).toFixed(0) : leaderSpeed.toFixed(0))
    : "-";

  // Top 10 with arrival animation
  const top10 = arrived.slice(0, 10);

  const rankColor = (r: number) =>
    r === 1 ? "text-yellow-400" : r === 2 ? "text-gray-300" : r === 3 ? "text-amber-600" : "text-muted-foreground";

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="gap-1.5 text-xs px-2.5 py-1">
          <span className="font-semibold">Arrivals</span> {returned}
        </Badge>
        <Badge variant="outline" className="gap-1.5 text-xs px-2.5 py-1">
          <span className="font-semibold">Avg Speed</span> {avgSpeedDisplay} {velocityUnit}
        </Badge>
        <Badge variant="outline" className="gap-1.5 text-xs px-2.5 py-1 text-orange-600 border-orange-300">
          <span className="font-semibold">Still Out</span> {stillOut}
        </Badge>
        {strays > 0 && (
          <Badge variant="outline" className="gap-1.5 text-xs px-2.5 py-1 text-red-600 border-red-300">
            <span className="font-semibold">Foreign</span> {strays}
          </Badge>
        )}
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-4">
        {/* Left: stream */}
        <div className="rounded-xl overflow-hidden bg-[#0d1117] border border-border aspect-video flex items-center justify-center">
          {embedUrl ? (
            <iframe
              src={embedUrl}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <div className="w-20 h-20 rounded-full overflow-hidden opacity-40">
                {race.event?.logoImage ? (
                  <Image src={race.event.logoImage} alt="" width={80} height={80} className="object-cover" />
                ) : (
                  <div className="w-full h-full bg-muted" />
                )}
              </div>
              <p className="text-sm font-medium">Stream starting soon</p>
            </div>
          )}
        </div>
        {race.facebookPageUrl ? (
          <a
            href={race.facebookPageUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-blue-600 hover:underline md:col-start-1"
          >
            Watch on Facebook →
          </a>
        ) : null}

        {/* Right: top 10 arrivals */}
        <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Arrivals</p>
              <p className="text-sm font-bold">{returned} Clocked</p>
            </div>
            <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-400/30 text-xs">TOP 10</Badge>
          </div>
          <div className="overflow-y-auto flex-1">
            {top10.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                Waiting for arrivals…
              </div>
            ) : (
              <div className="divide-y divide-border">
                {top10.map((item) => {
                  const flag = countryToFlag(item.countryCode);
                  const sexIcon = item.bandSex === 1 ? "♂" : item.bandSex === 2 ? "♀" : "";
                  const sexColor = item.bandSex === 1 ? "text-blue-400" : "text-pink-400";
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40"
                    >
                      {/* Rank */}
                      <span className={`text-lg font-bold w-6 shrink-0 ${rankColor(item.rank ?? 99)}`}>
                        {item.rank}
                      </span>

                      {/* Avatar */}
                      <div className="relative h-9 w-9 rounded-full overflow-hidden bg-muted shrink-0 border border-border">
                        {item.loftImage ? (
                          <Image src={item.loftImage} alt={item.loftName} fill className="object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-[10px] font-bold">
                            {(item.loftName || "?").substring(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold leading-tight truncate">
                          {flag && <span className="mr-1">{flag}</span>}
                          {item.loftName}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate font-mono">
                          {item.band}
                          {sexIcon && <span className={`ml-1 ${sexColor}`}>{sexIcon}</span>}
                          {item.color && <span className="ml-1">· {item.color}</span>}
                        </p>
                      </div>

                      {/* Arrival time */}
                      {item.arrivalTime && (
                        <span className="text-xs font-mono text-right shrink-0 tabular-nums">
                          {formatArrivalTime(item.arrivalTime)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
