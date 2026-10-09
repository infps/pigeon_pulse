"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Formats that render in a browser frame. CSV/XLSX are data files and download directly. */
export const isPreviewableFormat = (format: string) => format === "pdf" || format === "html";

interface DocumentPreviewProps {
  /** URL that returns the document (PDF or HTML). Fetched with the session cookie. */
  url: string | null;
  title: string;
  onClose: () => void;
}

/**
 * Preview a generated document in a dialog; the Download button saves it.
 * Every PDF/HTML the app generates opens through this instead of downloading.
 */
export function DocumentPreview({ url, title, onClose }: DocumentPreviewProps) {
  // Keyed by url so a stale result for a previous document is never shown.
  const [result, setResult] = useState<{ url: string; blobUrl?: string; filename?: string; error?: string } | null>(null);

  useEffect(() => {
    if (!url) return;
    let revoke: string | null = null;
    let cancelled = false;
    fetch(url, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.message ?? `Failed to load document (${res.status})`);
        }
        const filename = /filename="?([^";]+)"?/.exec(res.headers.get("Content-Disposition") ?? "")?.[1];
        const blob = await res.blob();
        if (cancelled) return;
        revoke = URL.createObjectURL(blob);
        setResult({ url, blobUrl: revoke, filename });
      })
      .catch((e: unknown) => {
        if (!cancelled) setResult({ url, error: e instanceof Error ? e.message : "Failed to load document" });
      });
    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [url]);

  const current = result?.url === url ? result : null;
  const blobUrl = current?.blobUrl ?? null;
  const error = current?.error ?? null;

  return (
    <Dialog open={!!url} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl h-[90vh] !flex flex-col gap-3">
        <DialogHeader className="shrink-0 pr-8">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle>{title}</DialogTitle>
            <Button asChild size="sm" disabled={!blobUrl}>
              <a href={blobUrl ?? undefined} download={current?.filename ?? "document"}>
                <Download className="h-4 w-4 mr-1.5" />
                Download
              </a>
            </Button>
          </div>
          <DialogDescription className="sr-only">Document preview</DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 rounded-md border overflow-hidden bg-muted/30">
          {error ? (
            <p className="p-6 text-sm text-red-500">{error}</p>
          ) : blobUrl ? (
            <iframe src={blobUrl} title={title} className="h-full w-full bg-white" />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Preparing document…
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** State wrapper: `show(url, title)` opens the preview; render `previewNode` once. */
export function useDocumentPreview() {
  const [doc, setDoc] = useState<{ url: string; title: string } | null>(null);
  const show = useCallback((url: string, title: string) => setDoc({ url, title }), []);
  const previewNode = <DocumentPreview url={doc?.url ?? null} title={doc?.title ?? ""} onClose={() => setDoc(null)} />;
  return { show, previewNode };
}
