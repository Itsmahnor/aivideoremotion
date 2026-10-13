import type {FC} from 'react';
import type {z} from 'zod';
import {customSceneProps} from '@ai-video-studio/schema';
import {Img, interpolate} from 'remotion';
import {easingCurves, textMetrics, withOpacity} from '../tokens';
import {resolveAsset} from './assets';
import {DeviceFrame, getFrameHeight, getScreenSize} from './components/DeviceFrame';
import {SceneFrame} from './components/SceneFrame';
import {ScreenView} from './components/ScreenView';
import {useSceneKit} from './kit';

export type CustomSceneProps = z.infer<typeof customSceneProps>;
type Layer = CustomSceneProps['layers'][number];

const motionFor = (kind: Layer['enter'], p: number, px: (value: number) => number): {opacity: number; transform: string} => {
  const fade = Math.min(1, p * 1.6);
  switch (kind) {
    case 'slide-up':
      return {opacity: fade, transform: `translateY(${(1 - p) * px(60)}px)`};
    case 'slide-left':
      return {opacity: fade, transform: `translateX(${-(1 - p) * px(90)}px)`};
    case 'slide-right':
      return {opacity: fade, transform: `translateX(${(1 - p) * px(90)}px)`};
    case 'pop':
      return {opacity: fade, transform: `scale(${0.6 + 0.4 * p})`};
    case 'none':
      return {opacity: 1, transform: 'none'};
    default:
      return {opacity: fade, transform: 'none'};
  }
};

/** Shrinks text until the estimated lines fit the box. Deterministic, no DOM measuring. */
const fitSize = (text: string, base: number, boxW: number, boxH: number): number => {
  let size = base;
  for (let i = 0; i < 10; i++) {
    const perLine = Math.max(1, Math.floor((boxW / (size * 0.55)) * 0.9));
    const lines = Math.ceil(text.length / perLine);
    if (lines * size * 1.15 <= boxH) break;
    size *= 0.88;
  }
  return Math.max(size, base * 0.45);
};

const justify = {left: 'flex-start', center: 'center', right: 'flex-end'} as const;

const LayerView: FC<{layer: Layer; width: number; height: number}> = ({layer, width, height}) => {
  const {brand, type, enter, frame, fps, px} = useSceneKit();
  const boxW = (layer.w / 100) * width;
  const boxH = (layer.h / 100) * height;
  const delayFrames = Math.round(layer.delaySec * fps);
  const p = layer.enter === 'none' ? 1 : enter(delayFrames, layer.enter === 'pop' ? 'bouncy' : undefined);
  const motion = motionFor(layer.enter, p, px);
  const color = brand.colors[layer.color];
  const heading = layer.size === 'title' || layer.size === 'headline' || layer.size === 'display';

  const base = {
    height: boxH,
    left: `${layer.x}%`,
    opacity: motion.opacity * layer.opacity,
    position: 'absolute' as const,
    top: `${layer.y}%`,
    transform: motion.transform,
    width: boxW,
  };

  const words = (text: string) => (
    <div style={{...base, alignItems: 'center', display: 'flex', justifyContent: justify[layer.align]}}>
      <div
        style={{
          color,
          fontFamily: heading ? brand.fonts.heading : brand.fonts.body,
          fontSize: fitSize(text, type[layer.size], boxW, boxH),
          fontWeight: heading ? textMetrics.fontWeight.bold : textMetrics.fontWeight.regular,
          letterSpacing: heading ? textMetrics.letterSpacing.tight : textMetrics.letterSpacing.normal,
          lineHeight: heading ? 1.08 : textMetrics.lineHeight.normal,
          textAlign: layer.align,
          width: '100%',
        }}
      >
        {text}
      </div>
    </div>
  );

  if (layer.type === 'text') return words(layer.text ?? '');

  if (layer.type === 'counter') {
    const progress = interpolate(frame, [delayFrames, delayFrames + 45], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easingCurves.enter});
    const format = (n: number) => `${layer.prefix ?? ''}${n.toFixed(layer.decimals)}${layer.suffix ?? ''}`;
    const finalLabel = format(layer.value ?? 0);
    // Size from the final number so the text does not jump while counting.
    return (
      <div style={{...base, alignItems: 'center', display: 'flex', justifyContent: justify[layer.align]}}>
        <div
          style={{
            color,
            fontFamily: brand.fonts.heading,
            fontSize: fitSize(finalLabel, type[layer.size], boxW, boxH),
            fontVariantNumeric: 'tabular-nums',
            fontWeight: textMetrics.fontWeight.bold,
            letterSpacing: textMetrics.letterSpacing.tight,
            lineHeight: 1,
            textAlign: layer.align,
            width: '100%',
          }}
        >
          {format((layer.value ?? 0) * progress)}
        </div>
      </div>
    );
  }

  if (layer.type === 'shape') {
    const radius = layer.shape === 'circle' ? '50%' : layer.shape === 'pill' ? boxH : px(24);
    return <div style={{...base, backgroundColor: color, borderRadius: radius}} />;
  }

  if (layer.type === 'image') {
    return layer.screenshotUrl ? (
      <Img src={resolveAsset(layer.screenshotUrl)} style={{...base, borderRadius: px(20), boxShadow: `0 ${px(14)}px ${px(40)}px ${withOpacity('#000000', 0.25)}`, objectFit: 'cover'}} />
    ) : (
      <div style={{...base, backgroundColor: withOpacity(brand.colors.text, 0.08), borderRadius: px(20)}} />
    );
  }

  // device
  const variant = layer.device;
  let frameW = variant === 'phone' ? Math.min(boxW, boxH / 2.05) : boxW;
  let frameH = getFrameHeight(variant, frameW);
  if (frameH > boxH) {
    frameW *= boxH / frameH;
    frameH = getFrameHeight(variant, frameW);
  }
  const screen = getScreenSize(variant, frameW, frameH);
  const chart = interpolate(frame, [delayFrames + 4, delayFrames + 60], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <div style={{...base, alignItems: 'center', display: 'flex', justifyContent: 'center'}}>
      <DeviceFrame variant={variant} width={frameW} height={frameH}>
        <ScreenView src={layer.screenshotUrl} width={screen.width} height={screen.height} chartProgress={chart} />
      </DeviceFrame>
    </div>
  );
};

/** Free layout from layers. Positions are percent of the safe area, so layers stay out of social-media UI zones. */
export const CustomScene: FC<CustomSceneProps> = ({background, layers}) => {
  const {contentWidth, contentHeight} = useSceneKit();
  return (
    <SceneFrame background={background}>
      <div style={{height: contentHeight, position: 'relative', width: contentWidth}}>
        {layers.map((layer, index) => (
          <LayerView key={index} layer={layer} width={contentWidth} height={contentHeight} />
        ))}
      </div>
    </SceneFrame>
  );
};