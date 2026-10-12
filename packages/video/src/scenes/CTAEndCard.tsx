import type {FC} from 'react';
import type {z} from 'zod';
import {ctaEndCardProps} from '@ai-video-studio/schema';
import {textMetrics, withOpacity} from '../tokens';
import {Logo} from './components/Logo';
import {SceneFrame} from './components/SceneFrame';
import {useSceneKit} from './kit';

export type CTAEndCardProps = z.infer<typeof ctaEndCardProps>;

export const CTAEndCard: FC<CTAEndCardProps> = ({cta, url, subline}) => {
  const {brand, type, layout, enter, frame, px, step} = useSceneKit();
  const logoP = enter(0);
  const ctaP = enter(step + 4);
  const buttonP = enter(step * 2 + 10, 'bouncy');
  const urlP = enter(step * 3 + 14);
  const pulse = 1 + 0.025 * Math.sin(Math.max(0, frame - 40) / 7);
  const size = type.display * (layout.isPortrait ? 1.4 : 1.7) * Math.min(1, Math.max(0.7, 1.15 - cta.length / 90));

  return (
    <SceneFrame background="dots">
      <div style={{alignItems: 'center', display: 'flex', flexDirection: 'column', gap: px(44), textAlign: 'center'}}>
        <div style={{opacity: logoP, transform: `translateY(${(1 - logoP) * px(20)}px)`}}>
          <Logo height={px(layout.isPortrait ? 68 : 62)} />
        </div>
        <div style={{fontFamily: brand.fonts.heading, fontSize: size, fontWeight: textMetrics.fontWeight.bold, letterSpacing: textMetrics.letterSpacing.tight, lineHeight: 1.06, opacity: ctaP, transform: `translateY(${(1 - ctaP) * px(40)}px)`}}>
          {cta}
        </div>
        <div
          style={{
            alignItems: 'center',
            backgroundColor: brand.colors.accent,
            borderRadius: px(80),
            boxShadow: `0 ${px(16)}px ${px(44)}px ${withOpacity(brand.colors.accent, 0.45)}`,
            color: brand.colors.onAccent,
            display: 'flex',
            fontFamily: brand.fonts.heading,
            fontSize: type.title * 1.25,
            fontWeight: textMetrics.fontWeight.bold,
            gap: px(18),
            opacity: Math.min(1, buttonP * 1.5),
            padding: `${px(28)}px ${px(64)}px`,
            transform: `scale(${(0.6 + 0.4 * buttonP) * pulse})`,
          }}
        >
          {url}
          <svg width={px(34)} height={px(34)} viewBox="0 0 24 24" fill="none" stroke={brand.colors.onAccent} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </div>
        {subline ? <div style={{color: brand.colors.muted, fontSize: type.title, opacity: urlP, transform: `translateY(${(1 - urlP) * px(16)}px)`}}>{subline}</div> : null}
      </div>
    </SceneFrame>
  );
};
