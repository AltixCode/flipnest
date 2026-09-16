import Feather from '@expo/vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BannerAdSlot } from '@/components/BannerAdSlot';
import { Button, Card as Surface, Text } from '@/components/ui';
import { t, type TranslationKey } from '@/i18n';
import {
  PAIRS,
  THEMES,
  FACE_GLYPH,
  canUseTheme,
  dayNumber,
  dealBoard,
  isCleared,
  isPair,
  scoreBoard,
  type Card,
} from '@/logic/board';
import { noteGameFinished } from '@/monetization/pacing';
import { useBoardStore } from '@/store/useBoardStore';
import { usePremiumStore } from '@/store/usePremiumStore';
import { MIN_TOUCH_TARGET, useTheme, withAlpha } from '@/theme';

const COLUMNS = 4;
const ROWS = PAIRS * 2 / COLUMNS;
/** How long a mismatched pair stays visible before flipping back. */
const PEEK_MS = 800;

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, spacing, radius } = useTheme();

  const isPremium = usePremiumStore((s) => s.isPremium);
  const isReady = usePremiumStore((s) => s.isReady);
  const hydrate = useBoardStore((s) => s.hydrate);
  const activeTheme = useBoardStore((s) => s.activeTheme);
  const chooseTheme = useBoardStore((s) => s.chooseTheme);
  const finish = useBoardStore((s) => s.finish);
  const resultFor = useBoardStore((s) => s.resultFor);
  const streak = useBoardStore((s) => s.streak);

  const [day] = useState(() => dayNumber(Date.now()));
  const [cards, setCards] = useState<Card[]>([]);
  const [faceUp, setFaceUp] = useState<string[]>([]);
  const [flips, setFlips] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [playing, setPlaying] = useState(false);
  // Measured, not assumed: a fixed height leaves a dead band on a large screen.
  const [boardWidth, setBoardWidth] = useState(0);

  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void hydrate();
    return () => {
      if (peekTimer.current) clearTimeout(peekTimer.current);
    };
  }, [hydrate]);

  const themeId = activeTheme(day);
  const todayResult = resultFor(day);

  const start = useCallback(() => {
    setCards(dealBoard(day, themeId));
    setFaceUp([]);
    setFlips(0);
    setStartedAt(Date.now());
    setPlaying(true);
  }, [day, themeId]);

  const complete = useCallback(
    (finished: Card[], totalFlips: number) => {
      setPlaying(false);
      finish(day, totalFlips, Date.now() - startedAt);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void noteGameFinished();
      setCards(finished);
    },
    [day, finish, startedAt, isPremium, isReady],
  );

  const flip = (card: Card) => {
    if (!playing || card.matched || faceUp.includes(card.id) || faceUp.length === 2) return;
    const next = [...faceUp, card.id];
    setFaceUp(next);
    const total = flips + 1;
    setFlips(total);
    void Haptics.selectionAsync();
    if (next.length < 2) return;

    const [a, b] = next.map((id) => cards.find((c) => c.id === id)!);
    if (isPair(a!, b!)) {
      const matched = cards.map((c) => (c.id === a!.id || c.id === b!.id ? { ...c, matched: true } : c));
      setCards(matched);
      setFaceUp([]);
      if (isCleared(matched)) complete(matched, total);
      return;
    }
    // A mismatch stays visible briefly. Clearing in a timeout rather than in an
    // effect keeps this an event: the player did something, and this is the
    // consequence.
    peekTimer.current = setTimeout(() => setFaceUp([]), PEEK_MS);
  };

  const pickTheme = (id: string) => {
    if (chooseTheme(id, isPremium) === 'locked') router.push('/paywall');
  };

  const gap = spacing.sm;
  const cardSize = boardWidth > 0 ? (boardWidth - gap * (COLUMNS - 1)) / COLUMNS : 0;
  const days = streak(day);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.base,
          paddingHorizontal: spacing.base,
          paddingBottom: spacing.xl,
          gap: spacing.base,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <Text variant="title" style={styles.grow}>
            {t('appName')}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('settingsTitle')}
            onPress={() => router.push('/settings')}
            hitSlop={8}
            style={styles.iconSlot}
          >
            <Feather name="settings" size={20} color={colors.textMuted} />
          </Pressable>
        </View>

        <Text variant="heading">{t('todayTitle')}</Text>
        {days > 0 ? (
          <Text variant="caption" tone="muted">
            {t('streakLabel', { n: days })}
          </Text>
        ) : null}

        <View
          onLayout={(e) => setBoardWidth(e.nativeEvent.layout.width)}
          style={[styles.board, { gap }]}
        >
          {cards.map((card, i) => {
            const shown = card.matched || faceUp.includes(card.id);
            const state = card.matched ? t('cardMatched') : shown ? card.faceId : t('cardFaceDown');
            return (
              <Pressable
                key={card.id}
                accessibilityRole="button"
                accessibilityLabel={t('cardLabel', { n: i + 1, state })}
                accessibilityState={{ disabled: !playing || card.matched }}
                onPress={() => flip(card)}
                style={[
                  styles.card,
                  {
                    width: cardSize,
                    height: cardSize,
                    borderRadius: radius.md,
                    // 0.38, not 0.2. At 0.2 a face-up card differed from a
                    // face-down one by 1.45:1 in dark mode, which is close to
                    // invisible; this gives 2.21:1 dark and 1.79:1 light while
                    // keeping the face text above 7:1 on the tinted ground.
                    backgroundColor: shown ? withAlpha(colors.accent, 0.38) : colors.surface,
                    borderColor: card.matched ? colors.accent : colors.border,
                    borderWidth: card.matched ? 2 : StyleSheet.hairlineWidth,
                  },
                ]}
              >
                {/* The glyph, sized to the card. A fixed size here would be
                    the Worddrop keyboard bug again: the card grows on a tablet
                    and the face would not.

                    lineHeight is not optional. An emoji's glyph box is taller
                    than the default line box React Native derives from
                    fontSize, so without this the face is clipped along the
                    bottom -- the pear and lemon rendered as bottom-halves, and
                    because the size is a fraction of cardSize it gets worse on
                    a tablet, not better. textAlignVertical keeps Android from
                    seating it on the baseline once the line box has slack. */}
                <Text
                  style={{
                    fontSize: Math.round(cardSize * 0.46),
                    lineHeight: Math.round(cardSize * 0.46 * 1.3),
                    textAlign: 'center',
                    textAlignVertical: 'center',
                  }}
                >
                  {shown ? (FACE_GLYPH[card.faceId] ?? '') : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {playing ? (
          <Text variant="caption" tone="muted">
            {t('flipsLabel')}: {flips}
          </Text>
        ) : todayResult ? (
          <Surface>
            <Text variant="heading">{t('clearedTitle')}</Text>
            <Text variant="body">
              {t('scoreLabel')}: {todayResult.score}
            </Text>
            <Text variant="caption" tone="muted">
              {t('flipsLabel')}: {todayResult.flips} · {t('timeLabel')}:{' '}
              {Math.round(todayResult.ms / 1000)}s
            </Text>
          </Surface>
        ) : null}

        {playing ? null : (
          <Button
            label={todayResult ? t('replayCta') : t('playCta')}
            icon="play"
            onPress={start}
          />
        )}

        <Text variant="heading" style={{ marginTop: spacing.base }}>
          {t('themeTitle')}
        </Text>
        <View style={[styles.chipRow, { gap: spacing.sm }]}>
          {THEMES.map((theme) => {
            const allowed = canUseTheme(theme.id, isPremium);
            const name = t(theme.nameKey as TranslationKey);
            const chosen = theme.id === themeId;
            return (
              <Pressable
                key={theme.id}
                accessibilityRole="button"
                accessibilityLabel={allowed ? name : t('themeLocked', { name })}
                accessibilityState={{ selected: chosen, disabled: !allowed }}
                onPress={() => pickTheme(theme.id)}
                style={[
                  styles.chip,
                  {
                    borderRadius: radius.full,
                    paddingHorizontal: spacing.base,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: chosen ? colors.accent : colors.border,
                    backgroundColor: chosen ? withAlpha(colors.accent, 0.16) : colors.surface,
                  },
                ]}
              >
                {/* The label stays at full contrast whether or not it is locked.
                    Dimming text to signal state makes it unreadable for exactly
                    the people who need it most; the lock icon and the
                    accessibility label carry the meaning instead. */}
                <Text variant="body">{name}</Text>
                {allowed ? null : <Feather name="lock" size={14} color={colors.textMuted} />}
              </Pressable>
            );
          })}
        </View>
        {isPremium ? null : (
          <Text variant="caption" tone="muted">
            {t('themeFollowsDay')}
          </Text>
        )}
      </ScrollView>
      <BannerAdSlot />
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
  iconSlot: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  board: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { alignItems: 'center', justifyContent: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: MIN_TOUCH_TARGET },
});
