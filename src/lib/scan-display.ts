"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";

/**
 * Big-screen scan display. The scanner UI (loft scan, race prescan, bird prescan)
 * keeps polling the reader; every scan is broadcast to a popup window on the same
 * origin via BroadcastChannel. The popup asks for a sync on load, so refreshing
 * or reopening it keeps the session's history.
 */

export type ScanStatus = "ok" | "duplicate" | "foreign" | "unplaced";

export type DisplayScan = {
  id: string;
  at: string;
  rfid: string;
  status: ScanStatus;
  /** Lets the display look up past positions and averages. */
  birdId?: number | null;
  band?: string | null;
  birdName?: string | null;
  breeder?: string | null;
  loftName?: string | null;
  basket?: string | null;
  basketCapacity?: number | null;
  attention?: boolean;
  /** Bird is flagged lost and turned up again. */
  stray?: boolean;
  note?: string | null;
};

export type ScanSession = {
  phase: string;
  raceName: string | null;
  /** Race being basketed for; the display picks the previous hot spot from it. */
  raceId: number | null;
  seasonId: number | null;
  running: boolean;
  /** Birds this scanner still expects to see; null when unknown. */
  remaining: number | null;
};

export type ScanMessage =
  | { type: "hello" }
  | { type: "sync"; session: ScanSession; scans: DisplayScan[] }
  | { type: "session"; session: ScanSession }
  | { type: "scan"; scan: DisplayScan };

export type ScanCategory = "foreign" | "stray" | "attention" | "duplicate" | "unplaced" | "ok";

/** Most important flag wins the row colour. */
export function scanCategory(s: DisplayScan): ScanCategory {
  if (s.status === "foreign") return "foreign";
  if (s.stray) return "stray";
  if (s.attention) return "attention";
  if (s.status === "duplicate") return "duplicate";
  if (s.status === "unplaced") return "unplaced";
  return "ok";
}

export const SCAN_CATEGORY_STYLE: Record<ScanCategory, { label: string; solid: string; soft: string }> = {
  ok: { label: "Basketed", solid: "bg-green-600 text-white", soft: "bg-green-100 text-green-950 border-green-500" },
  attention: { label: "Pay attention", solid: "bg-yellow-400 text-black", soft: "bg-yellow-100 text-yellow-950 border-yellow-500" },
  stray: { label: "Lost → stray", solid: "bg-orange-500 text-white", soft: "bg-orange-100 text-orange-950 border-orange-500" },
  foreign: { label: "Foreign", solid: "bg-red-600 text-white", soft: "bg-red-100 text-red-950 border-red-500" },
  unplaced: { label: "No basket", solid: "bg-sky-600 text-white", soft: "bg-sky-100 text-sky-950 border-sky-500" },
  duplicate: { label: "Already scanned", solid: "bg-gray-500 text-white", soft: "bg-gray-100 text-gray-800 border-gray-400" },
};

export const scanChannelName = (eventId: string | number) => `scan-display:${eventId}`;

export function useScanDisplay(eventId: string, session: ScanSession) {
  const chanRef = useRef<BroadcastChannel | null>(null);
  const scansRef = useRef<DisplayScan[]>([]);
  const sessionRef = useRef<ScanSession>(session);
  const sessionKey = JSON.stringify(session);

  useEffect(() => {
    const ch = new BroadcastChannel(scanChannelName(eventId));
    chanRef.current = ch;
    ch.onmessage = (e: MessageEvent<ScanMessage>) => {
      if (e.data?.type === "hello") {
        ch.postMessage({ type: "sync", session: sessionRef.current, scans: scansRef.current } satisfies ScanMessage);
      }
    };
    return () => { ch.close(); chanRef.current = null; };
  }, [eventId]);

  useEffect(() => {
    sessionRef.current = JSON.parse(sessionKey);
    chanRef.current?.postMessage({ type: "session", session: sessionRef.current } satisfies ScanMessage);
  }, [sessionKey]);

  const publish = useCallback((scan: Omit<DisplayScan, "id" | "at">) => {
    const full: DisplayScan = { ...scan, id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, at: new Date().toISOString() };
    // ponytail: capped in-memory history, enough for one basketing session
    scansRef.current = [full, ...scansRef.current].slice(0, 2000);
    chanRef.current?.postMessage({ type: "scan", scan: full } satisfies ScanMessage);
  }, []);

  /** Last non-duplicate scan of this tag in the session, if any. */
  const find = useCallback(
    (rfid: string) => scansRef.current.find((s) => s.rfid === rfid && s.status !== "duplicate"),
    []
  );

  const open = useCallback(() => {
    const w = window.open(`/scan-display/${eventId}`, `scan-display-${eventId}`, "popup,width=1400,height=900");
    if (!w) toast.error("Popup blocked — allow popups for this site, then click Display");
  }, [eventId]);

  return useMemo(() => ({ publish, find, open }), [publish, find, open]);
}
