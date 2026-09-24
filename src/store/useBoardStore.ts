/**
 * Finished boards, the streak, and the chosen theme.
 *
 * The paid claim enforced here is theme choice: the daily theme is always
 * playable, and pinning a different one is what the purchase opens.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import { canUseTheme, scoreBoard, themeForDay } from "@/logic/board";

export const BOARD_CACHE_KEY = "flipnest.state.v1";

/** Days kept. Two years of daily play, then the oldest fall off. */
const MAX_RESULTS = 730;

export interface DayResult {
  day: number;
  score: number;
  flips: number;
  ms: number;
}

interface BoardState {
  results: DayResult[];
  /** null means "follow the day", which is what a free player always gets. */
  themeId: string | null;
  /** The day's theme id as fetched from content-drip, keyed by day. Populated
   * asynchronously by a background fetch (see `src/content/sync.ts`); absent
   * entries fall back to the local day-cycle in `activeTheme`. */
  dailyThemeId: Record<number, string>;

  setDailyThemeId: (day: number, id: string) => void;
  activeTheme: (day: number) => string;
  chooseTheme: (id: string, isPremium: boolean) => "ok" | "locked" | "unknown";
  finish: (day: number, flips: number, ms: number) => void;
  resultFor: (day: number) => DayResult | undefined;
  streak: (today: number) => number;
  persist: () => Promise<void>;
  hydrate: () => Promise<void>;
}

function validResults(value: unknown): DayResult[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (r): r is DayResult =>
      !!r &&
      typeof r === "object" &&
      typeof (r as DayResult).day === "number" &&
      typeof (r as DayResult).score === "number" &&
      typeof (r as DayResult).flips === "number" &&
      typeof (r as DayResult).ms === "number",
  );
}

export const useBoardStore = create<BoardState>((set, get) => ({
  results: [],
  themeId: null,
  dailyThemeId: {},

  setDailyThemeId(day, id) {
    set((s) => ({ dailyThemeId: { ...s.dailyThemeId, [day]: id } }));
  },

  activeTheme(day) {
    return get().themeId ?? get().dailyThemeId[day] ?? themeForDay(day);
  },

  chooseTheme(id, isPremium) {
    if (!canUseTheme(id, true)) return "unknown";
    if (!canUseTheme(id, isPremium)) return "locked";
    set({ themeId: id });
    void get().persist();
    return "ok";
  },

  finish(day, flips, ms) {
    const score = scoreBoard(flips, ms);
    const existing = get().results.find((r) => r.day === day);
    // A replayed day keeps the better attempt rather than the latest one, so
    // opening the board to look at it cannot destroy a good result.
    if (existing && existing.score >= score) return;
    const row: DayResult = { day, score, flips, ms };
    set((s) => ({
      results: [...s.results.filter((r) => r.day !== day), row]
        .sort((a, b) => a.day - b.day)
        .slice(-MAX_RESULTS),
    }));
    void get().persist();
  },

  resultFor(day) {
    return get().results.find((r) => r.day === day);
  },

  streak(today) {
    const days = new Set(get().results.map((r) => r.day));
    let streak = 0;
    for (let day = today; days.has(day); day -= 1) streak += 1;
    return streak;
  },

  async persist() {
    try {
      const { results, themeId } = get();
      await AsyncStorage.setItem(
        BOARD_CACHE_KEY,
        JSON.stringify({ results, themeId }),
      );
    } catch {
      // A lost history is survivable; a failed launch is not.
    }
  },

  async hydrate() {
    try {
      const raw = await AsyncStorage.getItem(BOARD_CACHE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      const record = parsed as Record<string, unknown>;
      set({
        results: validResults(record.results),
        themeId: typeof record.themeId === "string" ? record.themeId : null,
      });
    } catch {
      // Unreadable storage starts empty rather than preventing launch.
    }
  },
}));
