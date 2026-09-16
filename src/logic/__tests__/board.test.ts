import {
  FACE_GLYPH,
  FREE_THEMES,
  THEMES,
  canUseTheme,
  dayNumber,
  dealBoard,
  isCleared,
  isPair,
  scoreBoard,
  themeForDay,
  type Card,
} from '../board';

const flipAll = (cards: Card[]): Card[] => cards.map((c) => ({ ...c, matched: true }));

describe('the daily board', () => {
  it('is the same board for the same day, on any device', () => {
    const a = dealBoard(dayNumber(Date.UTC(2026, 8, 15)));
    const b = dealBoard(dayNumber(Date.UTC(2026, 8, 15)));
    expect(a.map((c) => c.faceId)).toEqual(b.map((c) => c.faceId));
  });

  it('is a different board the next day', () => {
    const a = dealBoard(dayNumber(Date.UTC(2026, 8, 15)));
    const b = dealBoard(dayNumber(Date.UTC(2026, 8, 16)));
    expect(a.map((c) => c.faceId)).not.toEqual(b.map((c) => c.faceId));
  });

  it('deals every face exactly twice, which is what makes it solvable', () => {
    for (let day = 0; day < 60; day += 1) {
      const counts = new Map<string, number>();
      for (const card of dealBoard(day)) {
        counts.set(card.faceId, (counts.get(card.faceId) ?? 0) + 1);
      }
      expect([...counts.values()].every((n) => n === 2)).toBe(true);
    }
  });

  it('starts with nothing matched', () => {
    expect(dealBoard(1).every((c) => !c.matched)).toBe(false || true);
    expect(dealBoard(1).some((c) => c.matched)).toBe(false);
  });

  it('gives every card a distinct id even though faces repeat', () => {
    const cards = dealBoard(3);
    expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length);
  });
});

describe('pairing', () => {
  it('matches two different cards with the same face', () => {
    const [a, b] = [
      { id: '1', faceId: 'x', matched: false },
      { id: '2', faceId: 'x', matched: false },
    ];
    expect(isPair(a!, b!)).toBe(true);
  });

  it('does not match a card with itself', () => {
    const a = { id: '1', faceId: 'x', matched: false };
    expect(isPair(a, a)).toBe(false);
  });

  it('does not match different faces', () => {
    expect(
      isPair({ id: '1', faceId: 'x', matched: false }, { id: '2', faceId: 'y', matched: false }),
    ).toBe(false);
  });
});

describe('clearing', () => {
  it('is cleared only when every card is matched', () => {
    const cards = dealBoard(5);
    expect(isCleared(cards)).toBe(false);
    expect(isCleared(flipAll(cards))).toBe(true);
  });

  it('treats an empty board as not cleared, rather than trivially won', () => {
    expect(isCleared([])).toBe(false);
  });
});

describe('scoring', () => {
  it('rewards fewer flips', () => {
    expect(scoreBoard(20, 30_000)).toBeGreaterThan(scoreBoard(40, 30_000));
  });

  it('rewards less time', () => {
    expect(scoreBoard(20, 20_000)).toBeGreaterThan(scoreBoard(20, 60_000));
  });

  it('never goes negative, however badly it went', () => {
    expect(scoreBoard(10_000, 10_000_000)).toBeGreaterThanOrEqual(0);
  });
});

describe('themes', () => {
  it('has more than the free tier', () => {
    expect(THEMES.length).toBeGreaterThan(FREE_THEMES.length);
  });

  it('gates the paid ones', () => {
    const paid = THEMES.find((t) => !FREE_THEMES.includes(t.id))!;
    expect(canUseTheme(paid.id, false)).toBe(false);
    expect(canUseTheme(paid.id, true)).toBe(true);
    expect(canUseTheme(FREE_THEMES[0]!, false)).toBe(true);
  });

  it('refuses a theme that does not exist', () => {
    expect(canUseTheme('nonsense', true)).toBe(false);
  });

  // "One themed board a day" — the theme has to follow the day, or the tagline
  // is describing something the app does not do.
  it('picks the day theme deterministically, and cycles through all of them', () => {
    const seen = new Set<string>();
    for (let day = 0; day < THEMES.length * 3; day += 1) {
      expect(themeForDay(day)).toBe(themeForDay(day));
      seen.add(themeForDay(day));
    }
    expect(seen.size).toBe(THEMES.length);
  });
});

describe('FACE_GLYPH', () => {
  it('has an entry for every face in every theme', () => {
    const missing = THEMES.flatMap((t) => t.faces).filter((f) => !FACE_GLYPH[f]);
    expect(missing).toEqual([]);
  });

  it('gives no two faces the same glyph', () => {
    // The bug this replaces: `faceId.slice(0, 2)` rendered "pe" for BOTH pear
    // and peach, and collided again on rain/rainbow and storm/star -- two
    // different cards looked identical, so the game was wrong rather than ugly.
    const faces = THEMES.flatMap((t) => t.faces);
    const byGlyph = new Map<string, string[]>();
    for (const f of faces) {
      const g = FACE_GLYPH[f] as string;
      byGlyph.set(g, [...(byGlyph.get(g) ?? []), f]);
    }
    const clashes = [...byGlyph.entries()].filter(([, v]) => v.length > 1);
    expect(clashes).toEqual([]);
  });
});
