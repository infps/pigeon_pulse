import { useSeasonContext } from "./season-context";

// ponytail: context default returns null if not wrapped in SeasonProvider
export function useSeasonId(): number | null {
  return useSeasonContext().selectedSeasonId;
}
