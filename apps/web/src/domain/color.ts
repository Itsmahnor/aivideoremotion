/** Color parsing, formatting and WCAG contrast checks. Pure functions, no DOM. */

export type Rgb = {r: number; g: number; b: number};

/** Accepts "#abc", "abc", "#aabbcc" or "aabbcc" (any case). Returns "#AABBCC" or null. */
export const normalizeHex = (input: string): string | null => {
  const value = input.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(value)) {
    return `#${value
      .split('')
      .map((c) => c + c)
      .join('')
      .toUpperCase()}`;
  }
  if (/^[0-9a-f]{6}$/i.test(value)) return `#${value.toUpperCase()}`;
  return null;
};

export const hexToRgb = (hex: string): Rgb => {
  const normalized = normalizeHex(hex) ?? '#000000';
  const n = parseInt(normalized.slice(1), 16);
  return {r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255};
};

export const isChannel = (value: number): boolean => Number.isInteger(value) && value >= 0 && value <= 255;

export const rgbToHex = ({r, g, b}: Rgb): string | null => {
  if (![r, g, b].every(isChannel)) return null;
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
};

/** Parses "rgb(1, 2, 3)" or "1, 2, 3" or "1 2 3". */
export const parseRgbString = (input: string): string | null => {
  const match = input.trim().match(/^(?:rgb\()?\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*\)?$/i);
  if (!match) return null;
  return rgbToHex({r: Number(match[1]), g: Number(match[2]), b: Number(match[3])});
};

const linear = (channel: number): number => {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export const relativeLuminance = (hex: string): number => {
  const {r, g, b} = hexToRgb(hex);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
};

export const contrastRatio = (a: string, b: string): number => {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

/** Mirrors the video package: text on a colored surface is either near-black or white, whichever reads better. */
export const readableOn = (hex: string): string => (contrastRatio(hex, '#0F172A') >= contrastRatio(hex, '#FFFFFF') ? '#0F172A' : '#FFFFFF');

export type ContrastWarning = {id: string; level: 'warning' | 'danger'; message: string; ratio: number};

type Colors = {primary: string; secondary: string; accent: string; background: string; text: string};

/**
 * Readability checks for the brand palette. Thresholds follow WCAG 2.x:
 * 4.5:1 for body text, 3:1 for large text and UI shapes. Video text is mostly large, so <3 is "danger".
 */
export const paletteWarnings = (colors: Colors): ContrastWarning[] => {
  const checks: {id: string; a: string; b: string; label: string; min: number}[] = [
    {id: 'text-bg', a: colors.text, b: colors.background, label: 'Text on background', min: 4.5},
    {id: 'primary-bg', a: colors.primary, b: colors.background, label: 'Primary on background', min: 3},
    {id: 'accent-bg', a: colors.accent, b: colors.background, label: 'Accent (highlighted words) on background', min: 3},
  ];
  const warnings: ContrastWarning[] = [];
  for (const check of checks) {
    const ratio = contrastRatio(check.a, check.b);
    if (ratio < check.min) {
      warnings.push({
        id: check.id,
        ratio,
        level: ratio < 3 ? 'danger' : 'warning',
        message: `${check.label} has a contrast of ${ratio.toFixed(1)}:1 (recommended ${check.min}:1 or more). It may be hard to read.`,
      });
    }
  }
  if (colors.primary === colors.secondary) {
    warnings.push({id: 'same', ratio: 1, level: 'warning', message: 'Primary and secondary are identical, so backgrounds will look flat.'});
  }
  return warnings;
};
