"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Upload, Download, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

// ─── Export Modal ─────────────────────────────────────────────────────────────

interface ExportField {
  key: string;
  label: string;
}

interface ExportModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fields: ExportField[];
  exportUrl: (selectedFields: string[]) => string;
  filename: string;
}

export function ExportModal({ open, onOpenChange, fields, exportUrl, filename }: ExportModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(fields.map((f) => f.key)));

  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key); else next.add(key);
    setSelected(next);
  };

  const handleExport = () => {
    if (selected.size === 0) { toast.error("Select at least one field"); return; }
    const url = exportUrl([...selected]);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Export CSV</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label className="text-sm text-muted-foreground">Select fields to export</Label>
            <Button variant="ghost" size="sm" onClick={() => {
              if (selected.size === fields.length) setSelected(new Set());
              else setSelected(new Set(fields.map((f) => f.key)));
            }}>
              {selected.size === fields.length ? "Deselect All" : "Select All"}
            </Button>
          </div>
          <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
            {fields.map((f) => (
              <label key={f.key} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                <Checkbox checked={selected.has(f.key)} onCheckedChange={() => toggle(f.key)} />
                <span className="text-sm">{f.label}</span>
              </label>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleExport} disabled={selected.size === 0}>
            <Download className="h-4 w-4 mr-1.5" />Export {selected.size} field{selected.size !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Import Modal ─────────────────────────────────────────────────────────────

interface PreviewRow {
  rowIndex: number;
  status: string;
  message?: string;
  [key: string]: unknown;
}

interface ImportResult {
  rowIndex: number;
  status: string;
  message: string;
}

interface ImportModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  previewUrl: string;
  commitUrl: string;
  previewColumns: { key: string; label: string; render?: (row: PreviewRow) => React.ReactNode }[];
  templateFields: string;
  templateFilename: string;
  onSuccess: () => void;
}

type ImportStep = "upload" | "preview" | "result";

export function ImportModal({
  open,
  onOpenChange,
  previewUrl,
  commitUrl,
  previewColumns,
  templateFields,
  templateFilename,
  onSuccess,
}: ImportModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<ImportStep>("upload");
  const [loading, setLoading] = useState(false);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [summary, setSummary] = useState<{ created: number; failed: number } | null>(null);

  const reset = () => {
    setStep("upload");
    setPreviewRows([]);
    setResults([]);
    setSummary(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(previewUrl, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || "Preview failed"); return; }
      setPreviewRows(data.preview);
      setStep("preview");
    } catch {
      toast.error("Failed to parse CSV");
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    const okRows = previewRows.filter((r) => r.status === "ok");
    if (okRows.length === 0) { toast.error("No valid rows to import"); return; }
    setLoading(true);
    try {
      const res = await fetch(commitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: previewRows }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || "Import failed"); return; }
      setResults(data.results);
      setSummary(data.summary);
      setStep("result");
      onSuccess();
    } catch {
      toast.error("Import failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const csv = templateFields + "\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = templateFilename;
    a.click();
  };

  const okCount = previewRows.filter((r) => r.status === "ok").length;
  const skipCount = previewRows.filter((r) => r.status === "skip_duplicate_band").length;
  const errCount = previewRows.filter((r) => r.status === "error").length;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === "upload" && "Import CSV"}
            {step === "preview" && `Preview — ${previewRows.length} rows`}
            {step === "result" && "Import Complete"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
          {/* Step: Upload */}
          {step === "upload" && (
            <div className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-3">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Select a CSV file to import</p>
                <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={loading}>
                  {loading ? "Parsing…" : "Choose File"}
                </Button>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
              </div>
              <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4 mr-1.5" />Download template CSV
              </Button>
            </div>
          )}

          {/* Step: Preview */}
          {step === "preview" && (
            <div className="space-y-3">
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="h-4 w-4" />{okCount} will import</span>
                {skipCount > 0 && <span className="flex items-center gap-1 text-yellow-600"><AlertCircle className="h-4 w-4" />{skipCount} skipped (duplicate)</span>}
                {errCount > 0 && <span className="flex items-center gap-1 text-red-600"><XCircle className="h-4 w-4" />{errCount} errors</span>}
              </div>
              <div className="border rounded-lg overflow-auto max-h-96">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground w-12">Row</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground w-20">Status</th>
                      {previewColumns.map((col) => (
                        <th key={col.key} className="px-3 py-2 text-left font-medium text-muted-foreground">{col.label}</th>
                      ))}
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {previewRows.map((row) => (
                      <tr key={row.rowIndex} className={
                        row.status === "ok" ? "" :
                        row.status === "error" ? "bg-red-50 dark:bg-red-950/20" :
                        "bg-yellow-50 dark:bg-yellow-950/20"
                      }>
                        <td className="px-3 py-2 text-muted-foreground">{row.rowIndex}</td>
                        <td className="px-3 py-2">
                          {row.status === "ok" && <span className="text-green-600 text-xs font-medium">OK</span>}
                          {row.status === "skip_duplicate_band" && <span className="text-yellow-600 text-xs font-medium">SKIP</span>}
                          {row.status === "error" && <span className="text-red-600 text-xs font-medium">ERROR</span>}
                        </td>
                        {previewColumns.map((col) => (
                          <td key={col.key} className="px-3 py-2">
                            {col.render ? col.render(row) : String(row[col.key] ?? "")}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-xs text-muted-foreground">{row.message || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Step: Result */}
          {step === "result" && summary && (
            <div className="space-y-3">
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="h-4 w-4" />{summary.created} imported</span>
                {summary.failed > 0 && <span className="flex items-center gap-1 text-red-600"><XCircle className="h-4 w-4" />{summary.failed} failed</span>}
              </div>
              {results.filter((r) => r.status === "error").length > 0 && (
                <div className="border rounded-lg overflow-auto max-h-60">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Row</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {results.filter((r) => r.status === "error").map((r) => (
                        <tr key={r.rowIndex} className="bg-red-50 dark:bg-red-950/20">
                          <td className="px-3 py-2">{r.rowIndex}</td>
                          <td className="px-3 py-2 text-red-600 text-xs">{r.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={reset}>Back</Button>
              <Button onClick={handleCommit} disabled={loading || okCount === 0}>
                {loading ? "Importing…" : `Import ${okCount} row${okCount !== 1 ? "s" : ""}`}
              </Button>
            </>
          )}
          {step === "result" && (
            <Button onClick={() => { reset(); onOpenChange(false); }}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
