import {fitText} from '@remotion/layout-utils';

export const typeScaleMultipliers = {
  display: 0.08,
  headline: 0.055,
  title: 0.04,
  body: 0.027,
  caption: 0.02,
} as const;

export const textMetrics = {
  lineHeight: {tight: 0.95, normal: 1.35},
  letterSpacing: {tight: '-0.04em', normal: '0em'},
  fontWeight: {regular: 400, semibold: 600, bold: 700},
} as const;

export const getTypeScale = (width: number, height: number) => {
  const shortSide = Math.min(width, height);
  return Object.fromEntries(
    Object.entries(typeScaleMultipliers).map(([name, multiplier]) => [name, shortSide * multiplier]),
  ) as Record<keyof typeof typeScaleMultipliers, number>;
};

export const fitFontSize = (
  text: string,
  maxWidth: number,
  maxFontSize: number,
  fontFamily: string,
): number =>
  Math.min(
    maxFontSize,
    fitText({text, withinWidth: maxWidth, fontFamily, validateFontIsLoaded: false}).fontSize,
  );
