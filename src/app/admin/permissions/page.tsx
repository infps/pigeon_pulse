"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, Minus, ShieldCheck, UserCog, X } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

interface PermissionDef {
  code: string;
  module: string;
  label: string;
  description: string;
  action: string;
}

interface ModuleDef {
  key: string;
  label: string;
  description: string;
  permissions: PermissionDef[];
}

interface RoleRow {
  role: string;
  permissions: Array<{ code: string; allowed: boolean; explicit: boolean; byDefault: boolean }>;
}

interface OverrideRow {
  user: { id: string; name: string | null; lastName: string | null; email: string; role: string };
  permissions: Array<{ code: string; allowed: boolean }>;
}

interface UserOption {
  id: string;
  name: string | null;
  lastName: string | null;
  email: string;
  role: string;
}

/** Three states a rule can be in, cycled by clicking. */
type Tri = "allow" | "deny" | "default";

function triOf(explicit: boolean, allowed: boolean): Tri {
  if (!explicit) return "default";
  return allowed ? "allow" : "deny";
}

const NEXT: Record<Tri, Tri> = { default: "allow", allow: "deny", deny: "default" };

function TriCell({
  state,
  effective,
  onClick,
  disabled,
}: {
  state: Tri;
  effective: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  const label =
    state === "allow"
      ? "Allowed"
      : state === "deny"
        ? "Denied"
        : effective
          ? "Allowed by default"
          : "Not allowed by default";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex h-6 w-6 items-center justify-center rounded border transition-colors ${
        state === "allow"
          ? "border-emerald-500 bg-emerald-500/15 text-emerald-600"
          : state === "deny"
            ? "border-red-500 bg-red-500/15 text-red-600"
            : effective
              ? "border-border bg-muted/40 text-muted-foreground"
              : "border-border text-muted-foreground/40"
      } ${disabled ? "cursor-not-allowed opacity-50" : "hover:border-primary"}`}
    >
      {state === "allow" ? (
        <Check className="h-3.5 w-3.5" />
      ) : state === "deny" ? (
        <X className="h-3.5 w-3.5" />
      ) : effective ? (
        <Check className="h-3 w-3 opacity-50" />
      ) : (
        <Minus className="h-3 w-3" />
      )}
    </button>
  );
}

/**
 * The permission matrix.
 *
 * Every cell has three states, because two would not be enough: a rule has to be
 * able to *remove* something the default grants, and that is different from
 * simply not granting it. Clicking cycles default → allow → deny → default.
 */
export default function PermissionsPage() {
  const me = usePermissions();
  const [modules, setModules] = useState<ModuleDef[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [scope, setScope] = useState<string>("ADMIN");
  const [search, setSearch] = useState("");

  const isUserScope = scope.startsWith("user:");
  const targetUserId = isUserScope ? scope.slice(5) : null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [permRes, usersRes] = await Promise.all([
        fetch("/api/admin/permissions"),
        fetch("/api/admin/users?limit=500"),
      ]);

      if (!permRes.ok) {
        const body = await permRes.json().catch(() => ({}));
        toast.error(body.message ?? "Could not load permissions");
        return;
      }

      const data = await permRes.json();
      setModules(data.modules ?? []);
      setRoles(data.roles ?? []);
      setOverrides(data.overrides ?? []);

      if (usersRes.ok) {
        const u = await usersRes.json();
        const list: UserOption[] = (u.users ?? u.data ?? []).filter(
          (x: UserOption) => x.role !== "SUPERADMIN"
        );
        setUsers(list);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Current rule state for a permission under the selected scope. */
  const stateFor = useCallback(
    (code: string): { tri: Tri; effective: boolean } => {
      if (isUserScope) {
        const row = overrides.find((o) => o.user.id === targetUserId);
        const rule = row?.permissions.find((p) => p.code === code);
        const user = users.find((u) => u.id === targetUserId);
        const roleRow = roles.find((r) => r.role === user?.role);
        const fromRole = roleRow?.permissions.find((p) => p.code === code)?.allowed ?? false;
        return {
          tri: rule ? (rule.allowed ? "allow" : "deny") : "default",
          effective: rule ? rule.allowed : fromRole,
        };
      }

      const roleRow = roles.find((r) => r.role === scope);
      const rule = roleRow?.permissions.find((p) => p.code === code);
      return {
        tri: triOf(rule?.explicit ?? false, rule?.allowed ?? false),
        effective: rule?.allowed ?? false,
      };
    },
    [isUserScope, targetUserId, overrides, users, roles, scope]
  );

  const setRule = async (code: string, next: Tri) => {
    setSaving(true);
    try {
      const allowed = next === "default" ? null : next === "allow";
      const res = await fetch("/api/admin/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isUserScope ? { userId: targetUserId } : { role: scope }),
          changes: [{ permission: code, allowed }],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "Could not save that change");
        return;
      }
      await load();
      // A change to your own access reshapes your own menus.
      me.refetch();
    } finally {
      setSaving(false);
    }
  };

  const visibleModules = useMemo(() => {
    if (!search.trim()) return modules;
    const needle = search.toLowerCase();
    return modules
      .map((m) => ({
        ...m,
        permissions: m.permissions.filter(
          (p) =>
            p.code.toLowerCase().includes(needle) ||
            p.label.toLowerCase().includes(needle) ||
            m.label.toLowerCase().includes(needle)
        ),
      }))
      .filter((m) => m.permissions.length > 0);
  }, [modules, search]);

  if (!me.isPending && !me.can("users.permissions")) {
    return (
      <div className="container mx-auto p-8 max-w-2xl">
        <Card>
          <CardContent className="py-16 text-center">
            <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">You cannot manage permissions</p>
            <p className="text-sm text-muted-foreground mt-1">
              Assigning access is restricted to super admins. Ask one to grant you
              <span className="font-mono"> users.permissions</span> if you need it.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6" />
          Permissions
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Set what a role can do, then override it for one person where you need to. A rule can
          take access away as well as give it.
        </p>
      </div>

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Applies to
            </label>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger className="w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">Role: Admin</SelectItem>
                <SelectItem value="BREEDER">Role: Breeder</SelectItem>
                <SelectItem value="BETTOR">Role: Bettor</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={`user:${u.id}`}>
                    {[u.name, u.lastName].filter(Boolean).join(" ") || u.email} ({u.role.toLowerCase()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Find
            </label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="payments, races.manage…"
              className="w-56"
            />
          </div>

          <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="flex h-4 w-4 items-center justify-center rounded border border-emerald-500 bg-emerald-500/15">
                <Check className="h-2.5 w-2.5 text-emerald-600" />
              </span>
              allowed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="flex h-4 w-4 items-center justify-center rounded border border-red-500 bg-red-500/15">
                <X className="h-2.5 w-2.5 text-red-600" />
              </span>
              denied
            </span>
            <span className="flex items-center gap-1.5">
              <span className="flex h-4 w-4 items-center justify-center rounded border border-border bg-muted/40">
                <Minus className="h-2.5 w-2.5" />
              </span>
              default
            </span>
          </div>
        </CardContent>
      </Card>

      {isUserScope && (
        <p className="mb-4 text-xs text-muted-foreground">
          Rules set here override this person&apos;s role. Leaving a cell on default means they
          follow their role.
        </p>
      )}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <div className="space-y-3">
          {visibleModules.map((module) => (
            <Card key={module.key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  {module.label}
                  <span className="text-xs font-normal text-muted-foreground">
                    {module.description}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="divide-y">
                  {module.permissions.map((p) => {
                    const { tri, effective } = stateFor(p.code);
                    return (
                      <div key={p.code} className="flex items-center gap-3 py-1.5">
                        <TriCell
                          state={tri}
                          effective={effective}
                          disabled={saving}
                          onClick={() => setRule(p.code, NEXT[tri])}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm">{p.label}</span>
                            <code className="text-[10px] text-muted-foreground">{p.code}</code>
                            {tri !== "default" && (
                              <Badge variant="outline" className="text-[10px]">
                                {tri === "allow" ? "granted" : "revoked"}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{p.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {overrides.length > 0 && !isUserScope && (
        <Card className="mt-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <UserCog className="h-4 w-4" />
              People with personal overrides
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {overrides.map((o) => (
              <button
                key={o.user.id}
                type="button"
                onClick={() => setScope(`user:${o.user.id}`)}
                className="flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-left text-sm hover:bg-muted/50"
              >
                <span>
                  {[o.user.name, o.user.lastName].filter(Boolean).join(" ") || o.user.email}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {o.user.role.toLowerCase()}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {o.permissions.filter((p) => p.allowed).length} granted ·{" "}
                  {o.permissions.filter((p) => !p.allowed).length} revoked
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
