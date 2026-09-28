"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The URL to paste into OBS, and what to do with it.
 *
 * Built from `window.location.origin` rather than a configured host, because
 * the person setting this up is on the machine that will run OBS and the
 * address that works for them is the one they are already looking at — a
 * configured value would be wrong on a laptop at the loft.
 *
 * The instructions are on screen rather than in a manual. Setting up a browser
 * source is four steps done once a season, which is exactly the frequency at
 * which nobody remembers them.
 */
export function ObsSourceField({ raceId }: { raceId: number }) {
  const [copied, setCopied] = useState(false);

  const url =
    typeof window === "undefined"
      ? `/overlay/race/${raceId}`
      : `${window.location.origin}/overlay/race/${raceId}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the field is selectable either way.
    }
  };

  return (
    <div className="space-y-2 md:col-span-2">
      <Label htmlFor="obsUrl">OBS browser source</Label>
      <div className="flex gap-2">
        <Input id="obsUrl" value={url} readOnly className="font-mono text-xs" />
        <Button type="button" variant="outline" size="icon" onClick={copy}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        In OBS: Sources → <b>+</b> → Browser → paste this URL → set 1920 × 1080 → tick
        <b> Shutdown source when not visible</b> off, and leave the page background
        transparent. The overlay draws its own panels and nothing else, so it composites
        straight over your video.
      </p>
    </div>
  );
}
