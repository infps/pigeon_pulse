import type { ReactNode } from "react";

// Never prerendered: the whole point is that it is current.
export const dynamic = "force-dynamic";

/**
 * A layout with nothing in it.
 *
 * The overlay is a browser source inside OBS, sitting on top of live video.
 * Anything the app would normally wrap a page in — navigation, a header, a
 * background colour — would be composited over the broadcast, so this layout
 * exists purely to stop the admin shell being inherited.
 *
 * The transparent background is the other half: OBS keys on it, and a page
 * that paints its own white would put a white rectangle over the stream.
 */
export default function OverlayLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: "transparent",
        width: "100%",
        minHeight: "100vh",
        margin: 0,
        padding: 0,
      }}
    >
      {children}
    </div>
  );
}
