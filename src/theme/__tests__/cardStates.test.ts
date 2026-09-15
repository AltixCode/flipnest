import { contrastRatio, withAlpha } from '../color';
import { darkPalette, lightPalette } from '../tokens';

/**
 * A face-up card must be tellable from a face-down one at a glance.
 *
 * The tint was 0.2, which gave 1.45:1 in dark mode — the same class of defect
 * found on MineStreak's grid, where two states were given near-identical fills.
 * This is a surface-against-surface check, not a text one, and a text-contrast
 * scan would never catch it.
 */
const FACE_UP_ALPHA = 0.38;
const MIN_STATE_SEPARATION = 1.7;

/** What `withAlpha` actually resolves to once composited over the surface. */
function composite(fg: string, bg: string, alpha: number): string {
  const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [fr, fg_, fb] = hex(fg);
  const [br, bg_, bb] = hex(bg);
  const mix = (f: number, b: number) => Math.round(f * alpha + b * (1 - alpha));
  return `#${[mix(fr!, br!), mix(fg_!, bg_!), mix(fb!, bb!)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

describe('card states', () => {
  it('separates a face-up card from a face-down one in dark mode', () => {
    const faceUp = composite(darkPalette.accent, darkPalette.surface, FACE_UP_ALPHA);
    expect(contrastRatio(faceUp, darkPalette.surface)).toBeGreaterThan(MIN_STATE_SEPARATION);
  });

  it('separates them in light mode too', () => {
    const faceUp = composite(lightPalette.accent, lightPalette.surface, FACE_UP_ALPHA);
    expect(contrastRatio(faceUp, lightPalette.surface)).toBeGreaterThan(MIN_STATE_SEPARATION);
  });

  it('keeps the face legible on the tinted card', () => {
    const faceUp = composite(darkPalette.accent, darkPalette.surface, FACE_UP_ALPHA);
    expect(contrastRatio(darkPalette.text, faceUp)).toBeGreaterThan(4.5);
  });

  it('still produces a usable rgba string', () => {
    expect(withAlpha(darkPalette.accent, FACE_UP_ALPHA)).toContain('rgba');
  });
});
