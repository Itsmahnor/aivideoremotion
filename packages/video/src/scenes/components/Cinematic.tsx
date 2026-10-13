import type {FC, ReactNode} from 'react';
import {AbsoluteFill, interpolate} from 'remotion';
import {easingCurves, withOpacity} from '../../tokens';
import {useSceneKit} from '../kit';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** Soft light that drifts slowly across the scene. */
export const LightLeak: FC = () => {
  const {brand, frame} = useSceneKit();
  const x = 50 + 30 * Math.sin(frame / 90);
  const y = 22 + 10 * Math.cos(frame / 70);
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at ${x}% ${y}%, ${withOpacity(brand.colors.accent, 0.16)} 0%, transparent 45%)`,
        mixBlendMode: 'screen',
        pointerEvents: 'none',
      }}
    />
  );
};

/** Darker edges focus the eye on the center. */
export const Vignette: FC<{strength?: number}> = ({strength = 0.5}) => (
  <AbsoluteFill style={{background: `radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,${strength}) 100%)`, pointerEvents: 'none'}} />
);

/** Static film grain. The noise does not move, so every render is identical. */
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")";
export const Grain: FC<{opacity?: number}> = ({opacity = 0.05}) => (
  <AbsoluteFill style={{backgroundImage: GRAIN, opacity, pointerEvents: 'none'}} />
);

/** Each line rises out of a hidden mask, so text feels designed instead of just faded in. */
export const MaskText: FC<{delay?: number; children: ReactNode}> = ({delay = 0, children}) => {
  const {enter} = useSceneKit();
  const p = enter(delay, 'smooth');
  return (
    <div style={{overflow: 'hidden', paddingBottom: '0.14em'}}>
      <div style={{transform: `translateY(${(1 - p) * 110}%)`}}>{children}</div>
    </div>
  );
};

/** Blurred color glow that sits behind a device or icon. */
export const Glow: FC<{color?: string; size?: number; opacity?: number}> = ({color, size = 1.25, opacity = 0.45}) => {
  const {brand, frame} = useSceneKit();
  const pulse = 1 + 0.05 * Math.sin(frame / 30);
  return (
    <div
      style={{
        background: `radial-gradient(circle, ${withOpacity(color ?? brand.colors.primary, opacity)} 0%, transparent 65%)`,
        height: `${size * 100}%`,
        left: `${(1 - size) * 50}%`,
        pointerEvents: 'none',
        position: 'absolute',
        top: `${(1 - size) * 50}%`,
        transform: `scale(${pulse})`,
        width: `${size * 100}%`,
        zIndex: -1,
      }}
    />
  );
};

/** One bright diagonal sweep across a device, like light catching glass. */
export const Sheen: FC<{start?: number; radius: number}> = ({start = 30, radius}) => {
  const {frame} = useSceneKit();
  const x = interpolate(frame, [start, start + 45], [-40, 140], {...clamp, easing: easingCurves.enter});
  return (
    <div style={{borderRadius: radius, inset: 0, overflow: 'hidden', pointerEvents: 'none', position: 'absolute'}}>
      <div
        style={{
          background: 'linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.22) 50%, transparent 100%)',
          height: '100%',
          left: `${x}%`,
          position: 'absolute',
          top: 0,
          transform: 'skewX(-12deg)',
          width: '30%',
        }}
      />
    </div>
  );
};