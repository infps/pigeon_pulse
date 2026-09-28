"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

/**
 * Landing page for the OBS overlay system.
 *
 * Visit /overlay?race=<id> to jump straight to the live overlay without
 * touching a Next.js route. The form is here for humans setting up OBS;
 * the URL they paste into OBS is /overlay/race/<id>.
 */
function OverlayPicker() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [raceId, setRaceId] = useState(searchParams.get("race") ?? "");

  // If ?race=<id> present, redirect immediately to the overlay route.
  const fromQuery = searchParams.get("race");
  if (fromQuery) {
    router.replace(`/overlay/race/${fromQuery}`);
    return null;
  }

  const go = () => {
    const id = raceId.trim();
    if (!id) return;
    router.push(`/overlay/race/${id}`);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        gap: 24,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 11, letterSpacing: 3, opacity: 0.5, fontWeight: 600, marginBottom: 8 }}>
          PIGEON PULSE
        </div>
        <div style={{ fontSize: 28, fontWeight: 800 }}>OBS Overlay</div>
        <div style={{ fontSize: 13, opacity: 0.5, marginTop: 6 }}>
          Enter a race ID or paste <code style={{ opacity: 0.8 }}>/overlay?race=ID</code> to jump directly.
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <input
          type="number"
          placeholder="Race ID"
          value={raceId}
          onChange={(e) => setRaceId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go()}
          style={{
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 8,
            color: "#fff",
            padding: "10px 16px",
            fontSize: 15,
            outline: "none",
            width: 160,
          }}
        />
        <button
          onClick={go}
          style={{
            background: "#0891b2",
            border: "none",
            borderRadius: 8,
            color: "#fff",
            padding: "10px 20px",
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Open overlay →
        </button>
      </div>

      <div style={{ fontSize: 12, opacity: 0.35, textAlign: "center", maxWidth: 360 }}>
        The overlay URL format is <code>/overlay/race/&#123;id&#125;</code>.
        Paste it into OBS as a Browser Source at 1920×1080 with transparent background.
      </div>
    </div>
  );
}

export default function OverlayPage() {
  return (
    <Suspense>
      <OverlayPicker />
    </Suspense>
  );
}
