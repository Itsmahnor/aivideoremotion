import type {FC, ReactNode} from 'react';
import {AbsoluteFill} from 'remotion';
import {useSceneKit} from '../kit';
import {AnimatedBackground} from './AnimatedBackground';
import {Grain, LightLeak, Vignette} from './Cinematic';

type Props = {children: ReactNode; background?: 'gradient' | 'grid' | 'dots'};

/** Shared scene shell: animated background + light + safe-area padding + finishing layers. */
export const SceneFrame: FC<Props> = ({children, background = 'gradient'}) => {
  const {brand, layout} = useSceneKit();
  const {safeArea} = layout;
  return (
    <AbsoluteFill style={{color: brand.colors.text, fontFamily: brand.fonts.body}}>
      <AnimatedBackground variant={background} />
      <LightLeak />
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
      <Vignette />
      <Grain />
    </AbsoluteFill>
  );
};