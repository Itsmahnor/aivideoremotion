import type {BrandKit} from '@ai-video-studio/schema';

export type VisualStyleToken = {blobStrength: number; pattern: 'scene' | 'grid' | 'dots' | 'none'};

/** 'scene' keeps the pattern each template chooses. Any other value overrides it for the whole video. */
export const visualStyleTokens: Record<BrandKit['visualStyle'], VisualStyleToken> = {
  'modern-saas': {blobStrength: 0.3, pattern: 'scene'},
  minimal: {blobStrength: 0.12, pattern: 'dots'},
  cinematic: {blobStrength: 0.45, pattern: 'none'},
  corporate: {blobStrength: 0.2, pattern: 'grid'},
  playful: {blobStrength: 0.4, pattern: 'dots'},
};