"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, X, Save } from "lucide-react";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/useApiMutation";
import { apiEndpoints } from "@/lib/endpoints";
import { COLORS } from "@/lib/bird-constants";
import type { Bird } from "@/lib/types";

const SEX_MAP: Record<number, string> = { 0: "Unknown", 1: "Cock", 2: "Hen" };

interface BirdDetailsPanelProps {
  bird: Bird;
  isOwner: boolean;
  onUpdate: () => void;
}

export function BirdDetailsPanel({ bird, isOwner, onUpdate }: BirdDetailsPanelProps) {
  const [editing, setEditing] = useState(false);
  const [sex, setSex] = useState(String(bird.sex ?? 0));
  const [color, setColor] = useState(bird.color ?? "");
  const [rfid, setRfid] = useState(bird.rfid ?? "");
  const [note, setNote] = useState(bird.note ?? "");
  const [isPublic, setIsPublic] = useState(bird.isPublic === 1);

  const updateMutation = useApiMutation({
    endpoint: apiEndpoints.breeder.birdById(bird.id),
    method: "PATCH",
    queryKey: ["breeder", "birds"],
    onSuccess: () => {
      toast.success("Bird updated");
      setEditing(false);
      onUpdate();
    },
    onError: () => toast.error("Failed to update"),
  });

  const handleSave = async () => {
    await updateMutation.mutateAsync({
      sex: parseInt(sex),
      color,
      rfid: rfid || null,
      note: note || null,
      isPublic: isPublic ? 1 : 0,
    });
  };

  const handleCancel = () => {
    setSex(String(bird.sex ?? 0));
    setColor(bird.color ?? "");
    setRfid(bird.rfid ?? "");
    setNote(bird.note ?? "");
    setIsPublic(bird.isPublic === 1);
    setEditing(false);
  };

  const ownerName = bird.breeder
    ? [bird.breeder.firstName, bird.breeder.lastName].filter(Boolean).join(" ") || "Unknown"
    : "Unknown";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">Details</h3>
        {isOwner && !editing && (
          <Button variant="ghost" size="icon" onClick={() => setEditing(true)}>
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
              disabled={updateMutation.isPending}
            >
              <Save className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <dl className="space-y-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Sex</dt>
          <dd>
            {editing ? (
              <Select value={sex} onValueChange={setSex}>
                <SelectTrigger className="w-28 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Unknown</SelectItem>
                  <SelectItem value="1">Cock</SelectItem>
                  <SelectItem value="2">Hen</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <span>{SEX_MAP[bird.sex ?? 0] ?? "Unknown"}</span>
            )}
          </dd>
        </div>

        <div className="flex justify-between">
          <dt className="text-muted-foreground">Color</dt>
          <dd>
            {editing ? (
              <Select value={color} onValueChange={setColor}>
                <SelectTrigger className="w-28 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLORS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Badge variant="outline">{bird.color || "-"}</Badge>
            )}
          </dd>
        </div>

        <div className="flex justify-between">
          <dt className="text-muted-foreground">Owner</dt>
          <dd>{ownerName}</dd>
        </div>

        <div className="flex justify-between">
          <dt className="text-muted-foreground">Status</dt>
          <dd>
            {bird.isActive === 1 ? (
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
            ) : bird.isLost === 1 ? (
              <Badge variant="destructive">Lost</Badge>
            ) : (
              <Badge variant="secondary">Inactive</Badge>
            )}
          </dd>
        </div>

        <div className="flex justify-between">
          <dt className="text-muted-foreground">RFID</dt>
          <dd>
            {editing ? (
              <Input
                value={rfid}
                onChange={(e) => setRfid(e.target.value)}
                className="w-40 h-8 text-sm"
                placeholder="RFID tag"
              />
            ) : (
              <span className="font-mono text-xs">{bird.rfid || "-"}</span>
            )}
          </dd>
        </div>

        <div>
          <dt className="text-muted-foreground mb-1">Notes</dt>
          <dd>
            {editing ? (
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full text-sm border rounded-md p-2 min-h-[60px] resize-y"
                placeholder="Description..."
              />
            ) : (
              <p className="text-sm">{bird.note || "-"}</p>
            )}
          </dd>
        </div>

        {isOwner && (
          <div className="flex items-center justify-between pt-2 border-t">
            <Label htmlFor="public-toggle" className="text-muted-foreground">
              Public profile
            </Label>
            <Checkbox
              id="public-toggle"
              checked={isPublic}
              onCheckedChange={async (checked) => {
                const val = checked as boolean;
                setIsPublic(val);
                if (!editing) {
                  await updateMutation.mutateAsync({
                    isPublic: val ? 1 : 0,
                  });
                }
              }}
            />
          </div>
        )}
      </dl>
    </div>
  );
}
