"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Gauge, Bird } from "lucide-react";
import { useSettings } from "@/lib/settings-context";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { velocityUnit, setVelocityUnit, sexTerminology, setSexTerminology } = useSettings();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Display Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Velocity Unit */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Gauge className="h-4 w-4 text-muted-foreground" />
              Velocity Unit
            </div>
            <div className="flex items-center gap-3 pl-6">
              <span className={`text-sm ${velocityUnit === "YPM" ? "font-semibold" : "text-muted-foreground"}`}>
                YPM
              </span>
              <Switch
                checked={velocityUnit === "MPM"}
                onCheckedChange={(v) => setVelocityUnit(v ? "MPM" : "YPM")}
              />
              <span className={`text-sm ${velocityUnit === "MPM" ? "font-semibold" : "text-muted-foreground"}`}>
                MPM
              </span>
            </div>
            <p className="text-xs text-muted-foreground pl-6">
              {velocityUnit === "YPM" ? "Yards per minute" : "Meters per minute"}
            </p>
          </div>

          <Separator />

          {/* Sex Terminology */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Bird className="h-4 w-4 text-muted-foreground" />
              Bird Sex Labels
            </div>
            <div className="flex items-center gap-3 pl-6">
              <span className={`text-sm ${sexTerminology === "traditional" ? "font-semibold" : "text-muted-foreground"}`}>
                Cock / Hen
              </span>
              <Switch
                checked={sexTerminology === "neutral"}
                onCheckedChange={(v) => setSexTerminology(v ? "neutral" : "traditional")}
              />
              <span className={`text-sm ${sexTerminology === "neutral" ? "font-semibold" : "text-muted-foreground"}`}>
                Male / Female
              </span>
            </div>
            <p className="text-xs text-muted-foreground pl-6">
              {sexTerminology === "traditional"
                ? "Traditional pigeon racing terminology"
                : "Gender-neutral terminology"}
            </p>
          </div>

          <p className="text-xs text-muted-foreground pt-1">
            Preferences saved locally in this browser.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
