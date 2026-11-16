"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Race } from "@/lib/types";

// OBS overlay + stream links for the people running the broadcast (admin race page).
function CopyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
      <div className="flex gap-2">
        <Input value={value} readOnly className="font-mono text-xs h-8" />
        <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={copy}>
          {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
        <a href={value} target="_blank" rel="noreferrer">
          <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0">
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </a>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function LinksDialog({ open, onClose, race }: { open: boolean; onClose: () => void; race: Race }) {
  const obsUrl = typeof window === "undefined"
    ? `/overlay/race/${race.id}`
    : `${window.location.origin}/overlay/race/${race.id}`;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4" /> Broadcast &amp; Social Links
          </DialogTitle>
          <DialogDescription>Copy or open links for OBS and social platforms.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <CopyField
            label="OBS Browser Source"
            value={obsUrl}
            hint="Sources → + → Browser → paste → 1920×1080"
          />
          {race.youtubeUrl && (
            <CopyField label="YouTube Stream" value={race.youtubeUrl} />
          )}
          {race.facebookStreamUrl && (
            <CopyField label="Facebook Video" value={race.facebookStreamUrl} hint="Used to embed the player." />
          )}
          {race.facebookPageUrl && (
            <CopyField label="Facebook Page" value={race.facebookPageUrl} hint="Watch on Facebook link." />
          )}
          {!race.youtubeUrl && !race.facebookStreamUrl && !race.facebookPageUrl && (
            <p className="text-sm text-muted-foreground">No social links set. Add them in the race edit form.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
