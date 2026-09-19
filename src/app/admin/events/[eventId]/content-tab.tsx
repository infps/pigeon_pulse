"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, FileText, Film, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useSeasonContext } from "@/lib/season-context";

interface RuleSection {
  id: number;
  title: string;
  body: string;
  sortOrder: number;
  isPublished: boolean;
}

interface Video {
  id: number;
  title: string;
  url: string;
  description: string | null;
  publishedAt: string | null;
  isPublic: boolean;
  race?: { name?: string | null; raceNumber?: number | null } | null;
}

/** The sections AGN publishes, offered so an organizer starts from a shape. */
const STARTER_SECTIONS = [
  "Perch Fees",
  "Entry Fees",
  "Accepting Birds",
  "Total Payout",
  "Race Schedule",
  "General Rules",
  "Activation",
  "Refunded Payments",
  "Bird Management",
  "Teams and Syndicates",
  "Prize and Payout",
  "Return and Shipping",
];

/**
 * Published content for a season: the rules and fees page, and race videos.
 *
 * Rules are stored as ordered sections so changing one fee means editing one
 * section rather than retyping the page.
 */
export function ContentTab({ eventId }: { eventId: string }) {
  const { selectedSeasonId } = useSeasonContext();

  const [sections, setSections] = useState<RuleSection[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<{ id?: number; title: string; body: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const [video, setVideo] = useState({ title: "", url: "" });

  const load = useCallback(async () => {
    if (selectedSeasonId == null) return;
    setLoading(true);
    try {
      const [rulesRes, videoRes] = await Promise.all([
        fetch(`/api/admin/event/${eventId}/rules?seasonId=${selectedSeasonId}`),
        fetch(`/api/admin/event/${eventId}/videos?seasonId=${selectedSeasonId}`),
      ]);
      if (rulesRes.ok) setSections((await rulesRes.json()).sections ?? []);
      if (videoRes.ok) setVideos((await videoRes.json()).videos ?? []);
    } finally {
      setLoading(false);
    }
  }, [eventId, selectedSeasonId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveSection = async () => {
    if (!editing?.title.trim()) {
      toast.error("Give the section a heading");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/event/${eventId}/rules?seasonId=${selectedSeasonId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing.id,
          title: editing.title.trim(),
          body: editing.body,
          sortOrder: editing.id
            ? sections.find((s) => s.id === editing.id)?.sortOrder ?? 0
            : sections.length,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "Could not save the section");
        return;
      }
      toast.success(data.message);
      setEditing(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  const deleteSection = async (id: number) => {
    const res = await fetch(
      `/api/admin/event/${eventId}/rules?seasonId=${selectedSeasonId}&id=${id}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      toast.error("Could not remove the section");
      return;
    }
    toast.success("Section removed");
    load();
  };

  const addVideo = async () => {
    if (!video.title.trim() || !video.url.trim()) {
      toast.error("A video needs a title and a URL");
      return;
    }
    const res = await fetch(`/api/admin/event/${eventId}/videos?seasonId=${selectedSeasonId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: video.title.trim(), url: video.url.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.message ?? "Could not save the video");
      return;
    }
    toast.success(data.message);
    setVideo({ title: "", url: "" });
    load();
  };

  const deleteVideo = async (id: number) => {
    const res = await fetch(
      `/api/admin/event/${eventId}/videos?seasonId=${selectedSeasonId}&id=${id}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      toast.error("Could not remove the video");
      return;
    }
    toast.success("Video removed");
    load();
  };

  if (selectedSeasonId == null) {
    return <p className="text-sm text-muted-foreground">Choose a season first.</p>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Rules &amp; fees
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href={`/events/${eventId}/rules`} target="_blank" rel="noopener">
                  View public page
                  <ExternalLink className="ml-1.5 h-3 w-3" />
                </a>
              </Button>
              <Button size="sm" onClick={() => setEditing({ title: "", body: "" })}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add section
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Published sections are readable without an account — these are the terms a breeder
            agrees to by entering. Markdown is supported.
          </p>
        </CardHeader>

        <CardContent className="space-y-3">
          {editing && (
            <div className="rounded-md border p-3 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="sec-title">Heading</Label>
                <Input
                  id="sec-title"
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  placeholder="Perch Fees"
                />
                {!editing.id && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {STARTER_SECTIONS.filter((s) => !sections.some((x) => x.title === s)).map(
                      (s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setEditing({ ...editing, title: s })}
                          className="rounded border px-2 py-0.5 text-[11px] hover:bg-muted"
                        >
                          {s}
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sec-body">Body</Label>
                <Textarea
                  id="sec-body"
                  value={editing.body}
                  onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                  rows={8}
                  placeholder={"- Per Bird – $140.00\n  - Five Birds get One FREE!\n- Perch fee is non-refundable"}
                  className="font-mono text-xs"
                />
              </div>

              <div className="flex gap-2">
                <Button size="sm" onClick={saveSection} disabled={saving}>
                  {saving ? "Saving…" : "Save section"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : sections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No sections yet. Add one — the buttons above offer the headings AGN uses.
            </p>
          ) : (
            <div className="space-y-1.5">
              {sections.map((s) => (
                <div
                  key={s.id}
                  className="flex items-start justify-between gap-3 rounded-md border px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{s.title}</span>
                      {!s.isPublished && (
                        <Badge variant="outline" className="text-[10px]">
                          draft
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {s.body.slice(0, 160) || "empty"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setEditing({ id: s.id, title: s.title, body: s.body })}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => deleteSection(s.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Film className="h-4 w-4" />
            Videos
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Links to recordings — releases, arrivals, loft updates. Nothing is uploaded here.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Title</Label>
              <Input
                value={video.title}
                onChange={(e) => setVideo({ ...video, title: e.target.value })}
                placeholder="Hot Spot 1 release"
                className="h-8 w-56 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">URL</Label>
              <Input
                value={video.url}
                onChange={(e) => setVideo({ ...video, url: e.target.value })}
                placeholder="https://youtube.com/watch?v=…"
                className="h-8 w-80 text-xs"
              />
            </div>
            <Button size="sm" onClick={addVideo}>
              Add video
            </Button>
          </div>

          {loading ? (
            <Skeleton className="h-16 w-full" />
          ) : videos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No videos yet.</p>
          ) : (
            <div className="space-y-1">
              {videos.map((v) => (
                <div key={v.id} className="flex items-center justify-between gap-3 text-sm py-1">
                  <a
                    href={v.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-primary hover:underline truncate"
                  >
                    {v.title}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                    onClick={() => deleteVideo(v.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
