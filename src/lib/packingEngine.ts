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
