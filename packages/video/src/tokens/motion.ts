import {Easing, interpolate, spring} from 'remotion';
import type {BrandKit} from '@ai-video-studio/schema';

export const springPresets = {
  snappy: {damping: 16, stiffness: 240, mass: 0.7},
  smooth: {damping: 22, stiffness: 120, mass: 1},
  bouncy: {damping: 10, stiffness: 180, mass: 0.8},
} as const;

export type SpringPreset = keyof typeof springPresets;

export const easingCurves = {
  enter: Easing.bezier(0.16, 1, 0.3, 1),
  exit: Easing.bezier(0.7, 0, 0.84, 0),
  emphasis: Easing.bezier(0.34, 1.56, 0.64, 1),
};

export const staggerPresets = {fast: 4, normal: 8, slow: 15} as const;
export type StaggerPreset = keyof typeof staggerPresets;

export const standardFps = 30;
export const standardDurations = {quick: 8, normal: 15, slow: 30, hold: 45} as const;
export const percentageScale = 100;

export const staggerDelay = (index: number, stepInFrames: number): number => index * stepInFrames;

export const enterProgress = ({
  frame,
  fps,
  delay,
  preset,
}: {
  frame: number;
  fps: number;
  delay: number;
  preset: SpringPreset;
}): number =>
  Math.min(1, Math.max(0, spring({frame: Math.max(0, frame - delay), fps, config: springPresets[preset]})));

export const exitProgress = ({
  frame,
  durationInFrames,
  exitFrames,
}: {
  frame: number;
  durationInFrames: number;
  exitFrames: number;
}): number =>
  interpolate(frame, [durationInFrames - exitFrames, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

export const motionStyleMap = {
  calm: {springPreset: 'smooth', staggerPreset: 'slow', transitionType: 'fade'},
  energetic: {springPreset: 'snappy', staggerPreset: 'fast', transitionType: 'slide'},
  playful: {springPreset: 'bouncy', staggerPreset: 'normal', transitionType: 'wipe'},
  corporate: {springPreset: 'smooth', staggerPreset: 'normal', transitionType: 'fade'},
} as const satisfies Record<BrandKit['motionStyle'], {
  springPreset: SpringPreset;
  staggerPreset: StaggerPreset;
  transitionType: 'fade' | 'slide' | 'wipe';
}>;
