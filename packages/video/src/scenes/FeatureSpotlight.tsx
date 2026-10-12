import type {FC} from 'react';
import type {z} from 'zod';
import {featureSpotlightProps} from '@ai-video-studio/schema';
import {interpolate} from 'remotion';
import {easingCurves, textMetrics, withOpacity} from '../tokens';
import {DeviceFrame, getFrameHeight, getScreenSize} from './components/DeviceFrame';
import {SceneFrame} from './components/SceneFrame';
import {ScreenView} from './components/ScreenView';
import {Icon} from './icons';
import {useSceneKit} from './kit';

export type FeatureSpotlightProps = z.infer<typeof featureSpotlightProps>;

export const FeatureSpotlight: FC<FeatureSpotlightProps> = ({icon, title, description, screenshotUrl, layout}) => {
  const {brand, type, layout: videoLayout, contentWidth, contentHeight, enter, frame, px, step, sceneDuration} = useSceneKit();
  const stacked = layout === 'stacked' || videoLayout.isPortrait;
  const iconP = enter(0, 'bouncy');
  const titleP = enter(step + 2);
  const descP = enter(step * 2 + 6);
  const deviceP = enter(14, 'smooth');
  const drift = interpolate(frame, [0, Math.max(60, sceneDuration)], [1, 1.035], {extrapolateRight: 'clamp', easing: easingCurves.enter});
  const sideSign = layout === 'left' ? -1 : 1;

  const frameW = stacked ? contentWidth * (videoLayout.isPortrait ? 0.92 : 0.6) : contentWidth * 0.47;
  const frameH = getFrameHeight('browser', frameW);
  const screen = getScreenSize('browser', frameW, frameH);

  const text = (
    <div style={{display: 'flex', flex: stacked ? '0 0 auto' : '1 1 0', flexDirection: 'column', gap: px(24), textAlign: stacked ? 'center' : 'left', alignItems: stacked ? 'center' : 'flex-start'}}>
      <div
        style={{
          alignItems: 'center',
          backgroundColor: brand.colors.accent,
          borderRadius: px(26),
          boxShadow: `0 ${px(14)}px ${px(36)}px ${withOpacity(brand.colors.accent, 0.4)}`,
          display: 'flex',
          height: px(96),
          justifyContent: 'center',
          opacity: Math.min(1, iconP * 1.5),
          transform: `scale(${0.4 + 0.6 * iconP})`,
          width: px(96),
        }}
      >
        <Icon name={icon} size={px(52)} color={brand.colors.onAccent} />
      </div>
      <div style={{fontFamily: brand.fonts.heading, fontSize: type.display * 1.1, fontWeight: textMetrics.fontWeight.bold, letterSpacing: textMetrics.letterSpacing.tight, lineHeight: 1.05, opacity: titleP, transform: `translateY(${(1 - titleP) * px(26)}px)`}}>
        {title}
      </div>
      <div style={{color: brand.colors.muted, fontSize: type.title * 1.05, lineHeight: textMetrics.lineHeight.normal, maxWidth: stacked ? '90%' : '95%', opacity: descP, transform: `translateY(${(1 - descP) * px(20)}px)`}}>
        {description}
      </div>
    </div>
  );

  const device = (
    <div style={{flex: '0 0 auto', opacity: Math.min(1, deviceP * 1.5), transform: `translateX(${stacked ? 0 : sideSign * (1 - deviceP) * px(140)}px) translateY(${stacked ? (1 - deviceP) * px(120) : 0}px) scale(${drift})`}}>
      <DeviceFrame variant="browser" width={frameW} height={frameH}>
        <ScreenView src={screenshotUrl} width={screen.width} height={screen.height} highlight={1} />
      </DeviceFrame>
    </div>
  );

  return (
    <SceneFrame background="dots">
      <div
        style={{
          alignItems: 'center',
          display: 'flex',
          flexDirection: stacked ? 'column' : layout === 'left' ? 'row-reverse' : 'row',
          gap: stacked ? px(48) : px(80),
          justifyContent: 'center',
          maxHeight: contentHeight,
          width: '100%',
        }}
      >
        {text}
        {device}
      </div>
    </SceneFrame>
  );
};
