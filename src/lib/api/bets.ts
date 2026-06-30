import { useApiQuery } from "@/hooks/useApi";
import { apiEndpoints } from "../endpoints";
import { useApiMutation } from "@/hooks/useApiMutation";

// ── Breeder / bettor — per race ──────────────────────────────────────────────

export type RaceBetPool = { category: string; tierIndex: number; amount: number };
export type RaceBetBird = {
  raceItemId: number;
  band: string | null;
  ownerUserId: string | null;
  ownerName: string | null;
  isOwnBird: boolean;
  bets: { category: string; tierIndex: number; bettorId: string; isYours: boolean; stakePaymentId: number | null; stakePaid: boolean }[];
};
export type RaceBetsResponse = {
  birds: RaceBetBird[];
  pools: RaceBetPool[];
  bettingOpen: boolean;
  raceStatus: string;
};

export function useRaceBets(raceId: number | string, enabled = true) {
  return useApiQuery({
    endpoint: apiEndpoints.betting.bets(raceId),
    queryKey: ["bets", "race", String(raceId)],
    enabled,
  });
}

export function usePlaceBet(raceId: number | string) {
  return useApiMutation({
    exact: false,
    method: "POST",
    endpoint: apiEndpoints.betting.bets(raceId),
    queryKey: ["bets", "race", String(raceId)],
  });
}

// ── Admin — per race ─────────────────────────────────────────────────────────

export function useBettingPool(raceId: number | string, enabled = true) {
  return useApiQuery({
    endpoint: apiEndpoints.betting.pool(raceId),
    queryKey: ["betting", "pool", String(raceId)],
    enabled,
  });
}

export function useToggleBetting(raceId: number | string) {
  return useApiMutation({
    exact: false,
    method: "POST",
    endpoint: apiEndpoints.betting.toggle(raceId),
    queryKey: ["betting"],
  });
}

export function useCalcPayouts(raceId: number | string) {
  return useApiMutation({
    exact: false,
    method: "POST",
    endpoint: apiEndpoints.betting.calculatePayouts(raceId),
    queryKey: ["betting", "pool", String(raceId)],
  });
}

export function usePlaceCashBet(raceId: number | string) {
  return useApiMutation({
    exact: false,
    method: "POST",
    endpoint: apiEndpoints.betting.placeCashBet(raceId),
    queryKey: ["bets", "race", String(raceId)],
  });
}
