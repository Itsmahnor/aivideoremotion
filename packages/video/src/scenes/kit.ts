import {createContext, useContext} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {enterProgress, getTypeScale, staggerPresets, useBrand, useLayout, type SpringPreset} from '../tokens';

/** DynamicVideo provides each scene's own length. In Studio previews it falls back to the composition length. */
export const SceneDurationContext = createContext<number | null>(null);

export const useSceneKit = () => {
  const brand = useBrand();
  const layout = useLayout();
  const frame = useCurrentFrame();
  const {fps, durationInFrames: compositionDuration} = useVideoConfig();
  const sceneDuration = useContext(SceneDurationContext) ?? compositionDuration;
  const type = getTypeScale(layout.width, layout.height);
  const unit = Math.min(layout.width, layout.height) / 1080;
  const step = staggerPresets[brand.motion.staggerPreset];
  const preset = brand.motion.springPreset;
  const contentWidth = layout.width - layout.safeArea.left - layout.safeArea.right;
  const contentHeight = layout.height - layout.safeArea.top - layout.safeArea.bottom;

  return {
    brand,
    layout,
    frame,
    fps,
    sceneDuration,
    type,
    step,
    preset,
    contentWidth,
    contentHeight,
    /** Scale a 1080-based pixel value to this video size. */
    px: (value: number): number => value * unit,
    /** 0..1 spring progress, starting at `delay` frames. */
    enter: (delay = 0, override?: SpringPreset): number => enterProgress({frame, fps, delay, preset: override ?? preset}),
  };
};
