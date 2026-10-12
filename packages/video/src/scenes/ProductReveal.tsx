import type {FC} from 'react';
import type {z} from 'zod';
import {productRevealProps} from '@ai-video-studio/schema';
import {interpolate} from 'remotion';
import {easingCurves, textMetrics} from '../tokens';
import {DeviceFrame, getFrameHeight, getScreenSize} from './components/DeviceFrame';
import {Logo} from './components/Logo';
import {SceneFrame} from './components/SceneFrame';
import {ScreenView} from './components/ScreenView';
import {useSceneKit} from './kit';

export type ProductRevealProps = z.infer<typeof productRevealProps>;

export const ProductReveal: FC<ProductRevealProps> = ({productName, tagline, screenshotUrl, variant}) => {
  const {brand, type, layout, contentWidth, contentHeight, enter, frame, px, step} = useSceneKit();
  const portrait = layout.isPortrait;
  const logoP = enter(0);
  const nameP = enter(step + 4);
  const tagP = enter(step * 2 + 8);
  const deviceP = enter(26, 'smooth');
  const chart = interpolate(frame, [40, 110], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easingCurves.enter});

  const frameW = portrait ? contentWidth * 0.96 : contentWidth * 0.52;
  const frameH = getFrameHeight('browser', frameW);
  const screen = getScreenSize('browser', frameW, frameH);
  const deviceStyle =
    variant === 'zoom-out'
      ? {opacity: Math.min(1, deviceP * 1.4), transform: `scale(${1.35 - 0.35 * deviceP})`}
      : {opacity: Math.min(1, deviceP * 1.4), transform: `translateY(${(1 - deviceP) * px(160)}px)`};

  return (
    <SceneFrame background="grid">
      <div
        style={{
          alignItems: 'center',
          display: 'flex',
          flexDirection: portrait ? 'column' : 'row',
          gap: portrait ? px(56) : px(80),
          justifyContent: 'center',
          maxHeight: contentHeight,
          width: '100%',
        }}
      >
        <div style={{alignItems: portrait ? 'center' : 'flex-start', display: 'flex', flex: portrait ? '0 0 auto' : '1 1 0', flexDirection: 'column', gap: px(26), textAlign: portrait ? 'center' : 'left'}}>
          <div style={{opacity: logoP, transform: `translateY(${(1 - logoP) * px(20)}px) scale(${0.9 + 0.1 * logoP})`}}>
            <Logo height={px(portrait ? 64 : 58)} />
          </div>
          <div
            style={{
              fontFamily: brand.fonts.heading,
              fontSize: type.display * (portrait ? 1.25 : 1.35),
              fontWeight: textMetrics.fontWeight.bold,
              letterSpacing: textMetrics.letterSpacing.tight,
              lineHeight: 1.05,
              opacity: nameP,
              transform: `translateY(${(1 - nameP) * px(30)}px)`,
            }}
          >
            {productName}
          </div>
          <div style={{color: brand.colors.muted, fontSize: type.title * 1.1, lineHeight: textMetrics.lineHeight.normal, maxWidth: portrait ? '100%' : '92%', opacity: tagP, transform: `translateY(${(1 - tagP) * px(24)}px)`}}>
            {tagline}
          </div>
        </div>
        <div style={{flex: '0 0 auto', ...deviceStyle}}>
          <DeviceFrame variant="browser" width={frameW} height={frameH}>
            <ScreenView src={screenshotUrl} width={screen.width} height={screen.height} chartProgress={chart} />
          </DeviceFrame>
        </div>
      </div>
    </SceneFrame>
  );
};
