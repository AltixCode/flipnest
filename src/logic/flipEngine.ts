/**
 * The flip/match state machine: which tiles are face up, and what a tap does
 * to them.
 *
 * Pure and dependency-free, on purpose. The "peek" a mismatched pair gets
 * before it closes is a *timer*, not a rule the state machine enforces --
 * this file has no notion of milliseconds at all. That split is what let a
 * TestFlight tester's complaint ("response time too slow... old card pairs
 * should close immediately as soon as users tap on new card") get fixed as a
 * one-line change at the call site instead of a rewrite: `tapCard` already
 * closes a stale pair the instant a new tile is tapped, synchronously, in the
 * same result. The timer in the caller is only a fallback for a player who
 * does not tap again right away.
 */
import { isPair, type Card } from "./board";

export interface FlipState {
  cards: Card[];
  /** Ids of the (unmatched) tiles currently showing. 0, 1 or 2 long. */
  faceUp: string[];
}

export interface TapResult {
  state: FlipState;
  /** A tile was actually turned face up by this tap. */
  opened: boolean;
  /** This tap completed a matching pair. */
  matched: boolean;
  /** This tap turned up a second tile that does not match the first -- the
   * pair is now peeking, pending its close. */
  mismatched: boolean;
  /** This tap closed an already-showing mismatched pair before opening the
   * tapped tile, rather than waiting for the peek timer. */
  clearedPriorMismatch: boolean;
}

const NOOP = (state: FlipState): TapResult => ({
  state,
  opened: false,
  matched: false,
  mismatched: false,
  clearedPriorMismatch: false,
});

/**
 * Applies one tap to the board. Never mutates `state`; every branch returns a
 * fresh `FlipState` (or the same object, unchanged, for a no-op).
 */
export function tapCard(state: FlipState, cardId: string): TapResult {
  const card = state.cards.find((c) => c.id === cardId);
  if (!card || card.matched) return NOOP(state);

  // Two tiles are already up. Since a matching pair is cleared in the same
  // step that marks it matched (see below), reaching here always means a
  // mismatched pair is peeking, waiting to close.
  if (state.faceUp.length === 2) {
    // Tapping one of the two tiles that are themselves the pending pair is a
    // no-op -- they are not clickable while showing, and this should not
    // re-trigger anything.
    if (state.faceUp.includes(cardId)) return NOOP(state);

    // The fix: a new tap is itself the signal the player is ready to move on.
    // Close the old pair and open the new tile in the same result, so there
    // is no frame in between where both are true.
    const opened = tapCard({ ...state, faceUp: [] }, cardId);
    return { ...opened, clearedPriorMismatch: true };
  }

  // Defensive: with faceUp.length < 2 this can only be reached by tapping the
  // single already-open tile again.
  if (state.faceUp.includes(cardId)) return NOOP(state);

  const faceUp = [...state.faceUp, cardId];
  if (faceUp.length < 2) {
    return {
      state: { ...state, faceUp },
      opened: true,
      matched: false,
      mismatched: false,
      clearedPriorMismatch: false,
    };
  }

  const [firstId, secondId] = faceUp as [string, string];
  const first = state.cards.find((c) => c.id === firstId)!;
  const second = state.cards.find((c) => c.id === secondId)!;

  if (isPair(first, second)) {
    const cards = state.cards.map((c) =>
      c.id === first.id || c.id === second.id ? { ...c, matched: true } : c,
    );
    return {
      state: { cards, faceUp: [] },
      opened: true,
      matched: true,
      mismatched: false,
      clearedPriorMismatch: false,
    };
  }

  return {
    state: { ...state, faceUp },
    opened: true,
    matched: false,
    mismatched: true,
    clearedPriorMismatch: false,
  };
}

/**
 * What the peek timer calls when it fires. Closes `currentFaceUp` only if it
 * is still exactly the pair the timer was set for -- if the player has since
 * tapped again (clearing it early, or moving on to a new pair), this is a
 * no-op instead of clobbering state the player has already changed.
 */
export function resolvePendingMismatch(
  currentFaceUp: readonly string[],
  watchedPair: readonly string[],
): string[] {
  if (
    currentFaceUp.length !== 2 ||
    currentFaceUp[0] !== watchedPair[0] ||
    currentFaceUp[1] !== watchedPair[1]
  ) {
    return [...currentFaceUp];
  }
  return [];
}
