import AsyncStorage from '@react-native-async-storage/async-storage';

import { dayNumber, themeForDay } from '@/logic/board';
import { BOARD_CACHE_KEY, useBoardStore } from '../useBoardStore';

const DAY = dayNumber(Date.UTC(2026, 8, 15));
const reset = () => useBoardStore.setState({ results: [], themeId: null });

beforeEach(async () => {
  await AsyncStorage.clear();
  reset();
});

describe('the day theme', () => {
  it('follows the day when the player has not chosen one', () => {
    expect(useBoardStore.getState().activeTheme(DAY)).toBe(themeForDay(DAY));
  });

  it('lets a paid player pin a theme', () => {
    expect(useBoardStore.getState().chooseTheme('harbour', true)).toBe('ok');
    expect(useBoardStore.getState().activeTheme(DAY)).toBe('harbour');
  });

  it('refuses a paid theme for a free player and leaves the day theme', () => {
    expect(useBoardStore.getState().chooseTheme('harbour', false)).toBe('locked');
    expect(useBoardStore.getState().activeTheme(DAY)).toBe(themeForDay(DAY));
  });

  it('refuses a theme that does not exist', () => {
    expect(useBoardStore.getState().chooseTheme('nope', true)).toBe('unknown');
  });
});

describe('results', () => {
  it('records a finished board once per day', () => {
    useBoardStore.getState().finish(DAY, 24, 30_000);
    useBoardStore.getState().finish(DAY, 40, 90_000);
    expect(useBoardStore.getState().results).toHaveLength(1);
  });

  it('keeps the better result when the same day is replayed', () => {
    useBoardStore.getState().finish(DAY, 40, 90_000);
    const worse = useBoardStore.getState().resultFor(DAY)!.score;
    useBoardStore.getState().finish(DAY, 24, 20_000);
    expect(useBoardStore.getState().resultFor(DAY)!.score).toBeGreaterThan(worse);
  });

  it('knows whether today is already done', () => {
    expect(useBoardStore.getState().resultFor(DAY)).toBeUndefined();
    useBoardStore.getState().finish(DAY, 24, 30_000);
    expect(useBoardStore.getState().resultFor(DAY)).toBeDefined();
  });

  it('counts a streak of consecutive days', () => {
    useBoardStore.getState().finish(DAY - 2, 24, 1000);
    useBoardStore.getState().finish(DAY - 1, 24, 1000);
    useBoardStore.getState().finish(DAY, 24, 1000);
    expect(useBoardStore.getState().streak(DAY)).toBe(3);
  });

  it('breaks the streak on a missed day', () => {
    useBoardStore.getState().finish(DAY - 3, 24, 1000);
    useBoardStore.getState().finish(DAY, 24, 1000);
    expect(useBoardStore.getState().streak(DAY)).toBe(1);
  });

  it('has no streak before anything is played', () => {
    expect(useBoardStore.getState().streak(DAY)).toBe(0);
  });
});

describe('hydrate', () => {
  it('restores results', async () => {
    useBoardStore.getState().finish(DAY, 24, 30_000);
    await useBoardStore.getState().persist();
    reset();
    await useBoardStore.getState().hydrate();
    expect(useBoardStore.getState().resultFor(DAY)).toBeDefined();
  });

  it('starts empty on unreadable storage rather than throwing', async () => {
    await AsyncStorage.setItem(BOARD_CACHE_KEY, '{{{');
    await useBoardStore.getState().hydrate();
    expect(useBoardStore.getState().results).toEqual([]);
  });

  it('drops rows that are not shaped like a result', async () => {
    await AsyncStorage.setItem(
      BOARD_CACHE_KEY,
      JSON.stringify({ results: [{ day: 'x' }, { day: DAY, score: 900, flips: 24, ms: 1000 }] }),
    );
    await useBoardStore.getState().hydrate();
    expect(useBoardStore.getState().results).toHaveLength(1);
  });
});
