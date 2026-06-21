"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import type { Bird } from "@/lib/types";
import { getSexLabel } from "@/lib/bird-constants";
import { useSettings } from "@/lib/settings-context";
import { useUpdateBird } from "@/lib/api/bird";
import { BirdEditDialog } from "./bird-edit-dialog";

interface Props {
  bird: Bird;
  isAdmin?: boolean;
  onUpdated?: () => void;
}

export function BirdPropertiesCard({ bird, isAdmin, onUpdated }: Props) {
  const { sexTerminology } = useSettings();
  const sexLabel = getSexLabel(bird.sex, sexTerminology);

  const bandParts = [bird.band1, bird.band2, bird.band3, bird.band4].filter(
    Boolean
  );
  const bandDisplay = bandParts.join("-");
  const bandCompact = bandParts.join("");

  const statusLabel =
    bird.isLost === 1 ? "Lost" : bird.isActive === 1 ? "Normal" : "Inactive";
  const statusNode =
    bird.isLost === 1 ? (
      <Badge variant="destructive">Lost</Badge>
    ) : bird.isActive === 1 ? (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
        Normal
      </Badge>
    ) : (
      <Badge variant="secondary">Inactive</Badge>
    );

  const loftName = bird.breeder?.user?.loftName ?? null;
  const fancierName =
    [bird.breeder?.firstName, bird.breeder?.lastName]
      .filter(Boolean)
      .join(" ") || "Unknown";
  const fancier = loftName ? `${fancierName} - ${loftName}` : fancierName;

  const [bandEditOpen, setBandEditOpen] = useState(false);

  // inline edit for code masked
  const updateMutation = useUpdateBird(bird.id);
  const [editingMask, setEditingMask] = useState(false);
  const [maskValue, setMaskValue] = useState(bird.codeMasked ?? "");

  const saveMask = async () => {
    try {
      await updateMutation.mutateAsync({ codeMasked: maskValue || null });
      toast.success("Code masked updated");
      setEditingMask(false);
      onUpdated?.();
    } catch {
      toast.error("Failed to update");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings className="h-4 w-4" />
          Properties
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-3 text-sm">
          <Row
            label="Pigeon"
            value={
              <span className="font-mono">
                {bandDisplay || "-"}{" "}
                <span className="text-muted-foreground">{statusLabel}</span>
              </span>
            }
          />
          <Row label="Pigeon Number" value={<Muted>—</Muted>} />
          <Row
            label="Code Masked"
            value={
              editingMask ? (
                <div className="flex items-center gap-1">
                  <Input
                    value={maskValue}
                    onChange={(e) => setMaskValue(e.target.value)}
                    className="h-7 w-36 font-mono text-xs"
                    autoFocus
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={saveMask}
                    disabled={updateMutation.isPending}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => {
                      setMaskValue(bird.codeMasked ?? "");
                      setEditingMask(false);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="font-mono">
                    {bird.codeMasked || <Muted>Not set</Muted>}
                  </span>
                  {isAdmin && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => setEditingMask(true)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )
            }
          />
          <Row
            label="Clocking Device Pigeon Code"
            value={<span className="font-mono">{bandCompact || "-"}</span>}
          />
          <Row
            label="Code custom formatted"
            value={
              <div className="flex items-center gap-1">
                <span className="font-mono">{bandDisplay || "-"}</span>
                {isAdmin && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => setBandEditOpen(true)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </div>
            }
          />
          <Row
            label="Pigeon number"
            value={<span className="font-mono">{bird.band4 || "-"}</span>}
          />
          <Row label="Fancier" value={<span>{fancier}</span>} />
          <Row label="Gender" value={<span>{sexLabel}</span>} />
          <Row label="Status" value={statusNode} />
          <Row label="Year" value={<span>{bird.band2 || "-"}</span>} />
          <Row
            label="Country"
            value={
              bird.breeder?.country ? (
                <span>{bird.breeder.country}</span>
              ) : (
                <Muted>—</Muted>
              )
            }
          />
          <Row
            label="Color"
            value={<Badge variant="outline">{bird.color || "-"}</Badge>}
          />
          <Row
            label="RFID"
            value={
              <span className="font-mono text-xs">
                {bird.rfid || "Not set"}
              </span>
            }
          />
        </dl>
      </CardContent>

      {isAdmin && (
        <BirdEditDialog
          bird={bird}
          open={bandEditOpen}
          onOpenChange={setBandEditOpen}
          onSaved={() => onUpdated?.()}
        />
      )}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}
