import PusherJs from "pusher-js";

/**
 * Browser-only realtime client.
 *
 * Two things forced this to be a lazy getter rather than a module-level
 * instance. On the server, `pusher-js` resolves to its Node build whose default
 * export is not constructible in this bundler's interop path, so merely
 * importing a module that instantiated it turned every page using it into a
 * 500. In the browser, the constructor throws outright when the key is absent.
 * Either way a page died because an *optional* integration was unavailable.
 *
 * So: construct nothing until someone asks, and only ever in the browser.
 * Callers get null when realtime is unavailable and carry on without it —
 * the data under these views is fetched over HTTP regardless, so the only
 * thing lost is the push, not the page.
 */
const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

export const isRealtimeConfigured = Boolean(key && cluster);

let client: PusherJs | null = null;
let warned = false;

export function getPusherClient(): PusherJs | null {
  // Server render: there is no socket to open and no constructor to call.
  if (typeof window === "undefined") return null;

  if (!isRealtimeConfigured) {
    if (!warned) {
      warned = true;
      // Once, as a note rather than a fault — this is a supported state.
      console.info(
        "Realtime updates are off: set NEXT_PUBLIC_PUSHER_KEY and NEXT_PUBLIC_PUSHER_CLUSTER to enable them."
      );
    }
    return null;
  }

  // One socket per tab, shared by every subscriber.
  client ??= new PusherJs(key as string, { cluster: cluster as string });
  return client;
}
