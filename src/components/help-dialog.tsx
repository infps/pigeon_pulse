"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { sidebarHelp, tabHelp } from "@/lib/help-content";

// Feature guide opened from the sidebar "Help" entry. Read-only reference of
// what every main section and event tab does.
export function HelpDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Help & Feature Guide</DialogTitle>
          <DialogDescription>
            A quick tour of what each part of Pigeon Pulse does. Look for the
            info icon next to titles for tips right where you work.
          </DialogDescription>
        </DialogHeader>

        <Section title="Main Menu" entries={Object.values(sidebarHelp)} />
        <Section
          title="Inside an Event (season tabs)"
          entries={Object.values(tabHelp)}
        />
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title,
  entries,
}: {
  title: string;
  entries: { title: string; blurb: string }[];
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {title}
      </h3>
      <dl className="space-y-3">
        {entries.map((e) => (
          <div key={e.title}>
            <dt className="font-medium">{e.title}</dt>
            <dd className="text-sm text-muted-foreground">{e.blurb}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
