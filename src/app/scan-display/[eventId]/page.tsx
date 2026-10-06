"use client";

import { use, useEffect, useMemo, useState } from "react";
import {
  SCAN_CATEGORY_STYLE,
  scanCategory,
  scanChannelName,
  type DisplayScan,
  type ScanCategory,
  type ScanMessage,
  type ScanSession,
} from "@/lib/scan-display";
import { useApiQuery } from "@/hooks/useApi";
import { apiEndpoints } from "@/lib/endpoints";
import { useListRaces } from "@/lib/api/races";
import { useAverageResults, useListAverageConfigs } from "@/lib/api/averages";
import type { Race } from "@/lib/types";

const FONT_SIZES = [16, 24, 32, 48] as const;
const FONT_KEY = "scan-display-font";
const AUTO = "auto";

/** Basketing for hot spot N → hot spot N-1; otherwise the latest race already flown. */
function autoReferenceRace(races: Race[], currentRaceId: number | null): Race | undefined {
  const current = races.find((r) => r.id === currentRaceId);
  const hs = current?.raceType?.prizeRole?.match(/^HOTSPOT_(\d)$/);
  if (hs && Number(hs[1]) > 1) {
    const prev = races.find((r) => r.raceType?.prizeRole === `HOTSPOT_${Number(hs[1]) - 1}`);
    if (prev) return prev;
  }
  return races
    .filter((r) => r.id !== currentRaceId && r.status !== "REGISTERING")
    .sort((a, b) => (b.startTime ?? "").localeCompare(a.startTime ?? ""))[0];
}

/**
 * Popup opened by the basket scanners. Holds no data of its own: everything
 * arrives from the opener tab over BroadcastChannel.
 */
export default function ScanDisplayPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  const [session, setSession] = useState<ScanSession | null>(null);
  const [scans, setScans] = useState<DisplayScan[]>([]);
  const [fontSize, setFontSize] = useState<number>(32);
  // Reference race for the "position" line ("auto" or a race id) and the average shown ("" = off).
  const [refChoice, setRefChoice] = useState<string>(AUTO);
  const [avgChoice, setAvgChoice] = useState<string>("");
  const refKey = `scan-display-ref:${eventId}`;
  const avgKey = `scan-display-avg:${eventId}`;

  // Read after mount so the server render matches; localStorage is per-viewer.
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(FONT_KEY));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydrate from storage
      if (FONT_SIZES.includes(saved as (typeof FONT_SIZES)[number])) setFontSize(saved);
      setRefChoice(localStorage.getItem(refKey) || AUTO);
      setAvgChoice(localStorage.getItem(avgKey) || "");
    } catch { /* storage unavailable */ }
  }, [refKey, avgKey]);

  const remember = (key: string, value: string, set: (v: string) => void) => {
    set(value);
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  };

  const pickFont = (size: number) => {
    setFontSize(size);
    try { localStorage.setItem(FONT_KEY, String(size)); } catch { /* ignore */ }
  };

  useEffect(() => {
    const ch = new BroadcastChannel(scanChannelName(eventId));
    ch.onmessage = (e: MessageEvent<ScanMessage>) => {
      const m = e.data;
      if (m.type === "sync") { setSession(m.session); setScans(m.scans); }
      else if (m.type === "session") setSession(m.session);
      else if (m.type === "scan") setScans((prev) => [m.scan, ...prev]);
    };
    ch.postMessage({ type: "hello" } satisfies ScanMessage);
    return () => ch.close();
  }, [eventId]);

  useEffect(() => {
    document.title = session ? `Scanner — ${session.phase}` : "Scanner display";
  }, [session]);

  const stats = useMemo(() => {
    const firsts = scans.filter((s) => s.status !== "duplicate");
    const count = (c: ScanCategory) => firsts.filter((s) => scanCategory(s) === c).length;
    const baskets = new Map<string, { count: number; capacity: number | null }>();
    for (const s of firsts) {
      if (s.status !== "ok" || !s.basket) continue;
      const b = baskets.get(s.basket) ?? { count: 0, capacity: s.basketCapacity ?? null };
      b.count++;
      baskets.set(s.basket, b);
    }
    return {
      scanned: firsts.length,
      basketed: firsts.filter((s) => s.status === "ok").length,
      attention: firsts.filter((s) => s.attention).length,
      stray: firsts.filter((s) => s.stray).length,
      foreign: count("foreign"),
      unplaced: firsts.filter((s) => s.status === "unplaced").length,
      duplicates: scans.length - firsts.length,
      baskets: [...baskets.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })),
    };
  }, [scans]);

  const last = scans[0];
  const lastCat = last ? scanCategory(last) : null;

  // ---- Position in a previous race + average ranking (fetched with the admin's session)
  const seasonId = session?.seasonId ?? null;
  const { data: racesData } = useListRaces({ params: { eventId } });
  const races = useMemo(() => (racesData as { races?: Race[] } | undefined)?.races ?? [], [racesData]);
  const refRace =
    refChoice === AUTO
      ? autoReferenceRace(races, session?.raceId ?? null)
      : races.find((r) => String(r.id) === refChoice);
  const { data: refItemsData } = useApiQuery({
    endpoint: apiEndpoints.raceItems.base,
    queryKey: ["raceItems", "list", `raceId-${refRace?.id ?? ""}`],
    params: refRace ? { raceId: String(refRace.id) } : undefined,
    enabled: !!refRace,
  });
  const positionByBird = useMemo(() => {
    const m = new Map<number, number>();
    type Item = { bird?: { id?: number }; birdPosition?: number | null };
    for (const i of ((refItemsData as { raceItems?: Item[] } | undefined)?.raceItems ?? [])) {
      if (i.bird?.id && i.birdPosition) m.set(i.bird.id, i.birdPosition);
    }
    return m;
  }, [refItemsData]);

  const { data: avgConfigsData } = useListAverageConfigs(eventId, seasonId);
  const avgConfigs = (Array.isArray(avgConfigsData) ? avgConfigsData : []) as { id: number; name: string }[];
  const avgConfig = avgConfigs.find((c) => String(c.id) === avgChoice);
  const { data: avgData } = useAverageResults(eventId, avgConfig ? avgConfig.id : null, seasonId);
  const averageByBird = useMemo(() => {
    const m = new Map<number, { rank: number | null; speed: number | null }>();
    type Row = { birdId: number; rank: number | null; avgSpeedYPM: number | null };
    for (const r of ((avgData as { results?: Row[] } | undefined)?.results ?? [])) {
      m.set(r.birdId, { rank: r.rank, speed: r.avgSpeedYPM });
    }
    return m;
  }, [avgData]);

  const lastPosition = last?.birdId ? positionByBird.get(last.birdId) : undefined;
  const lastAverage = last?.birdId ? averageByBird.get(last.birdId) : undefined;

  const tiles: { label: string; value: number | string; cls: string }[] = [
    { label: "Yet to scan", value: session?.remaining ?? "—", cls: "bg-white text-slate-950" },
    { label: "Scanned", value: stats.scanned, cls: "bg-slate-800 text-white" },
    { label: "Basketed", value: stats.basketed, cls: SCAN_CATEGORY_STYLE.ok.solid },
    { label: "Pay attention", value: stats.attention, cls: SCAN_CATEGORY_STYLE.attention.solid },
    { label: "Lost → stray", value: stats.stray, cls: SCAN_CATEGORY_STYLE.stray.solid },
    { label: "Foreign", value: stats.foreign, cls: SCAN_CATEGORY_STYLE.foreign.solid },
    { label: "No basket", value: stats.unplaced, cls: SCAN_CATEGORY_STYLE.unplaced.solid },
    { label: "Already scanned", value: stats.duplicates, cls: SCAN_CATEGORY_STYLE.duplicate.solid },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-full max-w-[1800px] flex-col gap-4 p-4">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-4">
          <span
            className={`h-4 w-4 rounded-full ${session?.running ? "bg-green-500 animate-pulse" : "bg-slate-500"}`}
            title={session?.running ? "Scanner running" : "Scanner stopped"}
          />
          <h1 className="text-3xl font-bold">
            {session?.phase ?? "Waiting for scanner…"}
            {session?.raceName && <span className="ml-3 text-slate-400">· {session.raceName}</span>}
          </h1>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-lg text-slate-400">
              Position from
              <select
                value={refChoice}
                onChange={(e) => remember(refKey, e.target.value, setRefChoice)}
                className="rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-lg text-slate-100"
              >
                <option value={AUTO}>Auto{refChoice === AUTO && refRace ? ` (${refRace.name ?? `Race ${refRace.id}`})` : ""}</option>
                {races.filter((r) => r.id !== session?.raceId).map((r) => (
                  <option key={r.id} value={String(r.id)}>{r.name ?? `Race ${r.id}`}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-lg text-slate-400">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={!!avgChoice}
                disabled={avgConfigs.length === 0}
                onChange={(e) => remember(avgKey, e.target.checked ? String(avgConfigs[0]?.id ?? "") : "", setAvgChoice)}
              />
              Average
              {avgChoice && (
                <select
                  value={avgChoice}
                  onChange={(e) => remember(avgKey, e.target.value, setAvgChoice)}
                  className="rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-lg text-slate-100"
                >
                  {avgConfigs.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                </select>
              )}
            </label>
            <span className="ml-2 text-lg text-slate-400">Text size</span>
            {FONT_SIZES.map((s) => (
              <button
                key={s}
                onClick={() => pickFont(s)}
                className={`rounded-md border px-3 py-1.5 text-lg font-semibold transition-colors ${
                  fontSize === s ? "border-white bg-white text-slate-950" : "border-slate-600 hover:bg-slate-800"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
          {tiles.map((t) => (
            <div key={t.label} className={`rounded-xl px-4 py-3 ${t.cls}`}>
              <div className="text-lg font-medium opacity-90">{t.label}</div>
              <div className="text-5xl font-bold tabular-nums">{t.value}</div>
            </div>
          ))}
        </div>

        {/* Last scan */}
        <div
          className={`rounded-2xl p-6 ${lastCat ? SCAN_CATEGORY_STYLE[lastCat].solid : "bg-slate-800 text-slate-300"}`}
          style={{ fontSize }}
        >
          {!last ? (
            <div className="py-8 text-center">Scan a bird to begin</div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="space-y-1">
                <div className="text-[0.6em] font-semibold uppercase tracking-wide opacity-90">
                  {SCAN_CATEGORY_STYLE[lastCat!].label}
                  {last.attention && lastCat !== "attention" && " · Pay attention"}
                  {last.stray && lastCat !== "stray" && " · Lost → stray"}
                  {last.status === "duplicate" && lastCat !== "duplicate" && " · Already scanned"}
                </div>
                <div className="font-mono text-[1.75em] font-bold leading-tight">{last.band || last.rfid}</div>
                {last.birdName && <div className="text-[1.1em] font-semibold">{last.birdName}</div>}
                {(last.breeder || last.loftName) && (
                  <div>{[last.breeder, last.loftName].filter(Boolean).join(" · ")}</div>
                )}
                {last.note && <div className="text-[0.75em] italic opacity-90">{last.note}</div>}
              </div>
              {(refRace || avgConfig) && last.status !== "foreign" && (
                <div className="space-y-2 text-center">
                  {refRace && (
                    <div>
                      <div className="text-[0.55em] font-semibold uppercase tracking-wide opacity-90">
                        Position · {refRace.name ?? `Race ${refRace.id}`}
                      </div>
                      <div className="text-[1.5em] font-black leading-tight">{lastPosition ? `#${lastPosition}` : "—"}</div>
                    </div>
                  )}
                  {avgConfig && (
                    <div>
                      <div className="text-[0.55em] font-semibold uppercase tracking-wide opacity-90">
                        Average · {avgConfig.name}
                      </div>
                      <div className="text-[1.1em] font-bold leading-tight">
                        {lastAverage?.rank ? `#${lastAverage.rank}` : "—"}
                        {lastAverage?.speed != null && (
                          <span className="ml-3 font-semibold">{lastAverage.speed.toFixed(2)} ypm</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="text-right">
                <div className="text-[0.6em] font-semibold uppercase tracking-wide opacity-90">Basket</div>
                <div className="text-[2em] font-black leading-tight">{last.basket || "—"}</div>
              </div>
            </div>
          )}
        </div>

        <div className="grid flex-1 gap-4 lg:grid-cols-[1fr_22rem]">
          {/* Scan list */}
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full" style={{ fontSize }}>
              <thead className="bg-slate-800 text-[0.6em] uppercase tracking-wide text-slate-300">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Band</th>
                  <th className="px-3 py-2 text-left">Bird / Breeder</th>
                  <th className="px-3 py-2 text-left">Basket</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {scans.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">No scans yet</td></tr>
                ) : scans.map((s, i) => {
                  const cat = scanCategory(s);
                  return (
                    <tr key={s.id} className={`border-l-8 border-b border-b-slate-800 ${SCAN_CATEGORY_STYLE[cat].soft}`}>
                      <td className="px-3 py-1.5 tabular-nums opacity-60">{scans.length - i}</td>
                      <td className="px-3 py-1.5 font-mono font-bold whitespace-nowrap">{s.band || s.rfid}</td>
                      <td className="px-3 py-1.5">
                        {[s.birdName, s.breeder].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="px-3 py-1.5 font-bold whitespace-nowrap">{s.basket || "—"}</td>
                      <td className="px-3 py-1.5 text-[0.7em] font-semibold">
                        {[
                          SCAN_CATEGORY_STYLE[cat].label,
                          s.attention && cat !== "attention" && "Attention",
                          s.stray && cat !== "stray" && "Stray",
                        ].filter(Boolean).join(" · ")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Baskets + legend */}
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-700">
              <div className="border-b border-slate-700 px-4 py-2 text-xl font-semibold">Baskets</div>
              {stats.baskets.length === 0 ? (
                <div className="px-4 py-6 text-lg text-slate-400">None yet</div>
              ) : (
                <div className="divide-y divide-slate-800" style={{ fontSize: Math.max(16, fontSize * 0.75) }}>
                  {stats.baskets.map(([label, b]) => {
                    const full = b.capacity != null && b.count >= b.capacity;
                    return (
                      <div key={label} className="flex items-center justify-between gap-3 px-4 py-2">
                        <span className="truncate font-semibold" title={label}>{label}</span>
                        <span className={`shrink-0 whitespace-nowrap tabular-nums font-bold ${full ? "text-red-400" : ""}`}>
                          {b.count}{b.capacity != null && <span className="text-slate-400"> / {b.capacity}</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="space-y-2 rounded-xl border border-slate-700 p-4">
              <div className="text-xl font-semibold">Legend</div>
              {(Object.keys(SCAN_CATEGORY_STYLE) as ScanCategory[]).map((c) => (
                <div key={c} className={`rounded-md px-3 py-1.5 text-lg font-semibold ${SCAN_CATEGORY_STYLE[c].solid}`}>
                  {SCAN_CATEGORY_STYLE[c].label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
