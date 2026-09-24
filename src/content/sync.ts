/**
 * The one place that talks to content-drip for flipnest's daily theme.
 *
 * The bundled theme list (`src/logic/board.ts`) is never deleted and never
 * stops working — it is the fallback whenever the service is unreachable,
 * slow, or answers with something malformed. Nothing here can block a
 * player: a cache read or a network call that fails just means the day's
 * theme is computed locally instead, exactly as it always was before this
 * file existed.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import { THEMES, type Theme, themeForDay } from "@/logic/board";

/** Where the content service lives. Overridable for a staging build. */
export const CONTENT_BASE_URL =
  process.env.EXPO_PUBLIC_CONTENT_BASE_URL ?? "https://content.altixcode.com";

/** Short: this runs while someone is trying to play. */
const TIMEOUT_MS = 8_000;

const CACHE_PREFIX = "flipnest.content.v1.";

export interface RemoteTheme extends Theme {
  glyphs?: Record<string, string>;
}

/** UTC calendar date for a day number, matching the server's own UTC calendar. */
export function dateKeyForDay(day: number): string {
  return new Date(day * 86_400_000).toISOString().slice(0, 10);
}

function isValidTheme(value: unknown): value is RemoteTheme {
  if (!value || typeof value !== "object") return false;
  const theme = value as Record<string, unknown>;
  return (
    typeof theme.id === "string" &&
    typeof theme.nameKey === "string" &&
    Array.isArray(theme.faces) &&
    theme.faces.length > 0 &&
    theme.faces.every((f) => typeof f === "string") &&
    (theme.glyphs === undefined ||
      (typeof theme.glyphs === "object" && theme.glyphs !== null))
  );
}

async function readCache(day: number): Promise<RemoteTheme | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + day);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidTheme(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function writeCache(day: number, theme: RemoteTheme): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_PREFIX + day, JSON.stringify(theme));
  } catch {
    // A lost cache entry costs one extra fetch tomorrow. Not worth surfacing.
  }
}

function localThemeForDay(day: number): Theme {
  return THEMES.find((t) => t.id === themeForDay(day)) ?? THEMES[0]!;
}

/**
 * Today's theme: cache, then the live service, then the local day-cycle —
 * the first one that actually answers. Never throws.
 *
 * A theme this service returns that isn't in the bundled `THEMES` list (a
 * theme added purely server-side, after this build shipped) still carries
 * its own `faces`/`glyphs`, but `dealBoard` only knows the bundled catalog —
 * an unrecognised id there falls back to the first bundled theme. Fully
 * supporting server-only themes needs `dealBoard` to accept a `Theme`
 * directly rather than looking one up by id; out of scope here, since every
 * theme currently served matches the bundled list exactly.
 */
export async function fetchThemeFor(day: number): Promise<RemoteTheme> {
  const cached = await readCache(day);
  if (cached) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url = `${CONTENT_BASE_URL}/api/v1/flipnest/themes/today?date=${dateKeyForDay(day)}`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error(`${response.status} from content-drip`);
    const body = (await response.json()) as { items?: unknown };
    const item = Array.isArray(body.items) ? body.items[0] : undefined;
    if (isValidTheme(item)) {
      void writeCache(day, item);
      return item;
    }
  } catch {
    // Network failure, timeout, or a malformed response: fall through.
  } finally {
    clearTimeout(timer);
  }
  return localThemeForDay(day);
}
