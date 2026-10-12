import type {FC, ReactNode} from 'react';
import {withOpacity} from '../../tokens';
import {useSceneKit} from '../kit';

export type DeviceVariant = 'browser' | 'phone' | 'none';

const chromeHeight = (variant: DeviceVariant, width: number): number => (variant === 'browser' ? Math.max(28, width * 0.035) : 0);
const phoneInset = (width: number): number => Math.max(8, width * 0.035);

/** Size of the screen area inside a frame of the given outer size. */
export const getScreenSize = (variant: DeviceVariant, width: number, height: number): {width: number; height: number} => {
  if (variant === 'browser') return {width, height: height - chromeHeight(variant, width)};
  if (variant === 'phone') return {width: width - phoneInset(width) * 2, height: height - phoneInset(width) * 2};
  return {width, height};
};

/** Outer height for a given width, so screens keep a natural aspect ratio. */
export const getFrameHeight = (variant: DeviceVariant, width: number, ratio = 0.625): number => {
  if (variant === 'phone') return width * 2.05;
  if (variant === 'browser') return width * ratio + chromeHeight(variant, width);
  return width * ratio;
};

type Props = {variant: DeviceVariant; width: number; height: number; children: ReactNode};

export const DeviceFrame: FC<Props> = ({variant, width, height, children}) => {
  const {brand} = useSceneKit();
  const border = withOpacity(brand.colors.text, 0.14);
  const shadow = `0 ${width * 0.04}px ${width * 0.1}px ${withOpacity('#000000', 0.28)}`;

  if (variant === 'none') {
    return (
      <div style={{borderRadius: width * 0.015, boxShadow: shadow, height, overflow: 'hidden', width}}>{children}</div>
    );
  }

  if (variant === 'phone') {
    const inset = phoneInset(width);
    return (
      <div
        style={{
          backgroundColor: brand.colors.text,
          borderRadius: width * 0.13,
          boxShadow: shadow,
          boxSizing: 'border-box',
          height,
          padding: inset,
          width,
        }}
      >
        <div style={{borderRadius: width * 0.1, height: '100%', overflow: 'hidden', position: 'relative', width: '100%'}}>{children}</div>
      </div>
    );
  }

  const bar = chromeHeight(variant, width);
  return (
    <div
      style={{
        backgroundColor: brand.colors.surface,
        border: `1px solid ${border}`,
        borderRadius: width * 0.016,
        boxShadow: shadow,
        boxSizing: 'border-box',
        height,
        overflow: 'hidden',
        width,
      }}
    >
      <div style={{alignItems: 'center', backgroundColor: withOpacity(brand.colors.text, 0.06), display: 'flex', gap: bar * 0.3, height: bar, padding: `0 ${bar * 0.5}px`}}>
        {[brand.colors.accent, brand.colors.secondary, brand.colors.primary].map((color) => (
          <span key={color} style={{backgroundColor: color, borderRadius: '50%', display: 'inline-block', height: bar * 0.26, opacity: 0.85, width: bar * 0.26}} />
        ))}
        <span style={{backgroundColor: withOpacity(brand.colors.text, 0.08), borderRadius: bar, height: bar * 0.5, marginLeft: bar * 0.5, width: width * 0.32}} />
      </div>
      <div style={{height: height - bar, position: 'relative', width}}>{children}</div>
    </div>
  );
};
