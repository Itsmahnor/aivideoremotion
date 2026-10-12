import type {FC} from 'react';
import type {z} from 'zod';
import {stepFlowProps} from '@ai-video-studio/schema';
import {interpolate} from 'remotion';
import {easingCurves, textMetrics, withOpacity} from '../tokens';
import {DeviceFrame, getFrameHeight, getScreenSize} from './components/DeviceFrame';
import {SceneFrame} from './components/SceneFrame';
import {ScreenView} from './components/ScreenView';
import {CheckIcon} from './icons';
import {useSceneKit} from './kit';

export type StepFlowProps = z.infer<typeof stepFlowProps>;

export const StepFlow: FC<StepFlowProps> = ({title, steps}) => {
  const {brand, type, layout, contentWidth, contentHeight, enter, frame, px, step, sceneDuration} = useSceneKit();
  const portrait = layout.isPortrait;
  const count = steps.length;
  const startFrame = 14;
  const perStep = Math.max(16, Math.floor((Math.max(sceneDuration, 90) - startFrame - 10) / count));
  const active = frame < startFrame ? -1 : Math.min(count - 1, Math.floor((frame - startFrame) / perStep));
  const node = px(portrait ? 64 : 72);
  const rowGap = px(portrait ? (count > 3 ? 26 : 38) : 40);
  const lineProgress = interpolate(frame, [startFrame, startFrame + perStep * count], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easingCurves.enter});

  const frameW = portrait ? contentWidth * 0.9 : contentWidth * 0.5;
  const frameH = getFrameHeight('browser', frameW);
  const screen = getScreenSize('browser', frameW, frameH);
  const activeStep = steps[Math.max(0, active)];
  const deviceP = enter(8, 'smooth');

  const list = (
    <div style={{display: 'flex', flex: portrait ? '0 0 auto' : '1 1 0', flexDirection: 'column', gap: px(22)}}>
      {title ? (
        <div style={{fontFamily: brand.fonts.heading, fontSize: type.display * (portrait ? 1.0 : 0.95), fontWeight: textMetrics.fontWeight.bold, letterSpacing: textMetrics.letterSpacing.tight, lineHeight: 1.05, marginBottom: px(10), opacity: enter(0), textAlign: portrait ? 'center' : 'left'}}>
          {title}
        </div>
      ) : null}
      <div style={{display: 'flex', flexDirection: 'column', gap: rowGap, position: 'relative'}}>
        <div style={{backgroundColor: withOpacity(brand.colors.text, 0.12), borderRadius: px(3), bottom: node / 2, left: node / 2 - px(2), position: 'absolute', top: node / 2, width: px(4)}} />
        <div style={{backgroundColor: brand.colors.primary, borderRadius: px(3), height: `calc((100% - ${node}px) * ${lineProgress})`, left: node / 2 - px(2), position: 'absolute', top: node / 2, width: px(4)}} />
        {steps.map((item, index) => {
          const p = enter(6 + index * step);
          const done = index < active;
          const isActive = index === active;
          return (
            <div key={`${item.label}-${index}`} style={{alignItems: 'center', display: 'flex', gap: px(26), opacity: (0.35 + 0.65 * (isActive || done ? 1 : 0.55)) * Math.min(1, p * 1.5), position: 'relative', transform: `translateX(${(1 - p) * -px(50)}px)`}}>
              <div
                style={{
                  alignItems: 'center',
                  backgroundColor: done || isActive ? brand.colors.primary : brand.colors.background,
                  border: `${px(3)}px solid ${done || isActive ? brand.colors.primary : withOpacity(brand.colors.text, 0.3)}`,
                  borderRadius: '50%',
                  boxShadow: isActive ? `0 0 0 ${px(9)}px ${withOpacity(brand.colors.primary, 0.2)}` : 'none',
                  color: done || isActive ? brand.colors.onPrimary : brand.colors.muted,
                  display: 'flex',
                  flex: '0 0 auto',
                  fontFamily: brand.fonts.heading,
                  fontSize: node * 0.42,
                  fontWeight: textMetrics.fontWeight.bold,
                  height: node,
                  justifyContent: 'center',
                  width: node,
                }}
              >
                {done ? <CheckIcon size={node * 0.5} color={brand.colors.onPrimary} /> : index + 1}
              </div>
              <div style={{display: 'flex', flexDirection: 'column', gap: px(4)}}>
                <div style={{fontFamily: brand.fonts.heading, fontSize: type.title * 1.1, fontWeight: isActive ? textMetrics.fontWeight.bold : textMetrics.fontWeight.semibold}}>{item.label}</div>
                {item.description ? <div style={{color: brand.colors.muted, fontSize: type.body * 1.05}}>{item.description}</div> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <SceneFrame background="grid">
      <div style={{alignItems: 'center', display: 'flex', flexDirection: portrait ? 'column' : 'row', gap: portrait ? px(40) : px(90), justifyContent: 'center', maxHeight: contentHeight, width: '100%'}}>
        {list}
        <div style={{flex: '0 0 auto', opacity: Math.min(1, deviceP * 1.5), transform: `translateY(${(1 - deviceP) * px(80)}px)`}}>
          <DeviceFrame variant="browser" width={frameW} height={frameH}>
            <ScreenView src={activeStep?.screenshotUrl} width={screen.width} height={screen.height} highlight={Math.max(0, active) % 3} chartProgress={interpolate(frame, [0, 70], [0, 1], {extrapolateRight: 'clamp'})} />
          </DeviceFrame>
        </div>
      </div>
    </SceneFrame>
  );
};
