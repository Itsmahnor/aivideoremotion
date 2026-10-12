import {useVideoConfig} from 'remotion';

export const aspectRatioConfigs = {
  '9:16': {
    width: 1080,
    height: 1920,
    safeZone: {top: 0.14, bottom: 0.2, horizontal: 0.06},
  },
  '1:1': {
    width: 1080,
    height: 1080,
    safeZone: {top: 0.08, bottom: 0.08, horizontal: 0.06},
  },
  '16:9': {
    width: 1920,
    height: 1080,
    safeZone: {top: 0.07, bottom: 0.07, horizontal: 0.05},
  },
} as const;

export type AspectRatio = keyof typeof aspectRatioConfigs;

const spacingGridUnit = 8;
const spacingMultipliers = {xs: 1, sm: 2, md: 3, lg: 4, xl: 6, xxl: 8} as const;
const referenceShortSide = aspectRatioConfigs['1:1'].width;

export const previewLayoutTokens = {
  sectionGapMultiplier: 1,
  swatchMinWidthMultiplier: 10,
  springDemoCount: 3,
  borderWidth: 1,
  cardRadiusMultiplier: 1,
} as const;

export const getAspectRatio = (width: number, height: number): AspectRatio => {
  if (width === height) return '1:1';
  return height > width ? '9:16' : '16:9';
};

export const getSpacing = (width: number, height: number) => {
  const scale = Math.min(width, height) / referenceShortSide;
  return Object.fromEntries(
    Object.entries(spacingMultipliers).map(([name, multiplier]) => [name, spacingGridUnit * multiplier * scale]),
  ) as Record<keyof typeof spacingMultipliers, number>;
};

export const useLayout = () => {
  const {height, width} = useVideoConfig();
  const ratio = getAspectRatio(width, height);
  const safeZone = aspectRatioConfigs[ratio].safeZone;
  const safeArea = {
    top: height * safeZone.top,
    right: width * safeZone.horizontal,
    bottom: height * safeZone.bottom,
    left: width * safeZone.horizontal,
  };

  return {
    ratio,
    width,
    height,
    safeArea,
    spacing: getSpacing(width, height),
    isPortrait: height > width,
  };
};
