/**
 * Tiny in-process TTL cache for hot public reads (live race results, overlay).
 *
 * Stores the promise, so concurrent misses share one DB round trip. Lives on
 * globalThis because Next bundles each route separately: a module-level Map
 * would give the write routes a different copy than the read routes, and
 * invalidate() would clear nothing.
 *
 * ponytail: single-instance only. With more than one app server, swap for Redis.
 */

type Entry = { exp: number; p: Promise<unknown> };
const g = globalThis as unknown as { __ttlCache?: Map<string, Entry> };
const store = (g.__ttlCache ??= new Map());

export function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.exp > now) return hit.p as Promise<T>;
  // ponytail: sweep on write instead of a timer; keys are per race, so the map stays small.
  if (store.size > 500) for (const [k, e] of store) if (e.exp <= now) store.delete(k);
  const p = fn();
  store.set(key, { exp: now + ttlMs, p });
  // Never cache a failure.
  p.catch(() => {
    if (store.get(key)?.p === p) store.delete(key);
  });
  return p;
}

export function invalidate(prefix: string): void {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}

/** Key prefix for everything cached about one race. Trailing ":" so race 1 never clears race 12. */
export const raceKey = (raceId: number) => `race:${raceId}:`;
