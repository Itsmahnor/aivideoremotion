import type {FC, ReactNode} from 'react';
import {AbsoluteFill} from 'remotion';
import {useSceneKit} from '../kit';
import {AnimatedBackground} from './AnimatedBackground';

type Props = {children: ReactNode; background?: 'gradient' | 'grid' | 'dots'};

/** Shared scene shell: animated background + safe-area padding + brand text defaults. */
export const SceneFrame: FC<Props> = ({children, background = 'gradient'}) => {
  const {brand, layout} = useSceneKit();
  const {safeArea} = layout;
  return (
    <AbsoluteFill style={{color: brand.colors.text, fontFamily: brand.fonts.body}}>
      <AnimatedBackground variant={background} />
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
    </AbsoluteFill>
  );
};
