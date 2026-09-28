"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Check, ShieldQuestion, UserX, Undo2 } from "lucide-react";
import { toast } from "sonner";

type Approval = "PENDING" | "APPROVED" | "DECLINED";

interface QueueUser {
  id: string;
  name: string | null;
  lastName: string | null;
  email: string;
  username: string | null;
  loftName: string | null;
  phoneNumber: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  role: string;
  approvalStatus: Approval;
  approvalNote: string | null;
  approvalDecidedAt: string | null;
  createdAt: string;
}

const FILTERS: Array<{ key: Approval | "ALL"; label: string }> = [
  { key: "PENDING", label: "Waiting" },
  { key: "APPROVED", label: "Approved" },
  { key: "DECLINED", label: "Declined" },
  { key: "ALL", label: "Everyone" },
];

function fullName(u: QueueUser): string {
  return [u.name, u.lastName].filter(Boolean).join(" ").trim() || u.email;
}

function place(u: QueueUser): string {
  return [u.city, u.state, u.country].filter(Boolean).join(", ");
}

/**
 * Registration approval.
 *
 * Declining never deletes the account — it drops the person to guest access and
 * keeps the record, so the decision can be reversed and the history survives.
 */
export function ApprovalQueue({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [filter, setFilter] = useState<Approval | "ALL">("PENDING");
  const [users, setUsers] = useState<QueueUser[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [declining, setDeclining] = useState<QueueUser | null>(null);
  const [note, setNote] = useState("");
  const [working, setWorking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = filter === "ALL" ? "" : `?status=${filter}`;
      const res = await fetch(`/api/admin/users/approval${qs}`);
      if (!res.ok) {
        toast.error("Could not load the approval queue");
        return;
      }
      const data = await res.json();
      setUsers(data.users ?? []);
      setCounts(data.counts ?? {});
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (user: QueueUser, decision: Approval, reason?: string) => {
    setWorking(user.id);
    try {
      const res = await fetch("/api/admin/users/approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, decision, note: reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "Could not record that decision");
        return;
      }
      toast.success(data.message);
      setDeclining(null);
      setNote("");
      load();
    } finally {
      setWorking(null);
    }
  };

  const visible = users.filter((u) => {
    if (!search.trim()) return true;
    const needle = search.toLowerCase();
    return (
      fullName(u).toLowerCase().includes(needle) ||
      u.email.toLowerCase().includes(needle) ||
      (u.loftName ?? "").toLowerCase().includes(needle)
    );
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldQuestion className="h-4 w-4" />
            Registrations
            {(counts.PENDING ?? 0) > 0 && (
              <Badge className="ml-1">{counts.PENDING} waiting</Badge>
            )}
          </CardTitle>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email or loft"
            className="h-8 w-56 text-xs"
          />
        </div>

        <div className="flex flex-wrap gap-1.5 pt-2">
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              {f.key !== "ALL" && counts[f.key] != null && (
                <span className="ml-1.5 opacity-70">{counts[f.key]}</span>
              )}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            {filter === "PENDING"
              ? "Nobody is waiting for approval."
              : "No accounts match."}
          </p>
        ) : (
          <div className="space-y-2">
            {visible.map((u) => (
              <div
                key={u.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-md border px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{fullName(u)}</span>
                    <Badge
                      variant={
                        u.approvalStatus === "APPROVED"
                          ? "secondary"
                          : u.approvalStatus === "DECLINED"
                            ? "outline"
                            : "default"
                      }
                      className="text-[10px]"
                    >
                      {u.approvalStatus.toLowerCase()}
                    </Badge>
                    {u.role !== "BREEDER" && (
                      <Badge variant="outline" className="text-[10px]">
                        {u.role.toLowerCase()}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 space-x-2">
                    <span>{u.email}</span>
                    {u.loftName && <span>· {u.loftName}</span>}
                    {place(u) && <span>· {place(u)}</span>}
                    {u.phoneNumber && <span>· {u.phoneNumber}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Signed up {new Date(u.createdAt).toLocaleDateString()}
                    {u.approvalNote ? ` · ${u.approvalNote}` : ""}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {u.approvalStatus !== "APPROVED" && (
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      disabled={working === u.id}
                      onClick={() => decide(u, "APPROVED")}
                    >
                      <Check className="mr-1 h-3.5 w-3.5" />
                      Approve
                    </Button>
                  )}
                  {u.approvalStatus !== "DECLINED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={working === u.id}
                      onClick={() => setDeclining(u)}
                    >
                      <UserX className="mr-1 h-3.5 w-3.5" />
                      Decline
                    </Button>
                  )}
                  {u.approvalStatus === "DECLINED" && isSuperAdmin && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      disabled={working === u.id}
                      onClick={() => decide(u, "PENDING")}
                    >
                      <Undo2 className="mr-1 h-3.5 w-3.5" />
                      Reopen
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={declining !== null} onOpenChange={(o) => !o && setDeclining(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Decline this registration</DialogTitle>
            <DialogDescription>
              The account is kept and can still sign in — it drops to guest access, seeing only
              what a visitor sees. A super admin can reopen it later.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why (optional) — kept on the account"
            rows={3}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclining(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => declining && decide(declining, "DECLINED", note || undefined)}
              disabled={working !== null}
            >
              Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
