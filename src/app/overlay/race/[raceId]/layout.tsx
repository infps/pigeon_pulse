import type { ReactNode } from "react";

// Never prerendered: the whole point is that it is current.
export const dynamic = "force-dynamic";

/**
 * A layout with nothing in it.
 *
 * The overlay is a browser source inside OBS, sitting on top of live video.
 * Anything the app would normally wrap a page in — navigation, a header, a
 * background colour — would be composited over the broadcast.
 *
 * This layout cannot shed those on its own. An App Router nested layout nests
 * inside the root layout rather than replacing it, so the root's `<Header />`
 * and the body background still apply here. Both are declined explicitly:
 * the header returns null for `/overlay` paths, and the style element below
 * overrides the `bg-background` that `globals.css` puts on the body — an
 * opaque near-white, or near-black in dark mode. A transparent div on an
 * opaque body still composites as opaque, which is a white rectangle over the
 * stream.
 */
export default function OverlayLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        html, body {
          background: transparent !important;
          margin: 0;
          padding: 0;
        }
      `}</style>
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
    </>
  );
}
