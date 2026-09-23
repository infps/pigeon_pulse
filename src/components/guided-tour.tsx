"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { eventTour } from "@/lib/help-content";

// Lightweight step-through tour for the event page. No dependency: it finds the
// target tab trigger by [data-tour="<tab>"], draws a highlight ring around it,
// and shows a floating card anchored below it. The parent supplies onGoToTab so
// the step's panel is switched into view as we advance.
// ponytail: hand-rolled over driver.js/joyride — 8 steps, one anchor per step,
// no scrolling/masking needed. Reach for a lib if tours spread across pages.

export function GuidedTour({
  onGoToTab,
  onClose,
}: {
  onGoToTab: (tab: string) => void;
  onClose: () => void;
}) {
  const [i, setI] = useState(0);
  const step = eventTour[i];
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Switch to the step's tab so its panel shows while we describe it. Keep the
  // callback in a ref so an unstable onGoToTab prop doesn't re-fire the effect
  // (that caused an infinite setState loop). Effect depends only on the tab.
  const goRef = useRef(onGoToTab);
  goRef.current = onGoToTab;
  useEffect(() => {
    goRef.current(step.tab);
  }, [step.tab]);

  // Measure the target trigger after the tab switch paints. Re-measure on
  // resize/scroll so the highlight tracks the element.
  useLayoutEffect(() => {
    const measure = () => {
      const el = document.querySelector<HTMLElement>(
        `[data-tour="${step.tab}"]`
      );
      setRect(el ? el.getBoundingClientRect() : null);
      el?.scrollIntoView({ block: "nearest", inline: "center" });
    };
    // rAF: let the tab list re-render (active trigger may resize) before measuring.
    const id = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step.tab]);

  const last = i === eventTour.length - 1;
  const next = () => (last ? onClose() : setI((n) => n + 1));
  const prev = () => setI((n) => Math.max(0, n - 1));

  // Card position: below the target, clamped to viewport. Falls back to centered
  // if the target isn't found (e.g. tab hidden by permissions).
  const cardTop = rect ? rect.bottom + 12 : 120;
  const cardLeft = rect
    ? Math.min(Math.max(rect.left, 12), window.innerWidth - 332)
    : window.innerWidth / 2 - 160;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* dim + swallow clicks so the tour drives navigation */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* highlight ring around the target trigger */}
      {rect && (
        <div
          className="pointer-events-none absolute rounded-md ring-2 ring-primary ring-offset-2 ring-offset-background"
          style={{
            top: rect.top - 2,
            left: rect.left - 2,
            width: rect.width + 4,
            height: rect.height + 4,
          }}
        />
      )}

      <div
        className="absolute w-80 rounded-lg border bg-background p-4 shadow-lg"
        style={{ top: cardTop, left: cardLeft }}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold">{step.title}</h3>
          <button
            onClick={onClose}
            aria-label="End tour"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{step.blurb}</p>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {i + 1} / {eventTour.length}
          </span>
          <div className="flex gap-2">
            {i > 0 && (
              <Button variant="outline" size="sm" onClick={prev}>
                Back
              </Button>
            )}
            <Button size="sm" onClick={next}>
              {last ? "Done" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
