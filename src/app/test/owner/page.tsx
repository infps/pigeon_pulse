"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

function fmtDate(v: string | null) { if (!v) return "-"; try { return new Date(v).toLocaleDateString(); } catch { return "-"; } }
function fmtMoney(v: number | null) { if (v == null) return "-"; return `$${v.toFixed(2)}`; }
function fmtTime(v: string | null) { if (!v) return "-"; try { return new Date(v).toLocaleString(); } catch { return "-"; } }

function statusBadge(bird: Record<string, unknown>) {
  if (bird.isLost === 1) return <Badge variant="destructive">Lost</Badge>;
  if (bird.isActive === 1) return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>;
  return <Badge variant="secondary">Inactive</Badge>;
}

export default function OwnerViewPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const idx = parseInt(searchParams.get("bird") ?? "0") || 0;
  const [birds, setBirds] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/test/demo").then(r => r.json()).then(d => { setBirds(d); setLoading(false); });
  }, []);

  const bird = birds[idx] as Record<string, unknown> | undefined;
  const go = (n: number) => router.push(`/test/owner?bird=${Math.max(0, Math.min(9, n))}`);

  if (loading) return <div className="p-8 text-muted-foreground">Loading demo data...</div>;
  if (!bird) return <div className="p-8 text-red-500">No bird found.</div>;

  const band = [bird.band1, bird.band2, bird.band3, bird.band4].filter(Boolean).join("-");
  const inventoryItems = (bird.inventoryItems as Record<string, unknown>[]) ?? [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* nav */}
      <div className="flex items-center justify-between">
        <Link href="/test"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button></Link>
        <div className="flex items-center gap-2">
          <Badge className="bg-blue-100 text-blue-800">BREEDER OWNER VIEW</Badge>
          <Button variant="outline" size="sm" onClick={() => go(idx - 1)} disabled={idx === 0}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm text-muted-foreground">Bird {idx + 1} / 10</span>
          <Button variant="outline" size="sm" onClick={() => go(idx + 1)} disabled={idx === 9}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Identity card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            {/* Image editable */}
            <div className="relative shrink-0">
              <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center text-4xl">🕊️</div>
              <button className="absolute bottom-0 right-0 bg-primary text-white rounded-full p-1">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              </button>
            </div>

            <div className="flex-1 space-y-2">
              <h1 className="text-xl font-bold">{(bird.birdName as string) || "Unnamed"}</h1>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-muted-foreground font-mono text-xs">{band}</span>
                {!!bird.color && <Badge variant="outline" className="text-xs">{String(bird.color)}</Badge>}
                {statusBadge(bird)}
              </div>

              {/* Attention flag (read-only) */}
              {!!bird.attention && (
                <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded px-2 py-1 w-fit">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" /></svg>
                  Pay attention during basketing
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Race results per event */}
      {inventoryItems.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground text-sm">
            No event registrations yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <h2 className="text-base font-semibold">Race Results</h2>
          {inventoryItems.map((item) => {
            const event = (item.eventInventory as Record<string, unknown>)?.event as Record<string, unknown>;
            const raceItems = (item.raceItems as Record<string, unknown>[]) ?? [];

            return (
              <Card key={item.id as number}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">{String(event?.name ?? "Unknown Event")}</CardTitle>
                    {item.isBackup === 1 && <Badge variant="secondary">Backup</Badge>}
                  </div>
                </CardHeader>
                <CardContent>
                  {raceItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No races yet.</p>
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
                              <td className="py-1.5">{String(race?.name ?? "-")}</td>
                              <td className="py-1.5"><Badge variant="outline" className="text-xs">{String(ri.status ?? "-")}</Badge></td>
                              <td className="py-1.5">{result?.birdPosition != null ? `#${String(result.birdPosition)}` : "-"}</td>
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
            );
          })}
        </div>
      )}
    </div>
  );
}
