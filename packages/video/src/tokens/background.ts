import type {BrandKit} from '@ai-video-studio/schema';

export const backgroundCss = (brand: Pick<BrandKit, 'colors' | 'gradient'>): string =>
  brand.gradient.enabled
    ? `linear-gradient(${brand.gradient.angle}deg, ${brand.gradient.from}, ${brand.gradient.to})`
    : brand.colors.background;