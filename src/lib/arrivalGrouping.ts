export const GAP_SECONDS_DEFAULT = 60;

export interface ArrivalInput {
  id: number;
  arrivalTime: Date;
}

export interface ArrivalGroupResult {
  groupKey: number;
  arrivalIds: number[];
  start: Date;
  end: Date;
}

export function groupArrivalsByWindow(
  arrivals: ArrivalInput[],
  gapSeconds: number = GAP_SECONDS_DEFAULT,
): ArrivalGroupResult[] {
  if (arrivals.length === 0) return [];
  const sorted = [...arrivals].sort(
    (a, b) => a.arrivalTime.getTime() - b.arrivalTime.getTime(),
  );
  const gapMs = gapSeconds * 1000;
  const groups: ArrivalGroupResult[] = [];
  let current: ArrivalGroupResult | null = null;
  let prevTime = -Infinity;
  let key = 0;

  for (const a of sorted) {
    const t = a.arrivalTime.getTime();
    if (!current || t - prevTime > gapMs) {
      current = {
        groupKey: key++,
        arrivalIds: [a.id],
        start: a.arrivalTime,
        end: a.arrivalTime,
      };
      groups.push(current);
    } else {
      current.arrivalIds.push(a.id);
      current.end = a.arrivalTime;
    }
    prevTime = t;
  }
  return groups;
}

export interface GroupColor {
  bg: string;
  border: string;
  text: string;
}

const PALETTE: GroupColor[] = [
  { bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700" },
  { bg: "bg-green-50", border: "border-green-300", text: "text-green-700" },
  { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-700" },
  { bg: "bg-rose-50", border: "border-rose-300", text: "text-rose-700" },
  { bg: "bg-violet-50", border: "border-violet-300", text: "text-violet-700" },
  { bg: "bg-cyan-50", border: "border-cyan-300", text: "text-cyan-700" },
  { bg: "bg-orange-50", border: "border-orange-300", text: "text-orange-700" },
  { bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-700" },
  { bg: "bg-pink-50", border: "border-pink-300", text: "text-pink-700" },
  { bg: "bg-indigo-50", border: "border-indigo-300", text: "text-indigo-700" },
];

export function colorForGroupId(id: number): GroupColor {
  const idx = ((id % PALETTE.length) + PALETTE.length) % PALETTE.length;
  return PALETTE[idx];
}

export const GROUP_PALETTE = PALETTE;
