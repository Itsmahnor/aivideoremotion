import type {FC, ReactNode} from 'react';
import {CameraMotionBlur} from '@remotion/motion-blur';
import {useSceneKit} from '../kit';

/** Set to false to switch motion blur off everywhere (it makes the first frames of each scene slower to render). */
export const MOTION_BLUR_ENABLED = true;
const BLUR_FRAMES = 18;

/**
 * Motion blur only while a scene is entering (the fast part). After that it renders normally,
 * so the extra render cost is limited to the first ~0.6s of each scene.
 */
export const EntranceBlur: FC<{children: ReactNode}> = ({children}) => {
  const {frame} = useSceneKit();
  if (!MOTION_BLUR_ENABLED || frame >= BLUR_FRAMES) return <>{children}</>;
  return (
    <CameraMotionBlur shutterAngle={140} samples={6}>
      {children}
    </CameraMotionBlur>
  );
};