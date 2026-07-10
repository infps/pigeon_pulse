"use client";

import { useState } from "react";
import { useApiQuery } from "@/hooks/useApi";
import { useApiMutation } from "@/hooks/useApiMutation";
import { apiEndpoints } from "@/lib/endpoints";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Pencil, Plus, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface BirdStatusCode {
  id: number;
  code: number;
  label: string;
  color: string | null;
}

const DEFAULTS = [
  { code: 999, label: "Dead",    color: "#ef4444" },
  { code: 777, label: "Injured", color: "#f97316" },
];

const EMPTY = { code: "", label: "", color: "#6b7280" };

export default function SchemaPage() {
  const [form, setForm]       = useState(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data, isPending, refetch } = useApiQuery({
    endpoint: apiEndpoints.birdStatusCodes.base,
    queryKey: ["bird-status-codes"],
  });

  const codes: BirdStatusCode[] = data?.codes ?? [];

  const createMutation = useApiMutation({
    endpoint: apiEndpoints.birdStatusCodes.base,
    method: "POST",
    queryKey: ["bird-status-codes"],
    onSuccess: () => { toast.success("Code created"); resetForm(); refetch(); },
    onError: (e: { message?: string }) => toast.error(e?.message ?? "Failed to create"),
  });

  const updateMutation = useApiMutation({
    endpoint: apiEndpoints.birdStatusCodes.base,
    method: "PUT",
    queryKey: ["bird-status-codes"],
    onSuccess: () => { toast.success("Code updated"); resetForm(); refetch(); },
    onError: (e: { message?: string }) => toast.error(e?.message ?? "Failed to update"),
  });

  const deleteMutation = useApiMutation({
    endpoint: apiEndpoints.birdStatusCodes.base,
    method: "DELETE",
    queryKey: ["bird-status-codes"],
    onSuccess: () => { toast.success("Code deleted"); refetch(); },
    onError: () => toast.error("Failed to delete"),
  });

  const resetForm = () => { setForm(EMPTY); setEditingId(null); };

  const startEdit = (c: BirdStatusCode) => {
    setEditingId(c.id);
    setForm({ code: String(c.code), label: c.label, color: c.color ?? "#6b7280" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const codeNum = parseInt(form.code);
    if (isNaN(codeNum) || codeNum <= 0) { toast.error("Code must be a positive number"); return; }
    if (!form.label.trim()) { toast.error("Label is required"); return; }

    const payload = { code: codeNum, label: form.label.trim(), color: form.color || undefined };
    if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, ...payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
  };

  const handleDelete = async (c: BirdStatusCode) => {
    if (!confirm(`Delete code ${c.code} (${c.label})?`)) return;
    await deleteMutation.mutateAsync({ id: c.id });
  };

  const loadDefaults = async () => {
    const existing = new Set(codes.map((c) => c.code));
    const toAdd = DEFAULTS.filter((d) => !existing.has(d.code));
    if (toAdd.length === 0) { toast.info("Defaults already loaded"); return; }
    for (const d of toAdd) {
      await createMutation.mutateAsync(d);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Schema</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure special position codes that mark bird conditions in race results.
        </p>
      </div>

      {/* Bird Status Codes */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Bird Status Codes</CardTitle>
              <CardDescription className="mt-1">
                When a bird&apos;s position matches a code, the label is shown instead of the number.
                e.g. position 999 → &quot;Dead&quot;.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadDefaults} disabled={isSaving}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Load defaults
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Form */}
          <form onSubmit={handleSubmit} className="grid grid-cols-[80px_1fr_100px_auto] gap-2 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Code</Label>
              <Input
                type="number"
                min={1}
                placeholder="999"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Label</Label>
              <Input
                placeholder="Dead"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Color</Label>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="h-9 w-10 cursor-pointer rounded border border-input p-0.5"
                />
                <span className="text-xs text-muted-foreground font-mono">{form.color}</span>
              </div>
            </div>
            <div className="flex gap-1.5">
              <Button type="submit" size="sm" disabled={isSaving}>
                {editingId ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {editingId ? "Save" : "Add"}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" size="sm" onClick={resetForm}>
                  Cancel
                </Button>
              )}
            </div>
          </form>

          {/* List */}
          {isPending ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : codes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No codes yet. Add one above or click &quot;Load defaults&quot;.
            </p>
          ) : (
            <div className="rounded-md border divide-y">
              {codes.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex items-center justify-center rounded-full w-7 h-7 text-xs font-bold text-white"
                      style={{ backgroundColor: c.color ?? "#6b7280" }}
                    >
                      {c.code}
                    </span>
                    <span className="font-medium text-sm">{c.label}</span>
                    <span className="text-xs text-muted-foreground font-mono">{c.color}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => startEdit(c)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleDelete(c)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
