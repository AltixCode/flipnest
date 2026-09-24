/**
 * The daily board: dealing, matching, clearing, scoring, and the theme.
 *
 * Pure and dependency-free. The day is always passed in, so "tomorrow's board"
 * is a test argument rather than something you wait for.
 */

export interface Card {
  /** Unique per card. Two cards share a face; they never share an id. */
  id: string;
  faceId: string;
  matched: boolean;
}

export interface Theme {
  id: string;
  nameKey: string;
  /** Face ids this theme deals. Length must be at least PAIRS. */
  faces: string[];
}

/** Pairs on a board. Twelve pairs is a 24-card grid: 4x6, which fits a phone. */
export const PAIRS = 12;

/**
 * The picture on a card face.
 *
 * The board used to render `faceId.slice(0, 2)`, which showed "gr", "le", "be".
 * That read as an unfinished prototype, and in two themes it was a genuine
 * gameplay bug rather than a cosmetic one: `pear`/`peach` both rendered "pe",
 * and `rain`/`rainbow` and `storm`/`star` both collided, so two different cards
 * were indistinguishable and a player matching them by sight was simply wrong.
 *
 * A glyph rather than the word, because the word would be English on every one
 * of the fourteen locales this app ships -- the face ids are identifiers, not
 * copy, and there are no translations for them. A picture needs none.
 *
 * Every id in THEMES has an entry and no two ids share a glyph; both are
 * asserted in the tests.
 */
export const FACE_GLYPH: Record<string, string> = {
  apple: "🍎",
  pear: "🍐",
  plum: "🟣",
  cherry: "🍒",
  grape: "🍇",
  lemon: "🍋",
  peach: "🍑",
  melon: "🍈",
  fig: "🫒",
  kiwi: "🥝",
  mango: "🥭",
  berry: "🫐",
  sun: "☀️",
  cloud: "☁️",
  rain: "🌧️",
  snow: "❄️",
  storm: "⛈️",
  wind: "💨",
  fog: "🌫️",
  rainbow: "🌈",
  hail: "🧊",
  moon: "🌙",
  star: "⭐",
  comet: "☄️",
  rose: "🌹",
  tulip: "🌷",
  daisy: "🌼",
  fern: "🌿",
  ivy: "🍃",
  oak: "🌳",
  pine: "🌲",
  moss: "🌱",
  clover: "🍀",
  thistle: "🌾",
  poppy: "🌺",
  lily: "🪷",
  anchor: "⚓",
  buoy: "🛟",
  sail: "⛵",
  rope: "🪢",
  shell: "🐚",
  crab: "🦀",
  gull: "🦅",
  lantern: "🏮",
  net: "🕸️",
  oar: "🛶",
  wave: "🌊",
  compass: "🧭",
  planet: "🪐",
  rocket: "🚀",
  astronaut: "👨‍🚀",
  satellite: "🛰️",
  galaxy: "🌌",
  telescope: "🔭",
  ufo: "🛸",
  meteor: "🌠",
  asteroid: "🪨",
  alien: "👽",
  nebula: "✨",
  orbit: "🌀",
  pan: "🍳",
  knife: "🔪",
  kettle: "🫖",
  spoon: "🥄",
  fork: "🍴",
  pot: "🍲",
  bread: "🍞",
  teacup: "☕",
  plate: "🍽️",
  salt: "🧂",
  cheese: "🧀",
  jar: "🫙",
};

export const THEMES: Theme[] = [
  {
    id: "fruit",
    nameKey: "themeFruit",
    faces: [
      "apple",
      "pear",
      "plum",
      "cherry",
      "grape",
      "lemon",
      "peach",
      "melon",
      "fig",
      "kiwi",
      "mango",
      "berry",
    ],
  },
  {
    id: "weather",
    nameKey: "themeWeather",
    faces: [
      "sun",
      "cloud",
      "rain",
      "snow",
      "storm",
      "wind",
      "fog",
      "rainbow",
      "hail",
      "moon",
      "star",
      "comet",
    ],
  },
  {
    id: "garden",
    nameKey: "themeGarden",
    faces: [
      "rose",
      "tulip",
      "daisy",
      "fern",
      "ivy",
      "oak",
      "pine",
      "moss",
      "clover",
      "thistle",
      "poppy",
      "lily",
    ],
  },
  {
    id: "harbour",
    nameKey: "themeHarbour",
    faces: [
      "anchor",
      "buoy",
      "sail",
      "rope",
      "shell",
      "crab",
      "gull",
      "lantern",
      "net",
      "oar",
      "wave",
      "compass",
    ],
  },
  {
    id: "space",
    nameKey: "themeSpace",
    faces: [
      "planet",
      "rocket",
      "astronaut",
      "satellite",
      "galaxy",
      "telescope",
      "ufo",
      "meteor",
      "asteroid",
      "alien",
      "nebula",
      "orbit",
    ],
  },
  {
    id: "kitchen",
    nameKey: "themeKitchen",
    faces: [
      "pan",
      "knife",
      "kettle",
      "spoon",
      "fork",
      "pot",
      "bread",
      "teacup",
      "plate",
      "salt",
      "cheese",
      "jar",
    ],
  },
];

/** Themes a free player can choose. The daily theme is always playable. */
export const FREE_THEMES: string[] = ["fruit"];

export function canUseTheme(id: string, isPremium: boolean): boolean {
  if (!THEMES.some((t) => t.id === id)) return false;
  return isPremium || FREE_THEMES.includes(id);
}

/** Whole days since the epoch, from a timestamp. */
export function dayNumber(ms: number): number {
  return Math.floor(ms / 86_400_000);
}

/**
 * The theme for a given day. Cycles through every theme so the promise of "one
 * themed board a day" means a theme that actually changes.
 */
export function themeForDay(day: number): string {
  const index = ((day % THEMES.length) + THEMES.length) % THEMES.length;
  return THEMES[index]!.id;
}

function hash(seed: number, salt: number): number {
  let h = (seed ^ (salt + 0x9e3779b9)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * The board for a day: every face exactly twice, shuffled deterministically.
 *
 * Dealing pairs and then shuffling — rather than placing cards at random — is
 * what makes every board solvable by construction. There is no generate-and-check
 * step because there is nothing to check.
 */
export function dealBoard(day: number, themeId = themeForDay(day)): Card[] {
  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0]!;
  const faces = theme.faces.slice(0, PAIRS);

  const cards: Card[] = [];
  faces.forEach((faceId, i) => {
    cards.push({ id: `${faceId}-a-${i}`, faceId, matched: false });
    cards.push({ id: `${faceId}-b-${i}`, faceId, matched: false });
  });

  // Fisher-Yates driven by the day hash, so the shuffle is the same everywhere.
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = hash(day, i) % (i + 1);
    const a = cards[i]!;
    const b = cards[j]!;
    cards[i] = b;
    cards[j] = a;
  }
  return cards;
}

/** Two distinct cards showing the same face. */
export function isPair(a: Card, b: Card): boolean {
  return a.id !== b.id && a.faceId === b.faceId;
}

export function isCleared(cards: readonly Card[]): boolean {
  // An empty board is not a win. Returning true would mean a board that failed
  // to deal reads as "cleared" the moment it opens.
  return cards.length > 0 && cards.every((c) => c.matched);
}

/**
 * A score out of 1000, falling with flips and with time.
 *
 * Clamped at zero: a very slow game scores nothing, never a negative, which
 * would sort below a player who has not finished at all.
 */
export function scoreBoard(flips: number, elapsedMs: number): number {
  const perfectFlips = PAIRS * 2;
  const flipPenalty = Math.max(0, flips - perfectFlips) * 8;
  const timePenalty = Math.floor(elapsedMs / 1000) * 2;
  return Math.max(0, 1000 - flipPenalty - timePenalty);
}
