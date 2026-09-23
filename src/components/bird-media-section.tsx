"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ImagePlus, StickyNote, Trash2, Send } from "lucide-react";
import { toast } from "sonner";
import { useSeasonContext } from "@/lib/season-context";

// Per-event bird media: image gallery (ARRIVAL/RACE/FINAL) + note timeline.
// Backend: /api/admin/event/[eventId]/birds/[birdId]/{images,notes}. seasonId is
// taken from context when present; the routes fall back to the active season
// when it's omitted, so this also works from the global birds page.

interface Img { id: number; url: string; type: string; takenAt: string }
interface Note { id: number; text: string; authorName: string | null; createdAt: string }

const IMAGE_GROUPS: { type: "ARRIVAL" | "RACE" | "FINAL"; label: string }[] = [
  { type: "ARRIVAL", label: "Arrival scans" },
  { type: "RACE", label: "Race" },
  { type: "FINAL", label: "Final" },
];

export function BirdMediaSection({
  eventId,
  birdId,
  canEdit,
}: {
  eventId: number;
  birdId: number | string;
  canEdit: boolean;
}) {
  const { selectedSeasonId } = useSeasonContext();
  const qc = useQueryClient();
  const seasonQuery = selectedSeasonId ? `?seasonId=${selectedSeasonId}` : "";
  const base = `/api/admin/event/${eventId}/birds/${birdId}`;

  const imagesKey = ["bird-images", eventId, birdId, selectedSeasonId];
  const notesKey = ["bird-notes", eventId, birdId, selectedSeasonId];

  const { data: imageData } = useQuery({
    queryKey: imagesKey,
    queryFn: () => fetch(`${base}/images${seasonQuery}`).then((r) => r.json()),
  });
  const { data: noteData } = useQuery({
    queryKey: notesKey,
    queryFn: () => fetch(`${base}/notes${seasonQuery}`).then((r) => r.json()),
  });

  const notes: Note[] = noteData?.notes ?? [];

  // ── images ──────────────────────────────────────────────────────────────
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<string>("ARRIVAL");

  const uploadImage = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("type", uploadType);
      if (selectedSeasonId) fd.append("seasonId", String(selectedSeasonId));
      const res = await fetch(`${base}/images`, { method: "POST", body: fd });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => { toast.success("Image added"); qc.invalidateQueries({ queryKey: imagesKey }); },
    onError: () => toast.error("Upload failed"),
  });

  // ── notes ───────────────────────────────────────────────────────────────
  const [draft, setDraft] = useState("");
  const addNote = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch(`${base}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, seasonId: selectedSeasonId ?? undefined }),
      });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => { setDraft(""); qc.invalidateQueries({ queryKey: notesKey }); },
    onError: () => toast.error("Failed to add note"),
  });
  const delNote = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${base}/notes?noteId=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: notesKey }),
    onError: () => toast.error("Failed to delete"),
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* ── Image gallery ── */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <ImagePlus className="h-4 w-4" /> Event Images
          </CardTitle>
          {canEdit && (
            <div className="flex items-center gap-2">
              <select
                value={uploadType}
                onChange={(e) => setUploadType(e.target.value)}
                className="h-7 rounded border bg-background px-2 text-xs"
              >
                {IMAGE_GROUPS.map((g) => <option key={g.type} value={g.type}>{g.label}</option>)}
              </select>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage.mutate(f); e.target.value = ""; }}
              />
              <Button size="sm" variant="outline" className="h-7" disabled={uploadImage.isPending}
                onClick={() => fileInput.current?.click()}>
                Add
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-3 max-h-80 overflow-y-auto">
          {IMAGE_GROUPS.map((g) => {
            const imgs: Img[] = imageData?.[g.type] ?? [];
            return (
              <div key={g.type}>
                <p className="text-xs text-muted-foreground mb-1.5">{g.label} ({imgs.length})</p>
                {imgs.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60">None</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {imgs.map((im) => (
                      <a key={im.id} href={im.url} target="_blank" rel="noreferrer" className="block">
                        <img src={im.url} alt={g.label}
                          className="h-20 w-20 rounded object-cover border hover:ring-2 hover:ring-primary" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ── Notes timeline ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <StickyNote className="h-4 w-4" /> Notes Timeline
            {notes.length > 0 && <Badge variant="secondary" className="text-xs">{notes.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {canEdit && (
            <div className="flex gap-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Add a note…"
                rows={2}
                className="text-sm"
              />
              <Button size="sm" className="self-end" disabled={!draft.trim() || addNote.isPending}
                onClick={() => addNote.mutate(draft.trim())}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          ) : (
            <ol className="relative space-y-3 border-l pl-4 max-h-72 overflow-y-auto">
              {notes.map((n) => (
                <li key={n.id} className="relative">
                  <span className="absolute -left-[22px] top-1 h-3 w-3 rounded-full bg-background ring-2 ring-border" />
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <p className="text-sm whitespace-pre-wrap">{n.text}</p>
                      <p className="text-xs text-muted-foreground">
                        {n.authorName ? `${n.authorName} · ` : ""}{new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {canEdit && (
                      <button onClick={() => delNote.mutate(n.id)}
                        className="text-muted-foreground hover:text-destructive" aria-label="Delete note">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
