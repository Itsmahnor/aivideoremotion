import type {FC} from 'react';
import type {z} from 'zod';
import {hookStatementProps} from '@ai-video-studio/schema';
import {interpolate} from 'remotion';
import {getContrastRatio, textMetrics} from '../tokens';
import {SceneFrame} from './components/SceneFrame';
import {useSceneKit} from './kit';

export type HookStatementProps = z.infer<typeof hookStatementProps>;

const normalize = (word: string): string => word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

export const HookStatement: FC<HookStatementProps> = ({line, emphasisWords, subline, style}) => {
  const {brand, type, layout, step, enter, frame, px} = useSceneKit();
  const words = line.split(/\s+/).filter(Boolean);
  const emphasis = new Set(emphasisWords.map(normalize));
  const base = type.display * (layout.isPortrait ? 1.35 : 1.6);
  const fontSize = base * Math.min(1, Math.max(0.66, 1.2 - line.length / 105));
  const emphasisColor = getContrastRatio(brand.colors.primary, brand.colors.background) >= 3 ? brand.colors.primary : brand.colors.text;
  // Keep the whole line revealed within ~1.5s, even for slow (calm) brands and long lines.
  const wordStep = Math.min(step, Math.max(3, Math.floor(45 / words.length)));
  const sublineProgress = enter(10 + words.length * wordStep + 8, 'smooth');

  return (
    <SceneFrame background="gradient">
      <div style={{maxWidth: '100%', textAlign: 'center'}}>
        <div
          style={{
            fontFamily: brand.fonts.heading,
            fontSize,
            fontWeight: textMetrics.fontWeight.bold,
            letterSpacing: textMetrics.letterSpacing.tight,
            lineHeight: 1.08,
          }}
        >
          {words.map((word, index) => {
            const isEmphasis = emphasis.has(normalize(word));
            const progress = enter(6 + index * wordStep, style === 'scale-pop' ? 'bouncy' : undefined);
            const barProgress = interpolate(frame, [6 + index * wordStep + 8, 6 + index * wordStep + 24], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
            const inner = (
              <span
                style={{
                  color: isEmphasis ? emphasisColor : brand.colors.text,
                  display: 'inline-block',
                  opacity: style === 'slide-up' ? 1 : Math.min(1, progress * 1.6),
                  position: 'relative',
                  transform:
                    style === 'scale-pop'
                      ? `scale(${0.55 + 0.45 * progress})`
                      : style === 'slide-up'
                        ? `translateY(${(1 - progress) * 110}%)`
                        : `translateY(${(1 - progress) * 0.45}em)`,
                }}
              >
                {word}
                {isEmphasis ? (
                  <span
                    style={{
                      backgroundColor: brand.colors.accent,
                      borderRadius: px(6),
                      bottom: '-0.06em',
                      height: '0.1em',
                      left: 0,
                      position: 'absolute',
                      width: `${barProgress * 100}%`,
                    }}
                  />
                ) : null}
              </span>
            );
            return (
              <span key={`${word}-${index}`} style={{display: 'inline-block', marginRight: '0.26em', overflow: style === 'slide-up' ? 'hidden' : 'visible', paddingBottom: '0.12em'}}>
                {inner}
              </span>
            );
          })}
        </div>
        {subline ? (
          <div
            style={{
              color: brand.colors.muted,
              fontSize: type.title * 1.15,
              lineHeight: textMetrics.lineHeight.normal,
              marginTop: px(34),
              opacity: sublineProgress,
              transform: `translateY(${(1 - sublineProgress) * px(24)}px)`,
            }}
          >
            {subline}
          </div>
        ) : null}
      </div>
    </SceneFrame>
  );
};
