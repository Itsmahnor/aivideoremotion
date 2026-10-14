import type {FC, ReactNode} from 'react';
import {AbsoluteFill} from 'remotion';
import {useSceneKit} from '../kit';
import {AnimatedBackground} from './AnimatedBackground';
import {CameraRig} from './CameraRig';
import {Grain, LightLeak, Vignette} from './Cinematic';
import {EntranceBlur} from './EntranceBlur';

type Props = {children: ReactNode; background?: 'gradient' | 'grid' | 'dots'};

/**
 * Shared scene shell: animated background + light + safe-area padding + finishing layers.
 * The background and the content sit in separate camera rigs (far / near), so every template
 * gets a slow push-in with parallax and blurred entrances without any per-template work.
 */
export const SceneFrame: FC<Props> = ({children, background = 'gradient'}) => {
  const {brand, layout} = useSceneKit();
  const {safeArea} = layout;
  return (
    <AbsoluteFill style={{color: brand.colors.text, fontFamily: brand.fonts.body}}>
      <CameraRig depth={0.35} bleed={0.03}>
        <AnimatedBackground variant={background} />
      </CameraRig>
      <LightLeak />
      <EntranceBlur>
        <CameraRig depth={1}>
          <AbsoluteFill
            style={{
              alignItems: 'center',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: `${safeArea.top}px ${safeArea.right}px ${safeArea.bottom}px ${safeArea.left}px`,
            }}
          >
            {children}
          </AbsoluteFill>
        </CameraRig>
      </EntranceBlur>
      <Vignette />
      <Grain />
    </AbsoluteFill>
  );
};