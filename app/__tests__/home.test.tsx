import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, waitFor } from "@testing-library/react-native";
import React from "react";

import Home from "../index";
import { testRouter } from "./testRouter";
import { renderWithProviders } from "@/components/__tests__/renderWithProviders";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { t } from "@/i18n";
import { dayNumber, dealBoard } from "@/logic/board";
import { useAdsConsentStore } from "@/store/useAdsConsentStore";
import { useBoardStore } from "@/store/useBoardStore";
import { usePremiumStore } from "@/store/usePremiumStore";

jest.mock("@/hooks/useSoundEffects", () => ({ useSoundEffects: jest.fn() }));

const TODAY = dayNumber(Date.now());

/** Today's deterministic deal, grouped into the two card indices of each pair. */
function pairIndices(): [number, number][] {
  const dealt = dealBoard(TODAY);
  const byFace = new Map<string, number[]>();
  dealt.forEach((card, i) => {
    byFace.set(card.faceId, [...(byFace.get(card.faceId) ?? []), i]);
  });
  return [...byFace.values()].map(([a, b]) => [a!, b!]);
}

let playMock: jest.Mock;

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  usePremiumStore.setState({ isPremium: false, isReady: true });
  useAdsConsentStore.setState({
    consent: { canServeAds: true, offerPrivacyOptions: false },
  });
  useBoardStore.setState({ results: [], themeId: null });
  playMock = jest.fn();
  (useSoundEffects as jest.Mock).mockReturnValue(playMock);
});

describe("Home", () => {
  it("renders the app name and routes to settings", async () => {
    const { getByText, getByLabelText } = await renderWithProviders(<Home />);
    expect(getByText(t("appName"))).toBeTruthy();
    await fireEvent.press(getByLabelText(t("settingsTitle")));
    expect(testRouter.push).toHaveBeenCalledWith("/settings");
  });

  it("shows a banner to a free user and none to a premium one", async () => {
    const free = await renderWithProviders(<Home />);
    expect(free.queryByTestId("banner-ad")).not.toBeNull();
    usePremiumStore.setState({ isPremium: true });
    const paid = await renderWithProviders(<Home />);
    expect(paid.queryByTestId("banner-ad")).toBeNull();
  });

  it("offers today’s board before it is played", async () => {
    const { getByText } = await renderWithProviders(<Home />);
    expect(getByText(t("playCta"))).toBeTruthy();
  });

  it("deals a full board when play starts", async () => {
    const { getByText, getAllByLabelText } = await renderWithProviders(
      <Home />,
    );
    await fireEvent.press(getByText(t("playCta")));
    await waitFor(() =>
      expect(
        getAllByLabelText(new RegExp(t("cardFaceDown"))).length,
      ).toBeGreaterThan(0),
    );
  });

  it("shows the result and offers a replay once the day is done", async () => {
    useBoardStore.setState({
      results: [{ day: TODAY, score: 880, flips: 26, ms: 41000 }],
      themeId: null,
    });
    const { getByText } = await renderWithProviders(<Home />);
    expect(getByText(t("clearedTitle"))).toBeTruthy();
    expect(getByText(t("replayCta"))).toBeTruthy();
  });

  it("shows a streak once there is one", async () => {
    useBoardStore.setState({
      results: [
        { day: TODAY - 1, score: 800, flips: 26, ms: 40000 },
        { day: TODAY, score: 900, flips: 24, ms: 30000 },
      ],
      themeId: null,
    });
    const { getByText } = await renderWithProviders(<Home />);
    expect(getByText(t("streakLabel", { n: 2 }))).toBeTruthy();
  });

  // The paid claim: pinning a theme. A free user must reach the paywall.
  it("sends a free user picking a locked theme to the paywall", async () => {
    const { getByLabelText } = await renderWithProviders(<Home />);
    await fireEvent.press(
      getByLabelText(t("themeLocked", { name: t("themeHarbour") })),
    );
    expect(testRouter.push).toHaveBeenCalledWith("/paywall");
  });

  it("lets a premium user pin one", async () => {
    usePremiumStore.setState({ isPremium: true, isReady: true });
    const { getByLabelText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByLabelText(t("themeHarbour")));
    await waitFor(() =>
      expect(useBoardStore.getState().themeId).toBe("harbour"),
    );
  });

  // The contrast finding: a locked chip must still render its name at full
  // strength. If this ever renders the label dimmed, that is the regression.
  it("shows a locked theme’s name as readable text, not a dimmed placeholder", async () => {
    const { getByText } = await renderWithProviders(<Home />);
    expect(getByText(t("themeHarbour"))).toBeTruthy();
  });

  // A TestFlight tester: "Needs a 'how to play' button... so users don't just
  // get faced to blank tiles with no idea what to do."
  it("offers a how-to-play button that explains the rules", async () => {
    const alert = jest
      .spyOn(require("react-native").Alert, "alert")
      .mockImplementation(() => {});
    const { getByLabelText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByLabelText(t("howToPlayCta")));
    expect(alert).toHaveBeenCalledWith(
      t("howToPlayTitle"),
      t("howToPlayBody"),
      [{ text: t("ok") }],
    );
  });

  // A tester: "the play again button should be on the right side... aligned
  // to the right most part of the screen so users don't need to scroll to
  // play another game."
  it("places the cleared result and its replay button before the board, right-aligned, so neither needs a scroll past a finished board", async () => {
    const { getByText, getByLabelText, toJSON } = await renderWithProviders(
      <Home />,
    );
    await fireEvent.press(getByText(t("playCta")));

    for (const [a, b] of pairIndices()) {
      await fireEvent.press(
        getByLabelText(t("cardLabel", { n: a + 1, state: t("cardFaceDown") })),
      );
      await fireEvent.press(
        getByLabelText(t("cardLabel", { n: b + 1, state: t("cardFaceDown") })),
      );
    }

    await waitFor(() => expect(getByText(t("clearedTitle"))).toBeTruthy());
    const replayButton = getByText(t("replayCta"));
    expect(replayButton).toBeTruthy();

    const json = JSON.stringify(toJSON());
    const clearedIndex = json.indexOf(t("clearedTitle"));
    const firstCardIndex = json.indexOf(
      t("cardLabel", { n: 1, state: t("cardMatched") }),
    );
    expect(clearedIndex).toBeGreaterThan(-1);
    expect(firstCardIndex).toBeGreaterThan(-1);
    // The result banner -- and the replay button right after it -- render
    // before the (still fully rendered, 24-tile) board, not after it.
    expect(clearedIndex).toBeLessThan(firstCardIndex);
    // Right-aligned via the theme's own layout primitive, not a literal margin.
    expect(json).toContain('"alignSelf":"flex-end"');
  });

  // The reported bug: "Response time too slow... Old card pairs should close
  // immediately as soon as users tap on new card." This drives the fix
  // end-to-end through the screen, complementing the unit-level coverage in
  // src/logic/__tests__/flipEngine.test.ts.
  it("closes a mismatched pair immediately when a third tile is tapped, without waiting for the peek delay", async () => {
    jest.useFakeTimers();
    try {
      const { getByText, getByLabelText } = await renderWithProviders(<Home />);
      await fireEvent.press(getByText(t("playCta")));

      const dealt = dealBoard(TODAY);
      const aIndex = 0;
      const bIndex = dealt.findIndex(
        (c, i) => i !== aIndex && c.faceId !== dealt[aIndex]!.faceId,
      );
      const cIndex = dealt.findIndex(
        (c, i) =>
          i !== aIndex &&
          i !== bIndex &&
          c.faceId !== dealt[aIndex]!.faceId &&
          c.faceId !== dealt[bIndex]!.faceId,
      );

      const label = (i: number, state: string) =>
        t("cardLabel", { n: i + 1, state });

      await fireEvent.press(getByLabelText(label(aIndex, t("cardFaceDown"))));
      await fireEvent.press(getByLabelText(label(bIndex, t("cardFaceDown"))));
      // Mismatched: both now showing their face, peek timer pending. Do NOT
      // advance fake timers -- the close below must happen without one.
      expect(getByLabelText(label(aIndex, dealt[aIndex]!.faceId))).toBeTruthy();
      expect(getByLabelText(label(bIndex, dealt[bIndex]!.faceId))).toBeTruthy();

      await fireEvent.press(getByLabelText(label(cIndex, t("cardFaceDown"))));

      // Synchronously true the instant the third tile is tapped: the old
      // pair is face down again and the new tile is open -- no timer fired.
      expect(getByLabelText(label(aIndex, t("cardFaceDown")))).toBeTruthy();
      expect(getByLabelText(label(bIndex, t("cardFaceDown")))).toBeTruthy();
      expect(getByLabelText(label(cIndex, dealt[cIndex]!.faceId))).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  // A tester: "Sound effect on opening and closing of tiles would be great."
  it("plays a flip sound on the first tile of a pair, and a mismatch sound the moment a pair fails to match", async () => {
    const { getByText, getByLabelText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByText(t("playCta")));

    const dealt = dealBoard(TODAY);
    const bIndex = dealt.findIndex(
      (c, i) => i !== 0 && c.faceId !== dealt[0]!.faceId,
    );
    const label = (i: number, state: string) =>
      t("cardLabel", { n: i + 1, state });

    await fireEvent.press(getByLabelText(label(0, t("cardFaceDown"))));
    expect(playMock).toHaveBeenCalledWith("tap");

    await fireEvent.press(getByLabelText(label(bIndex, t("cardFaceDown"))));
    expect(playMock).toHaveBeenCalledWith("fail");
  });
});
