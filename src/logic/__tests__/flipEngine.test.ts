import type { Card } from "../board";
import { resolvePendingMismatch, tapCard, type FlipState } from "../flipEngine";

const card = (id: string, faceId: string, matched = false): Card => ({
  id,
  faceId,
  matched,
});

const board = (): Card[] => [
  card("a-1", "apple"),
  card("a-2", "apple"),
  card("b-1", "berry"),
  card("b-2", "berry"),
  card("c-1", "cherry"),
  card("c-2", "cherry"),
];

const stateWith = (cards: Card[], faceUp: string[] = []): FlipState => ({
  cards,
  faceUp,
});

describe("tapCard", () => {
  it("opens the first tile of a pair", () => {
    const result = tapCard(stateWith(board()), "a-1");
    expect(result.opened).toBe(true);
    expect(result.matched).toBe(false);
    expect(result.mismatched).toBe(false);
    expect(result.clearedPriorMismatch).toBe(false);
    expect(result.state.faceUp).toEqual(["a-1"]);
  });

  it("matches two cards with the same face and clears faceUp", () => {
    const afterFirst = tapCard(stateWith(board()), "a-1").state;
    const result = tapCard(afterFirst, "a-2");
    expect(result.matched).toBe(true);
    expect(result.mismatched).toBe(false);
    expect(result.state.faceUp).toEqual([]);
    expect(result.state.cards.find((c) => c.id === "a-1")!.matched).toBe(true);
    expect(result.state.cards.find((c) => c.id === "a-2")!.matched).toBe(true);
  });

  it("leaves a mismatched pair face up, pending its close", () => {
    const afterFirst = tapCard(stateWith(board()), "a-1").state;
    const result = tapCard(afterFirst, "b-1");
    expect(result.opened).toBe(true);
    expect(result.matched).toBe(false);
    expect(result.mismatched).toBe(true);
    expect(result.state.faceUp).toEqual(["a-1", "b-1"]);
  });

  it("is a no-op on an already-matched card", () => {
    const cards = board().map((c) =>
      c.id === "a-1" || c.id === "a-2" ? { ...c, matched: true } : c,
    );
    const before = stateWith(cards);
    const result = tapCard(before, "a-1");
    expect(result.opened).toBe(false);
    expect(result.state).toBe(before);
  });

  it("is a no-op tapping a tile already showing mid-check (0/1 tiles flipped is unaffected by that rule)", () => {
    const oneFaceUp = tapCard(stateWith(board()), "a-1").state;
    // Tapping the same tile again while only one is face up: still a no-op,
    // and definitely not routed through the "clear the pending pair" branch
    // (there is no pending pair yet -- only one tile is showing).
    const result = tapCard(oneFaceUp, "a-1");
    expect(result.opened).toBe(false);
    expect(result.clearedPriorMismatch).toBe(false);
    expect(result.state).toBe(oneFaceUp);
  });

  // The reported bug: with a mismatched pair peeking, the player could not
  // open a third tile until a timer fired. The fix is that a new tap closes
  // the old pair itself, synchronously, in the same result -- not a promise
  // that a later timer will do it.
  it("closes an already-showing mismatched pair immediately when a third, different tile is tapped", () => {
    const afterFirst = tapCard(stateWith(board()), "a-1").state;
    const mismatched = tapCard(afterFirst, "b-1").state;
    expect(mismatched.faceUp).toEqual(["a-1", "b-1"]);

    const result = tapCard(mismatched, "c-1");

    expect(result.clearedPriorMismatch).toBe(true);
    expect(result.opened).toBe(true);
    // Synchronously observable in the resulting state -- not by waiting for
    // the timer: the old pair is gone from faceUp and only the new tile shows.
    expect(result.state.faceUp).toEqual(["c-1"]);
    // Neither of the old mismatched pair was ever marked matched -- they are
    // simply face down again.
    expect(result.state.cards.find((c) => c.id === "a-1")!.matched).toBe(false);
    expect(result.state.cards.find((c) => c.id === "b-1")!.matched).toBe(false);
  });

  it("proceeds to a real match after clearing a stale mismatched pair", () => {
    const afterFirst = tapCard(stateWith(board()), "a-1").state;
    const mismatched = tapCard(afterFirst, "b-1").state;
    const openedThird = tapCard(mismatched, "c-1").state;
    const result = tapCard(openedThird, "c-2");
    expect(result.matched).toBe(true);
    expect(result.state.faceUp).toEqual([]);
    expect(result.state.cards.find((c) => c.id === "c-1")!.matched).toBe(true);
  });

  it("is a no-op tapping one of the two tiles that are themselves the pending mismatched pair", () => {
    const afterFirst = tapCard(stateWith(board()), "a-1").state;
    const mismatched = tapCard(afterFirst, "b-1").state;
    const result = tapCard(mismatched, "a-1");
    expect(result.opened).toBe(false);
    expect(result.clearedPriorMismatch).toBe(false);
    expect(result.state).toBe(mismatched);

    const resultOther = tapCard(mismatched, "b-1");
    expect(resultOther.opened).toBe(false);
    expect(resultOther.state).toBe(mismatched);
  });
});

describe("resolvePendingMismatch", () => {
  it("clears the pair the timer was watching when nothing has tapped again", () => {
    const faceUp = resolvePendingMismatch(["a-1", "b-1"], ["a-1", "b-1"]);
    expect(faceUp).toEqual([]);
  });

  it("does nothing if the board has already moved on to a different pair (no double-clearing)", () => {
    // A tap cleared the watched pair and opened a new one before the timer fired.
    const faceUp = resolvePendingMismatch(["c-1"], ["a-1", "b-1"]);
    expect(faceUp).toEqual(["c-1"]);
  });

  it("does nothing once a pair has already matched and faceUp is empty", () => {
    const faceUp = resolvePendingMismatch([], ["a-1", "b-1"]);
    expect(faceUp).toEqual([]);
  });

  it("does nothing when a newer mismatched pair is showing instead", () => {
    const faceUp = resolvePendingMismatch(["c-1", "a-1"], ["a-1", "b-1"]);
    expect(faceUp).toEqual(["c-1", "a-1"]);
  });
});
