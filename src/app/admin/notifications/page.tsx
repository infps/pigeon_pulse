"use client";

import { useEffect, useState } from "react";
import { Megaphone, Send, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Stats {
  devices: number;
  activeDevices: number;
  reachableAccounts: number;
  recent: { title: string; body: string; createdAt: string; recipients: number }[];
}

const AUDIENCES = [
  { value: "all", label: "Everyone with the app" },
  { value: "role:BREEDER", label: "Breeders" },
  { value: "role:ADMIN", label: "Admins" },
  { value: "role:BETTOR", label: "Bettors" },
];

const MAX_TITLE = 100;
const MAX_BODY = 500;

/**
 * Sending an announcement to the phones.
 *
 * Two things happen on send, and the order matters: the announcement is written
 * into everybody's in-app feed first, then pushed. Push is the tap on the
 * shoulder, not the message — somebody with notifications switched off, or a
 * phone that was flat, still finds it when they next open the app.
 *
 * The device count is shown next to the send button rather than buried,
 * because "how many people will this actually reach" is the question worth
 * answering before pressing it, and it is never the same as the number of
 * accounts. A push cannot be recalled, so it asks first and says the audience
 * back in the confirmation.
 */
export default function NotificationsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("all");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/admin/notifications");
      if (!res.ok) throw new Error();
      setStats(await res.json());
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const audienceLabel = AUDIENCES.find((a) => a.value === audience)?.label ?? "Everyone";

  const send = async () => {
    setSending(true);
    try {
      const [kind, role] = audience.split(":");
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          audience: kind === "role" ? "role" : "all",
          ...(kind === "role" ? { role } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.message ?? "That was not sent.");
        return;
      }
      toast.success(data?.message ?? "Sent.");
      setTitle("");
      setBody("");
      setConfirming(false);
      load();
    } catch {
      toast.error("That was not sent.");
    } finally {
      setSending(false);
    }
  };

  const ready = title.trim().length > 0 && body.trim().length > 0;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground text-sm">
          Push an announcement to everybody running the mobile app.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {loading ? (
          <>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </>
        ) : (
          <>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{stats?.activeDevices ?? 0}</div>
                <p className="text-muted-foreground text-xs">Devices reachable now</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{stats?.reachableAccounts ?? 0}</div>
                <p className="text-muted-foreground text-xs">Accounts with the app</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">
                  {(stats?.devices ?? 0) - (stats?.activeDevices ?? 0)}
                </div>
                <p className="text-muted-foreground text-xs">
                  Installs gone quiet — uninstalled or reinstalled
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {!loading && (stats?.activeDevices ?? 0) === 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <Smartphone className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            No device has registered yet. A phone appears here once somebody signs in to the
            mobile app and allows notifications — the announcement is still written to their
            in-app feed in the meantime.
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="h-4 w-4" />
            Write an announcement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="audience">Who it goes to</Label>
            <Select value={audience} onValueChange={setAudience}>
              <SelectTrigger id="audience">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUDIENCES.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              maxLength={MAX_TITLE}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Liberation delayed"
            />
            <p className="text-muted-foreground text-xs">
              {title.length}/{MAX_TITLE} — this is the line shown on the lock screen.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              value={body}
              maxLength={MAX_BODY}
              rows={4}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Fog at the station. Birds will be released at 09:30 instead of 07:00."
            />
            <p className="text-muted-foreground text-xs">
              {body.length}/{MAX_BODY}
            </p>
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <p className="text-muted-foreground text-sm">
              {audienceLabel} · {stats?.activeDevices ?? 0} device
              {(stats?.activeDevices ?? 0) === 1 ? "" : "s"} will buzz
            </p>
            <Button disabled={!ready || sending} onClick={() => setConfirming(true)}>
              <Send className="mr-2 h-4 w-4" />
              Send
            </Button>
          </div>
        </CardContent>
      </Card>

      {(stats?.recent?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recently sent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats?.recent.map((r, i) => (
              <div key={i} className="border-b pb-3 last:border-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium">{r.title}</p>
                  <p className="text-muted-foreground shrink-0 text-xs">
                    {new Date(r.createdAt).toLocaleString()}
                  </p>
                </div>
                <p className="text-muted-foreground mt-0.5 text-sm">{r.body}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {r.recipients} recipient{r.recipients === 1 ? "" : "s"}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send to {audienceLabel.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>
              {stats?.activeDevices ?? 0} device
              {(stats?.activeDevices ?? 0) === 1 ? "" : "s"} will get a notification, and it will
              appear in the in-app feed for everybody in that group. A push cannot be recalled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                send();
              }}
              disabled={sending}
            >
              {sending ? "Sending…" : "Send it"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
