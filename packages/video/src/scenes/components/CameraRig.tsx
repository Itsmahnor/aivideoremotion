import type {FC, ReactNode} from 'react';
import {AbsoluteFill, interpolate} from 'remotion';
import {useSceneKit} from '../kit';

/** How far the camera pushes in over one scene, by the brand's spring feel. */
const ZOOM_BY_FEEL = {smooth: 0.035, snappy: 0.055, bouncy: 0.05} as const;

type Props = {
  /** 1 = foreground (moves most). Smaller = further away, so it moves less: that is the parallax. */
  depth?: number;
  /** Extra constant scale so panning never reveals an edge (use it on backgrounds). */
  bleed?: number;
  children: ReactNode;
};

/**
 * Slow push-in plus a gentle drift, driven only by the frame (deterministic).
 * SceneFrame wraps the background (far) and the content (near) in separate rigs.
 */
export const CameraRig: FC<Props> = ({depth = 1, bleed = 0, children}) => {
  const {brand, frame, sceneDuration, px} = useSceneKit();
  const zoom = ZOOM_BY_FEEL[brand.motion.springPreset];
  const progress = interpolate(frame, [0, Math.max(1, sceneDuration)], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const scale = 1 + bleed + zoom * depth * progress;
  const panX = Math.sin(frame / 110) * px(14) * depth;
  const panY = Math.cos(frame / 140) * px(9) * depth;

  return (
    <AbsoluteFill style={{transform: `translate3d(${panX}px, ${panY}px, 0) scale(${scale})`, transformOrigin: '50% 50%'}}>{children}</AbsoluteFill>
  );
};