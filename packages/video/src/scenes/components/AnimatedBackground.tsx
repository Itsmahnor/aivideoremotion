import type {FC} from 'react';
import {AbsoluteFill} from 'remotion';
import {withOpacity} from '../../tokens';
import {useSceneKit} from '../kit';

type Props = {variant?: 'gradient' | 'grid' | 'dots'};

/** Slow, frame-driven brand background. No randomness: every render looks identical. */
export const AnimatedBackground: FC<Props> = ({variant = 'gradient'}) => {
  const {brand, frame, px} = useSceneKit();
  const t = frame / 70;
  const x1 = 22 + 8 * Math.sin(t);
  const y1 = 25 + 8 * Math.cos(t * 0.9);
  const x2 = 80 + 7 * Math.cos(t * 0.8);
  const y2 = 78 + 8 * Math.sin(t * 0.7);
  const blobs = [
    `radial-gradient(circle at ${x1}% ${y1}%, ${withOpacity(brand.colors.primary, 0.3)} 0%, transparent 46%)`,
    `radial-gradient(circle at ${x2}% ${y2}%, ${withOpacity(brand.colors.secondary, 0.26)} 0%, transparent 44%)`,
  ].join(', ');
  const pattern =
    variant === 'grid'
      ? {
          backgroundImage: `linear-gradient(${withOpacity(brand.colors.text, 0.07)} 1px, transparent 1px), linear-gradient(90deg, ${withOpacity(brand.colors.text, 0.07)} 1px, transparent 1px)`,
          backgroundSize: `${px(72)}px ${px(72)}px`,
          backgroundPosition: `${frame * 0.25}px ${frame * 0.25}px`,
        }
      : variant === 'dots'
        ? {
            backgroundImage: `radial-gradient(${withOpacity(brand.colors.text, 0.14)} ${px(2)}px, transparent ${px(2)}px)`,
            backgroundSize: `${px(44)}px ${px(44)}px`,
            backgroundPosition: `${frame * 0.2}px 0px`,
          }
        : null;

  return (
    <AbsoluteFill style={{backgroundColor: brand.colors.background}}>
      <AbsoluteFill style={{backgroundImage: blobs}} />
      {pattern ? (
        <AbsoluteFill
          style={{
            ...pattern,
            WebkitMaskImage: 'radial-gradient(circle at 50% 50%, #000 0%, transparent 78%)',
            maskImage: 'radial-gradient(circle at 50% 50%, #000 0%, transparent 78%)',
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
