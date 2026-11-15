"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

// Big admin lists (users, birds) are fetched page by page, kept in IndexedDB and
// filtered in the browser, so typing never hits the API.
// - Hard expiry: 24h, then the record is dropped and refetched.
// - Background refresh when the copy is older than 5 min, or after a mutation
//   invalidates the query key.
// - clearListCache() on logout. Records are keyed per signed-in user.

const DB = "pp-list-cache";
const STORE = "lists";
const TTL = 24 * 60 * 60 * 1000;
const STALE = 5 * 60 * 1000;
const PAGE = 500;
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

type Rec<T> = { at: number; rows: T[] };

function idb<R>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<R>): Promise<R | undefined> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(undefined);
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => resolve(undefined);
    open.onsuccess = () => {
      const db = open.result;
      try {
        const tx = db.transaction(STORE, mode);
        const req = run(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(undefined);
        tx.oncomplete = tx.onabort = () => db.close();
      } catch {
        db.close();
        resolve(undefined);
      }
    };
  });
}

/** Drop every cached list (call on logout). */
export function clearListCache(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve();
    const req = indexedDB.deleteDatabase(DB);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}

/** Fetch every page of a cursor-paginated endpoint ({ [field]: T[], nextCursor }). */
export async function fetchAllPages<T>(
  endpoint: string,
  field: string,
  onPage?: (rows: T[]) => void,
  doFetch: typeof fetch = fetch
): Promise<T[]> {
  let rows: T[] = [];
  let cursor: string | null = null;
  do {
    const qs: URLSearchParams = new URLSearchParams({ limit: String(PAGE), ...(cursor ? { cursor } : {}) });
    const res: Response = await doFetch(`${API_URL}${endpoint}?${qs}`, { credentials: "include" });
    const body: { nextCursor?: string | number | null; [k: string]: unknown } = await res.json();
    if (!res.ok) throw new Error(String(body?.message ?? `HTTP ${res.status}`), { cause: res.status });
    rows = rows.concat((body[field] as T[]) ?? []);
    cursor = body.nextCursor != null ? String(body.nextCursor) : null;
    if (cursor) onPage?.(rows);
  } while (cursor);
  return rows;
}

/**
 * Whole list, cached in the browser for 24h.
 * @param queryKey must start with the key the entity's mutations invalidate (e.g. ["users", ...]).
 */
export function useCachedList<T>(queryKey: string[], endpoint: string, field: string) {
  const qc = useQueryClient();
  const uid = authClient.useSession().data?.user?.id;
  const recKey = `${uid}:${queryKey.join("/")}`;
  const [hydrated, setHydrated] = useState(false);

  // Seed the query from IndexedDB before the first fetch decides whether it's needed.
  useEffect(() => {
    if (!uid) return;
    let live = true;
    idb<Rec<T>>("readonly", (s) => s.get(recKey)).then((rec) => {
      if (!live) return;
      if (rec && Date.now() - rec.at < TTL) {
        if (qc.getQueryData(queryKey) === undefined) qc.setQueryData(queryKey, rec.rows, { updatedAt: rec.at });
      } else if (rec) {
        idb("readwrite", (s) => s.delete(recKey));
      }
      setHydrated(true);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recKey]);

  return useQuery<T[]>({
    queryKey,
    enabled: hydrated,
    staleTime: STALE,
    gcTime: TTL,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const hadData = qc.getQueryData(queryKey) !== undefined;
      // First visit: show page 1 right away while the rest streams in.
      const rows = await fetchAllPages<T>(endpoint, field, hadData ? undefined : (r) => qc.setQueryData(queryKey, r));
      idb("readwrite", (s) => s.put({ at: Date.now(), rows } satisfies Rec<T>, recKey));
      return rows;
    },
  });
}
