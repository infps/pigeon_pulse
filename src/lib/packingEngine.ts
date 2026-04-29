// Best-Fit Decreasing (BFD) bin-packing for loft basket assignment.
//
// Each breeder's birds are treated as a single indivisible group.
// One basket holds exactly one breeder's birds (one loft per basket).
//
// Strategy: sort groups descending by size, then for each group pick
// the basket with the LEAST remaining space that can still fit the group.
// This minimises wasted capacity across baskets.

export interface BreederGroup {
  breederId: number;
  lastName: string;
  itemIds: number[]; // EventInventoryItem IDs
}

export interface BasketSlot {
  id: number;
  capacity: number;
  used: number; // _count.assignments — no schema change needed
  label: string | null;
  basketNo: number;
}

export interface AssignmentResult {
  breederId: number;
  lastName: string;
  basketId: number;
  basketLabel: string | null;
  basketNo: number;
  itemIds: number[];
}

export interface BfdResult {
  assigned: AssignmentResult[];
  unassigned: BreederGroup[]; // no basket large enough — admin must add capacity
}

// ============================================================
// Random assign with breeder separation — for RACE baskets.
//
// Each bird is placed individually. Prefer baskets that do NOT
// already contain another bird from the same breeder. Fall back
// to any basket with remaining capacity only if no separated
// basket is available.
// ============================================================

export interface RaceItem {
  id: number; // EventInventoryItem ID
  breederLastName: string;
}

export interface RaceBasketAssignment {
  basketId: number;
  basketNo: number;
  basketLabel: string | null;
  itemIds: number[];
  breeders: string[];
}

export interface RandomAssignResult {
  assigned: RaceBasketAssignment[];
  unassigned: RaceItem[]; // capacity exhausted
}

function fisherYatesShuffle<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function randomAssign(items: RaceItem[], baskets: BasketSlot[]): RandomAssignResult {
  const state = baskets.map((b) => ({
    id: b.id,
    basketNo: b.basketNo,
    label: b.label,
    capacity: b.capacity,
    used: b.used,
    itemIds: [] as number[],
    breeders: new Set<string>(),
  }));

  // Group by breeder for shuffle-then-interleave
  const byBreeder = new Map<string, RaceItem[]>();
  for (const item of items) {
    const key = item.breederLastName;
    if (!byBreeder.has(key)) byBreeder.set(key, []);
    byBreeder.get(key)!.push(item);
  }
  const groups = fisherYatesShuffle(
    [...byBreeder.entries()].map(([breeder, birds]) => ({ breeder, birds: fisherYatesShuffle(birds) }))
  );

  const unassigned: RaceItem[] = [];

  for (const group of groups) {
    for (const bird of group.birds) {
      // Prefer baskets with space and no collision with this breeder
      const separated = state.filter(
        (s) => s.used + s.itemIds.length < s.capacity && !s.breeders.has(bird.breederLastName)
      );
      let pool = separated;
      if (pool.length === 0) {
        pool = state.filter((s) => s.used + s.itemIds.length < s.capacity);
      }
      if (pool.length === 0) {
        unassigned.push(bird);
        continue;
      }
      const picked = pool[Math.floor(Math.random() * pool.length)];
      picked.itemIds.push(bird.id);
      picked.breeders.add(bird.breederLastName);
    }
  }

  const assigned: RaceBasketAssignment[] = state
    .filter((s) => s.itemIds.length > 0)
    .map((s) => ({
      basketId: s.id,
      basketNo: s.basketNo,
      basketLabel: s.label,
      itemIds: s.itemIds,
      breeders: [...s.breeders],
    }));

  return { assigned, unassigned };
}

export function bfdAssign(groups: BreederGroup[], baskets: BasketSlot[]): BfdResult {
  // Step 1 — Decreasing: largest groups first
  const sorted = [...groups].sort((a, b) => b.itemIds.length - a.itemIds.length);

  // Track remaining space per basket
  const remaining = new Map(baskets.map((b) => [b.id, b.capacity - b.used]));

  const assigned: AssignmentResult[] = [];
  const unassigned: BreederGroup[] = [];

  for (const group of sorted) {
    const count = group.itemIds.length;

    // Already-assigned baskets are occupied (one breeder per basket)
    const occupied = new Set(assigned.map((a) => a.basketId));

    // Step 2 — Best-Fit: eligible = not occupied AND enough remaining space
    // Sort ascending by remaining (tightest fit first)
    const eligible = baskets
      .filter((b) => !occupied.has(b.id) && (remaining.get(b.id) ?? 0) >= count)
      .sort((a, b) => (remaining.get(a.id) ?? 0) - (remaining.get(b.id) ?? 0));

    if (eligible.length === 0) {
      unassigned.push(group);
      continue;
    }

    const picked = eligible[0];
    assigned.push({
      breederId: group.breederId,
      lastName: group.lastName,
      basketId: picked.id,
      basketLabel: picked.label,
      basketNo: picked.basketNo,
      itemIds: group.itemIds,
    });
    remaining.set(picked.id, (remaining.get(picked.id) ?? 0) - count);
  }

  return { assigned, unassigned };
}
