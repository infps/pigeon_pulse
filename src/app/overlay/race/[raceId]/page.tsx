"use client";

import { use, useEffect, useRef, useState } from "react";

interface Arrival {
  id: number;
  rank: number | null;
  status: string;
  band: string;
  birdName: string | null;
  loftName: string;
  loftImage: string | null;
  countryCode: string | null;
  arrivalTime: string | null;
  ypm: number | null;
  gapMs: number | null;
  prevRank?: number | null; // client-computed, not from API
}

interface OverlayData {
  race: {
    id: number;
    name: string;
    status: string;
    eventName: string | null;
    eventLogo: string | null;
  };
  arrivals: Arrival[];
  latestId: number | null;
  count: number;
}

const POLL_MS = 5000;
/** How long a new arrival stays on screen before fading. */
const CARD_MS = 8000;

function clockTime(iso: string | null): string {
  if (!iso) return "--:--:--";
  const d = new Date(iso);
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

function gapLabel(ms: number | null): string {
  if (ms == null || ms <= 0) return "leader";
  const s = Math.round(ms / 1000);
  if (s < 60) return `+${s}s`;
  const m = Math.floor(s / 60);
  return `+${m}m ${String(s % 60).padStart(2, "0")}s`;
}

function flag(code: string | null): string {
  if (!code || code.length !== 2) return "";
  return String.fromCodePoint(
    ...code.toUpperCase().split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

/**
 * The broadcast overlay.
 *
 * Drawn to sit on top of a live video feed in OBS, so everything here is either
 * a panel with its own dark backing or nothing at all — no page background, no
 * chrome, no white.
 *
 * Three pieces, each answering a different viewer's question:
 *
 *   the left panel   — "who is home?"      a standing order of arrivals
 *   the bottom card  — "what just happened?"  the bird that landed, for 8s
 *   the ticker       — "am I in this?"     everyone, cycling, forever
 *
 * It polls rather than holding a socket open. The machine running this is also
 * encoding video, and a dropped socket that silently stops updating is far
 * worse on air than a request every five seconds.
 */
export default function RaceOverlay({
  params,
}: {
  params: Promise<{ raceId: string }>;
}) {
  const { raceId } = use(params);
  const [data, setData] = useState<OverlayData | null>(null);
  const [flash, setFlash] = useState<Arrival | null>(null);
  const lastSeen = useRef<number | null>(null);
  const firstLoad = useRef(true);
  // ponytail: prev rank map keyed by arrival id, updated each poll
  const prevRankMap = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const load = async () => {
      try {
        const res = await fetch(`/api/public/race/${raceId}/overlay`, {
          cache: "no-store",
        });
        if (res.ok && !cancelled) {
          const next: OverlayData = await res.json();
          // Annotate each arrival with its previous rank before updating the map
          next.arrivals = next.arrivals.map((a) => ({
            ...a,
            prevRank: prevRankMap.current.get(a.id) ?? null,
          }));
          next.arrivals.forEach((a) => {
            if (a.rank != null) prevRankMap.current.set(a.id, a.rank);
          });
          setData(next);

          // A bird that arrived while the overlay was already running gets the
          // card. The first poll does not — otherwise opening the scene mid-race
          // would announce a bird that landed an hour ago as breaking news.
          if (next.latestId != null && next.latestId !== lastSeen.current) {
            if (!firstLoad.current) {
              const arrival = next.arrivals.find((a) => a.id === next.latestId);
              if (arrival) {
                setFlash(arrival);
                if (timer) clearTimeout(timer);
                timer = setTimeout(() => setFlash(null), CARD_MS);
              }
            }
            lastSeen.current = next.latestId;
          }
          firstLoad.current = false;
        }
      } catch {
        // A failed poll is not worth drawing. The last good frame stays up,
        // which on air is the correct behaviour.
      }
    };

    load();
    const interval = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
      if (timer) clearTimeout(timer);
    };
  }, [raceId]);

  if (!data) return null;

  const ranked = data.arrivals.filter((a) => a.rank != null);
  const nonFinished = data.arrivals.filter((a) => a.rank == null);
  const top = ranked.slice(0, 10);
  const rest = ranked.slice(10, 28);

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh", overflow: "hidden" }}>
      {/* LEFT — the standing order */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 340,
          height: "100%",
          background: "rgba(0,0,0,0.72)",
          backdropFilter: "blur(6px)",
          color: "#fff",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "16px 18px 10px", borderBottom: "1px solid rgba(255,255,255,0.15)" }}>
          <div style={{ fontSize: 11, letterSpacing: 2, opacity: 0.6, fontWeight: 600 }}>
            LATEST ARRIVALS
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, marginTop: 3 }}>{data.race.name}</div>
          <div style={{ fontSize: 12, opacity: 0.55 }}>
            {data.count} home{data.race.eventName ? ` · ${data.race.eventName}` : ""}
          </div>
        </div>

        <div style={{ flex: 1, overflow: "hidden", padding: "6px 0" }}>
          {top.map((a) => (
            <Row key={a.id} a={a} bright />
          ))}
          {rest.length > 0 && (
            <div style={{ height: 1, background: "rgba(255,255,255,0.15)", margin: "8px 14px" }} />
          )}
          {rest.map((a) => (
            <Row key={a.id} a={a} />
          ))}
          {/* Non-finishers: foreign / stray / lost at the bottom */}
          {nonFinished.length > 0 && (
            <>
              <div style={{ height: 1, background: "rgba(255,100,100,0.25)", margin: "8px 14px" }} />
              {nonFinished.map((a) => (
                <Row key={a.id} a={a} nonFinish />
              ))}
            </>
          )}
          {ranked.length === 0 && nonFinished.length === 0 && (
            <div style={{ padding: 20, opacity: 0.5, fontSize: 13 }}>No birds home yet.</div>
          )}
        </div>
      </div>

      {/* BOTTOM CENTRE — the bird that just landed */}
      {flash && (
        <div
          style={{
            position: "absolute",
            bottom: 74,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.82)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 14,
            padding: "14px 22px",
            color: "#fff",
            fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
            display: "flex",
            alignItems: "center",
            gap: 16,
            minWidth: 420,
            animation: "overlayIn 400ms ease-out",
          }}
        >
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: "50%",
              background: "#0891b2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            {flash.rank ?? "—"}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 21, fontWeight: 800, lineHeight: 1.15 }}>
              {flag(flash.countryCode)} {flash.loftName}
            </div>
            <div style={{ fontSize: 12.5, opacity: 0.75, fontFamily: "ui-monospace, monospace" }}>
              {flash.band}
              {flash.ypm ? ` · ${flash.ypm.toLocaleString()} YPM` : ""}
            </div>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              {clockTime(flash.arrivalTime)}
            </div>
            <div style={{ fontSize: 12, opacity: 0.65 }}>{gapLabel(flash.gapMs)}</div>
          </div>
        </div>
      )}

      {/* BOTTOM — the ticker (ranked birds only) */}
      {ranked.length > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: "100%",
            height: 50,
            background: "rgba(0,0,0,0.78)",
            backdropFilter: "blur(6px)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            overflow: "hidden",
            fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              whiteSpace: "nowrap",
              animation: `overlayTicker ${Math.max(28, ranked.length * 3.2)}s linear infinite`,
            }}
          >
            {[0, 1].map((copy) => (
              <span key={copy} style={{ display: "inline-flex" }}>
                {ranked.map((a) => (
                  <span
                    key={`${copy}-${a.id}`}
                    style={{ padding: "0 26px", fontSize: 15, opacity: 0.92 }}
                  >
                    <b style={{ color: "#22d3ee" }}>#{a.rank}</b>{" "}
                    <b>{a.loftName}</b>{" "}
                    <span style={{ opacity: 0.6, fontFamily: "ui-monospace, monospace" }}>
                      {a.band}
                    </span>
                    {a.ypm ? <span style={{ opacity: 0.75 }}> {a.ypm.toLocaleString()} YPM</span> : null}
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes overlayTicker {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes overlayIn {
          from { opacity: 0; transform: translateX(-50%) translateY(14px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}

function rankDiff(rank: number | null | undefined, prevRank: number | null | undefined) {
  if (rank == null || prevRank == null) return null;
  const diff = prevRank - rank; // positive = moved up
  if (diff === 0) return { label: "–", color: "rgba(255,255,255,0.4)" };
  if (diff > 0) return { label: `▲${diff}`, color: "#4ade80" };
  return { label: `▼${Math.abs(diff)}`, color: "#f87171" };
}

const STATUS_LABEL: Record<string, string> = {
  FOREIGN_BIRD: "FOREIGN",
  STRAY: "STRAY",
  LOST: "LOST",
};

function Row({
  a,
  bright = false,
  nonFinish = false,
}: {
  a: Arrival;
  bright?: boolean;
  nonFinish?: boolean;
}) {
  const diff = rankDiff(a.rank, a.prevRank);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 16px",
        opacity: nonFinish ? 0.45 : bright ? 1 : 0.58,
        background: bright && (a.rank ?? 99) <= 3 ? "rgba(34,211,238,0.10)" : "transparent",
      }}
    >
      {/* rank + movement */}
      <div style={{ width: 42, flexShrink: 0, textAlign: "center" }}>
        {nonFinish ? (
          <div style={{ fontSize: 9, fontWeight: 700, color: "#f87171", letterSpacing: 0.5 }}>
            {STATUS_LABEL[a.status] ?? a.status}
          </div>
        ) : (
          <>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: (a.rank ?? 99) <= 3 ? "#22d3ee" : "#fff",
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1,
              }}
            >
              {a.rank ?? "—"}
            </div>
            {diff && (
              <div style={{ fontSize: 9, fontWeight: 700, color: diff.color, marginTop: 1 }}>
                {diff.label}
              </div>
            )}
          </>
        )}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {a.loftName}
        </div>
        <div style={{ fontSize: 10.5, opacity: 0.6, fontFamily: "ui-monospace, monospace" }}>
          {a.band}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        {a.ypm ? (
          <div style={{ fontSize: 12, fontWeight: 700, color: "#22d3ee", fontVariantNumeric: "tabular-nums" }}>
            {a.ypm.toLocaleString()} <span style={{ fontSize: 9, opacity: 0.7 }}>YPM</span>
          </div>
        ) : null}
        <div style={{ fontSize: 11, opacity: 0.6, fontVariantNumeric: "tabular-nums" }}>
          {clockTime(a.arrivalTime)}
        </div>
      </div>
    </div>
  );
}
