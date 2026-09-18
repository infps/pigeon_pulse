"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HeartPulse, Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";
import { apiEndpoints } from "@/lib/endpoints";

export type BirdHealthStatus = "HEALTHY" | "INJURED" | "HOSPITALIZED" | "DEAD";

interface Props {
  birdId: number | string;
  healthStatus: BirdHealthStatus | null | undefined;
  healthNote: string | null | undefined;
  healthUpdatedAt: string | null | undefined;
  canEdit: boolean;
  onUpdated: () => void;
}

const LABEL: Record<BirdHealthStatus, string> = {
  HEALTHY: "Healthy",
  INJURED: "Injured",
  HOSPITALIZED: "Hospitalized",
  DEAD: "Dead",
};

/** Only a healthy bird may be basketted; the rest are held back. */
const FIT_TO_FLY: Record<BirdHealthStatus, boolean> = {
  HEALTHY: true,
  INJURED: false,
  HOSPITALIZED: false,
  DEAD: false,
};

function badgeClass(status: BirdHealthStatus): string {
  switch (status) {
    case "HEALTHY":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
    case "INJURED":
      return "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300";
    case "HOSPITALIZED":
      return "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-300";
    case "DEAD":
      return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
  }
}

/**
 * Bird health — separate from race status, because a bird can be present at the
 * loft and still unfit to fly. Anything other than Healthy holds the bird back
 * from basketting.
 */
export function BirdHealthCard({
  birdId,
  healthStatus,
  healthNote,
  healthUpdatedAt,
  canEdit,
  onUpdated,
}: Props) {
  const current = healthStatus ?? "HEALTHY";
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<BirdHealthStatus>(current);
  const [note, setNote] = useState(healthNote ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(apiEndpoints.admin.birds.health(birdId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ healthStatus: status, healthNote: note || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "Could not update health");
        return;
      }
      toast.success(data.message);
      setEditing(false);
      onUpdated();
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setStatus(current);
    setNote(healthNote ?? "");
    setEditing(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <HeartPulse className="h-4 w-4" />
          Health
        </CardTitle>
        {canEdit && !editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {editing ? (
          <>
            <Select value={status} onValueChange={(v) => setStatus(v as BirdHealthStatus)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(LABEL) as BirdHealthStatus[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {LABEL[key]}
                    {FIT_TO_FLY[key] ? "" : " — held back from basketting"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What happened, and who treated it"
              rows={3}
            />

            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={saving}>
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button size="sm" variant="outline" onClick={cancel} disabled={saving}>
                <X className="mr-1.5 h-3.5 w-3.5" />
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Badge className={badgeClass(current)}>{LABEL[current]}</Badge>
              {FIT_TO_FLY[current] ? (
                <span className="text-xs text-muted-foreground">cleared to fly</span>
              ) : (
                <span className="text-xs text-amber-600">held back from basketting</span>
              )}
            </div>

            {healthNote ? (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{healthNote}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">No health notes recorded.</p>
            )}

            {healthUpdatedAt ? (
              <p className="text-xs text-muted-foreground">
                Updated {new Date(healthUpdatedAt).toLocaleString()}
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
