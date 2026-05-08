"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download } from "lucide-react";

export type ExportKind =
  | "registrations"
  | "results"
  | "baskets"
  | "birds"
  | "payments";
export type ExportFormat = "xlsx" | "csv" | "pdf" | "html";

interface ExportButtonProps {
  kind: ExportKind;
  eventId?: string | number;
  raceId?: string | number;
  breederId?: string | number;
  label?: string;
}

const FORMATS: { format: ExportFormat; label: string }[] = [
  { format: "xlsx", label: "Excel (.xlsx)" },
  { format: "csv", label: "CSV (.csv)" },
  { format: "pdf", label: "PDF (.pdf)" },
  { format: "html", label: "Web Page (.html)" },
];

export function ExportButton({
  kind,
  eventId,
  raceId,
  breederId,
  label,
}: ExportButtonProps) {
  const open = (format: ExportFormat) => {
    const qs = new URLSearchParams({ format });
    if (eventId !== undefined) qs.set("eventId", String(eventId));
    if (raceId !== undefined) qs.set("raceId", String(raceId));
    if (breederId !== undefined) qs.set("breederId", String(breederId));
    window.open(`/api/breeder/export/${kind}?${qs.toString()}`, "_blank");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          {label ?? "Export"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Export as</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {FORMATS.map((f) => (
          <DropdownMenuItem key={f.format} onClick={() => open(f.format)}>
            {f.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
