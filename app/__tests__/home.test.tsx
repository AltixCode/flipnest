import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import Home from '../index';
import { testRouter } from './testRouter';
import { renderWithProviders } from '@/components/__tests__/renderWithProviders';
import { t } from '@/i18n';
import { dayNumber } from '@/logic/board';
import { useAdsConsentStore } from '@/store/useAdsConsentStore';
import { useBoardStore } from '@/store/useBoardStore';
import { usePremiumStore } from '@/store/usePremiumStore';

const TODAY = dayNumber(Date.now());

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  usePremiumStore.setState({ isPremium: false, isReady: true });
  useAdsConsentStore.setState({ consent: { canServeAds: true, offerPrivacyOptions: false } });
  useBoardStore.setState({ results: [], themeId: null });
});

describe('Home', () => {
  it('renders the app name and routes to settings', async () => {
    const { getByText, getByLabelText } = await renderWithProviders(<Home />);
    expect(getByText(t('appName'))).toBeTruthy();
    await fireEvent.press(getByLabelText(t('settingsTitle')));
    expect(testRouter.push).toHaveBeenCalledWith('/settings');
  });

  it('shows a banner to a free user and none to a premium one', async () => {
    const free = await renderWithProviders(<Home />);
    expect(free.queryByTestId('banner-ad')).not.toBeNull();
    usePremiumStore.setState({ isPremium: true });
    const paid = await renderWithProviders(<Home />);
    expect(paid.queryByTestId('banner-ad')).toBeNull();
  });

  it('offers today’s board before it is played', async () => {
    const { getByText } = await renderWithProviders(<Home />);
    expect(getByText(t('playCta'))).toBeTruthy();
  });

  it('deals a full board when play starts', async () => {
    const { getByText, getAllByLabelText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByText(t('playCta')));
    await waitFor(() =>
      expect(getAllByLabelText(new RegExp(t('cardFaceDown'))).length).toBeGreaterThan(0),
    );
  });

  it('shows the result and offers a replay once the day is done', async () => {
    useBoardStore.setState({ results: [{ day: TODAY, score: 880, flips: 26, ms: 41000 }], themeId: null });
    const { getByText } = await renderWithProviders(<Home />);
    expect(getByText(t('clearedTitle'))).toBeTruthy();
    expect(getByText(t('replayCta'))).toBeTruthy();
  });

  it('shows a streak once there is one', async () => {
    useBoardStore.setState({
      results: [
        { day: TODAY - 1, score: 800, flips: 26, ms: 40000 },
        { day: TODAY, score: 900, flips: 24, ms: 30000 },
      ],
      themeId: null,
    });
    const { getByText } = await renderWithProviders(<Home />);
    expect(getByText(t('streakLabel', { n: 2 }))).toBeTruthy();
  });

  // The paid claim: pinning a theme. A free user must reach the paywall.
  it('sends a free user picking a locked theme to the paywall', async () => {
    const { getByLabelText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByLabelText(t('themeLocked', { name: t('themeHarbour') })));
    expect(testRouter.push).toHaveBeenCalledWith('/paywall');
  });

  it('lets a premium user pin one', async () => {
    usePremiumStore.setState({ isPremium: true, isReady: true });
    const { getByLabelText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByLabelText(t('themeHarbour')));
    await waitFor(() => expect(useBoardStore.getState().themeId).toBe('harbour'));
  });

  // The contrast finding: a locked chip must still render its name at full
  // strength. If this ever renders the label dimmed, that is the regression.
  it('shows a locked theme’s name as readable text, not a dimmed placeholder', async () => {
    const { getByText } = await renderWithProviders(<Home />);
    expect(getByText(t('themeHarbour'))).toBeTruthy();
  });
});
