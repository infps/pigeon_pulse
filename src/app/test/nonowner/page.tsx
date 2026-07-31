"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

function fmtMoney(v: number | null) { if (v == null) return "-"; return `$${v.toFixed(2)}`; }
function fmtTime(v: string | null) { if (!v) return "-"; try { return new Date(v).toLocaleString(); } catch { return "-"; } }

export default function NonOwnerViewPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const idx = parseInt(searchParams.get("bird") ?? "0") || 0;
  const [birds, setBirds] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/test/demo").then(r => r.json()).then(d => { setBirds(d); setLoading(false); });
  }, []);

  const bird = birds[idx] as Record<string, unknown> | undefined;
  const go = (n: number) => router.push(`/test/nonowner?bird=${Math.max(0, Math.min(9, n))}`);

  if (loading) return <div className="p-8 text-muted-foreground">Loading demo data...</div>;
  if (!bird) return <div className="p-8 text-red-500">No bird found.</div>;

  const band = [bird.band1, bird.band2, bird.band3, bird.band4].filter(Boolean).join("-");
  // Non-owner: show only first event's race items (always from event context in prod)
  const inventoryItems = (bird.inventoryItems as Record<string, unknown>[]) ?? [];
  const eventItem = inventoryItems[0] as Record<string, unknown> | undefined;
  const event = eventItem ? ((eventItem.eventInventory as Record<string, unknown>)?.event as Record<string, unknown>) : null;
  const raceItems = eventItem ? ((eventItem.raceItems as Record<string, unknown>[]) ?? []) : [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* nav */}
      <div className="flex items-center justify-between">
        <Link href="/test"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button></Link>
        <div className="flex items-center gap-2">
          <Badge className="bg-gray-100 text-gray-700">BREEDER NON-OWNER VIEW</Badge>
          <Button variant="outline" size="sm" onClick={() => go(idx - 1)} disabled={idx === 0}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm text-muted-foreground">Bird {idx + 1} / 10</span>
          <Button variant="outline" size="sm" onClick={() => go(idx + 1)} disabled={idx === 9}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Minimal identity — name + band only, no image */}
      <Card>
        <CardContent className="pt-6">
          <h1 className="text-xl font-bold">{(bird.birdName as string) || "Unnamed"}</h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">{band || "No band"}</p>
        </CardContent>
      </Card>

      {/* Race results for event context */}
      {event && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{event.name as string}</CardTitle>
          </CardHeader>
          <CardContent>
            {raceItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No races recorded.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b">
                    <th className="text-left pb-1">Race</th>
                    <th className="text-left pb-1">Status</th>
                    <th className="text-left pb-1">Position</th>
                    <th className="text-left pb-1">Prize</th>
                    <th className="text-left pb-1">Arrival</th>
                  </tr>
                </thead>
                <tbody>
                  {raceItems.map((ri) => {
                    const result = ri.result as Record<string, unknown> | null;
                    const race = ri.race as Record<string, unknown>;
                    return (
                      <tr key={ri.id as number} className="border-b last:border-0">
                        <td className="py-1.5">{race?.name as string ?? "-"}</td>
                        <td className="py-1.5"><Badge variant="outline" className="text-xs">{ri.status as string}</Badge></td>
                        <td className="py-1.5">{result?.birdPosition != null ? `#${result.birdPosition}` : "-"}</td>
                        <td className="py-1.5">{fmtMoney(result?.prizeValue as number)}</td>
                        <td className="py-1.5 text-xs text-muted-foreground">{fmtTime(result?.arrivalTime as string)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {!event && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground text-sm">
            No event race data available.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
