"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart3, RefreshCw, ScanLine, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface GroupStat {
  groupId: number;
  name: string;
  type: string;
  status: string;
  capacity: number | null;
  total: number;
  active: number;
  lost: number;
  foreign: number;
  stray: number;
  ignored: number;
  medical: number;
  backup: number;
  unpaid: number;
}

interface Totals {
  total: number;
  active: number;
  lost: number;
  foreign: number;
  stray: number;
  ignored: number;
  medical: number;
  backup: number;
  unpaid: number;
}

interface Mapping {
  id: number;
  scannerSerial: string;
  eventGroupId: number | null;
  label: string | null;
  isActive: boolean;
  lastSeenAt: string | null;
  scanCount: number;
  eventGroup: { id: number; name: string; type: string; status: string } | null;
}

interface UnmappedSerial {
  scannerSerial: string;
  scanCount: number;
  lastSeenAt: string | null;
}

const NO_GROUP = "none";

function seenAgo(iso: string | null): string {
  if (!iso) return "never";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/**
 * Per-group statistics and scanner-to-section mappings.
 *
 * Both come from the same client meeting: an operator wants to see the state of
 * each loft section at a glance, and to have a reader file birds into a section
 * by itself rather than anybody typing.
 */
export function GroupStatsCard({
  eventId,
  seasonId,
}: {
  eventId: string;
  seasonId: number | null;
}) {
  const [stats, setStats] = useState<GroupStat[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [groups, setGroups] = useState<Array<{ id: number; name: string }>>([]);
  const [unmapped, setUnmapped] = useState<UnmappedSerial[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSerial, setNewSerial] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newGroupId, setNewGroupId] = useState<string>(NO_GROUP);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (seasonId == null) return;
    setLoading(true);
    try {
      const [statsRes, mapRes] = await Promise.all([
        fetch(`/api/admin/event/${eventId}/group-stats?seasonId=${seasonId}`),
        fetch(`/api/admin/event/${eventId}/scanner-mappings?seasonId=${seasonId}`),
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats ?? []);
        setTotals(data.totals ?? null);
      }
      if (mapRes.ok) {
        const data = await mapRes.json();
        setMappings(data.mappings ?? []);
        setGroups(data.groups ?? []);
        setUnmapped(data.unmappedSerials ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [eventId, seasonId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveMapping = async (
    serial: string,
    groupId: string,
    label: string | null,
    isActive?: boolean
  ) => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/event/${eventId}/scanner-mappings?seasonId=${seasonId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scannerSerial: serial,
            eventGroupId: groupId === NO_GROUP ? null : Number(groupId),
            label: label || null,
            ...(isActive !== undefined ? { isActive } : {}),
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "Could not save the mapping");
        return;
      }
      toast.success(data.message);
      setNewSerial("");
      setNewLabel("");
      setNewGroupId(NO_GROUP);
      load();
    } finally {
      setSaving(false);
    }
  };

  const removeMapping = async (id: number) => {
    const res = await fetch(
      `/api/admin/event/${eventId}/scanner-mappings?seasonId=${seasonId}&id=${id}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      toast.error("Could not remove the mapping");
      return;
    }
    toast.success("Mapping removed");
    load();
  };

  if (seasonId == null) return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Section statistics
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
          {totals && (
            <p className="text-xs text-muted-foreground mt-1">
              {totals.total} birds across {stats.length} group
              {stats.length === 1 ? "" : "s"} · {totals.active} active · {totals.lost} lost ·{" "}
              {totals.medical} medical · {totals.unpaid} unpaid
            </p>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-28 w-full" />
          ) : stats.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No groups in this season yet. Create a loft group to see its figures here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-1.5 pr-3">Group</th>
                    <th className="text-left py-1.5 pr-3">Type</th>
                    <th className="text-right py-1.5 pr-3">Birds</th>
                    <th className="text-right py-1.5 pr-3">Active</th>
                    <th className="text-right py-1.5 pr-3">Lost</th>
                    <th className="text-right py-1.5 pr-3">Foreign</th>
                    <th className="text-right py-1.5 pr-3">Stray</th>
                    <th className="text-right py-1.5 pr-3">Ignored</th>
                    <th className="text-right py-1.5 pr-3">Medical</th>
                    <th className="text-right py-1.5 pr-3">Backup</th>
                    <th className="text-right py-1.5">Unpaid</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {stats.map((s) => (
                    <tr key={s.groupId} className="border-b last:border-0">
                      <td className="py-1.5 pr-3">
                        <span className="flex items-center gap-2">
                          {s.name}
                          {s.status === "OPEN" && (
                            <Badge variant="secondary" className="text-[10px]">
                              open
                            </Badge>
                          )}
                        </span>
                      </td>
                      <td className="py-1.5 pr-3 text-xs text-muted-foreground">
                        {s.type.toLowerCase()}
                      </td>
                      <td className="py-1.5 pr-3 text-right">
                        {s.total}
                        {s.capacity ? (
                          <span className="text-muted-foreground">/{s.capacity}</span>
                        ) : null}
                      </td>
                      <td className="py-1.5 pr-3 text-right">{s.active}</td>
                      <td className="py-1.5 pr-3 text-right">{s.lost || ""}</td>
                      <td className="py-1.5 pr-3 text-right">{s.foreign || ""}</td>
                      <td className="py-1.5 pr-3 text-right">{s.stray || ""}</td>
                      <td className="py-1.5 pr-3 text-right">{s.ignored || ""}</td>
                      <td className="py-1.5 pr-3 text-right">
                        {s.medical ? <span className="text-amber-600">{s.medical}</span> : ""}
                      </td>
                      <td className="py-1.5 pr-3 text-right">{s.backup || ""}</td>
                      <td className="py-1.5 text-right">{s.unpaid || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ScanLine className="h-4 w-4" />
            Scanners
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            A reader mapped to a section files every bird it scans into that section. Leave the
            section blank to log scans without filing anything.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <>
              {mappings.length > 0 && (
                <div className="space-y-1.5">
                  {mappings.map((m) => (
                    <div
                      key={m.id}
                      className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2"
                    >
                      <span className="font-mono text-xs">{m.scannerSerial}</span>
                      {m.label && <span className="text-sm">{m.label}</span>}
                      <Select
                        value={m.eventGroupId ? String(m.eventGroupId) : NO_GROUP}
                        onValueChange={(v) => saveMapping(m.scannerSerial, v, m.label)}
                      >
                        <SelectTrigger className="h-8 w-48 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_GROUP}>No section — log only</SelectItem>
                          {groups.map((g) => (
                            <SelectItem key={g.id} value={String(g.id)}>
                              {g.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-muted-foreground">
                        {m.scanCount} scans · seen {seenAgo(m.lastSeenAt)}
                      </span>
                      {!m.isActive && (
                        <Badge variant="outline" className="text-[10px]">
                          off
                        </Badge>
                      )}
                      <div className="ml-auto flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() =>
                            saveMapping(
                              m.scannerSerial,
                              m.eventGroupId ? String(m.eventGroupId) : NO_GROUP,
                              m.label,
                              !m.isActive
                            )
                          }
                        >
                          {m.isActive ? "Turn off" : "Turn on"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => removeMapping(m.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {unmapped.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Seen recently, not mapped
                  </p>
                  {unmapped.map((u) => (
                    <div
                      key={u.scannerSerial}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span className="font-mono text-xs">{u.scannerSerial}</span>
                      <span className="text-xs text-muted-foreground">
                        {u.scanCount} scans · {seenAgo(u.lastSeenAt)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs ml-auto"
                        onClick={() => setNewSerial(u.scannerSerial)}
                      >
                        Map this
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-end gap-2 border-t pt-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Serial</label>
                  <Input
                    value={newSerial}
                    onChange={(e) => setNewSerial(e.target.value)}
                    placeholder="Reader serial"
                    className="h-8 w-48 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Label</label>
                  <Input
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="Pen 3 reader"
                    className="h-8 w-40 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Section</label>
                  <Select value={newGroupId} onValueChange={setNewGroupId}>
                    <SelectTrigger className="h-8 w-48 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_GROUP}>No section — log only</SelectItem>
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={String(g.id)}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="sm"
                  disabled={saving || !newSerial.trim()}
                  onClick={() => saveMapping(newSerial.trim(), newGroupId, newLabel)}
                >
                  {saving ? "Saving…" : "Add scanner"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
