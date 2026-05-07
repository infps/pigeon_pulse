"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings } from "lucide-react";
import type { Bird } from "@/lib/types";

const SEX_MAP: Record<number, string> = { 0: "Unknown", 1: "Cock", 2: "Hen" };

interface Props {
  bird: Bird;
}

export function BirdPropertiesCard({ bird }: Props) {
  const sexLabel = SEX_MAP[bird.sex ?? 0] ?? "Unknown";
  const statusNode =
    bird.isLost === 1 ? (
      <Badge variant="destructive">Lost</Badge>
    ) : bird.isActive === 1 ? (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
        Active
      </Badge>
    ) : (
      <Badge variant="secondary">Inactive</Badge>
    );

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
          <Row label="Sex" value={<span>{sexLabel}</span>} />
          <Row
            label="Color"
            value={<Badge variant="outline">{bird.color || "-"}</Badge>}
          />
          <Row label="Status" value={statusNode} />
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
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
