"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";
import { useUpdateBird } from "@/lib/api/bird";

interface Props {
  birdId: number | string;
  note: string | null;
  canEdit: boolean;
  onUpdated: () => void;
}

export function BirdNotesCard({ birdId, note, canEdit, onUpdated }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note ?? "");
  const mutation = useUpdateBird(birdId);

  const handleSave = async () => {
    try {
      await mutation.mutateAsync({ note: draft || null });
      toast.success("Notes updated");
      setEditing(false);
      onUpdated();
    } catch {
      toast.error("Failed to update notes");
    }
  };

  const handleCancel = () => {
    setDraft(note ?? "");
    setEditing(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" />
          Notes
        </CardTitle>
        {canEdit && !editing && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setDraft(note ?? "");
              setEditing(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
        {editing && (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={handleCancel}>
              <X className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSave}
              disabled={mutation.isPending}
            >
              <Save className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add notes..."
            className="w-full text-sm border rounded-md p-2 min-h-[100px] resize-y"
          />
        ) : note ? (
          <p className="text-sm whitespace-pre-wrap">{note}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No notes</p>
        )}
      </CardContent>
    </Card>
  );
}
