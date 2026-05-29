"use client";

import { useSettings } from "@/lib/settings-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Gauge, Bird } from "lucide-react";

export default function SettingsPage() {
  const { velocityUnit, setVelocityUnit, sexTerminology, setSexTerminology } = useSettings();

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Display preferences saved locally in your browser.</p>
      </div>

      <Separator />

      {/* Velocity Unit */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Velocity Unit</CardTitle>
          </div>
          <CardDescription>Unit used to display race speed across the app.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Label className={velocityUnit === "YPM" ? "font-semibold" : "text-muted-foreground"}>
              Yards Per Minute (YPM)
            </Label>
            <Switch
              checked={velocityUnit === "MPM"}
              onCheckedChange={(v) => setVelocityUnit(v ? "MPM" : "YPM")}
            />
            <Label className={velocityUnit === "MPM" ? "font-semibold" : "text-muted-foreground"}>
              Meters Per Minute (MPM)
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Sex Terminology */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Bird className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Bird Sex Terminology</CardTitle>
          </div>
          <CardDescription>How bird sex is labeled throughout the app.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Label className={sexTerminology === "traditional" ? "font-semibold" : "text-muted-foreground"}>
              Traditional (Cock ♂ / Hen ♀)
            </Label>
            <Switch
              checked={sexTerminology === "neutral"}
              onCheckedChange={(v) => setSexTerminology(v ? "neutral" : "traditional")}
            />
            <Label className={sexTerminology === "neutral" ? "font-semibold" : "text-muted-foreground"}>
              Neutral (Male ♂ / Female ♀)
            </Label>
          </div>
          <div className="rounded-md bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
            Preview: sex 1 = <strong>{sexTerminology === "neutral" ? "Male" : "Cock"}</strong>
            {" · "}sex 2 = <strong>{sexTerminology === "neutral" ? "Female" : "Hen"}</strong>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
