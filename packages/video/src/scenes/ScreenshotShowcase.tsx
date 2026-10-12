import type {FC} from 'react';
import type {z} from 'zod';
import {screenshotShowcaseProps} from '@ai-video-studio/schema';
import {interpolate} from 'remotion';
import {easingCurves, textMetrics, withOpacity} from '../tokens';
import type {FocusRegion} from '../tokens/focus';
import {DeviceFrame, getFrameHeight, getScreenSize} from './components/DeviceFrame';
import {SceneFrame} from './components/SceneFrame';
import {getZoomTransform, ScreenView} from './components/ScreenView';
import {useSceneKit} from './kit';

export type ScreenshotShowcaseProps = z.infer<typeof screenshotShowcaseProps>;

/** Used when no region is given: the upper-middle of the screen (the stat cards in MockUI). */
const defaultRegion: FocusRegion = {x: 0.22, y: 0.14, w: 0.62, h: 0.22};

const clamp01 = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

export const ScreenshotShowcase: FC<ScreenshotShowcaseProps> = ({screenshotUrl, focusRegion, caption, callout, showCursor, device}) => {
  const {brand, type, layout, contentWidth, contentHeight, enter, frame, px} = useSceneKit();
  const portrait = layout.isPortrait;
  const region = focusRegion ?? defaultRegion;
  const frameP = enter(0, 'smooth');
  const captionP = enter(8);
  const zoomP = interpolate(frame, [14, 48], [0, 1], {...clamp01, easing: easingCurves.enter});
  const calloutP = enter(46);
  const cursorP = interpolate(frame, [22, 58], [0, 1], {...clamp01, easing: easingCurves.enter});
  const clickFrame = frame - 60;
  const chart = interpolate(frame, [4, 60], [0, 1], clamp01);

  const variant = device;
  const frameW = variant === 'phone' ? contentHeight * 0.42 : portrait ? contentWidth * 0.98 : contentWidth * 0.74;
  const frameH = getFrameHeight(variant, frameW);
  const screen = getScreenSize(variant, frameW, frameH);
  // Where the region ends up on screen once the zoom has finished. Overlays use this geometry.
  const final = getZoomTransform(region, screen.width, screen.height, 1);
  const centerX = final.centerX;
  const centerY = final.centerY;
  const halfW = (region.w * screen.width * final.scale) / 2;
  const halfH = (region.h * screen.height * final.scale) / 2;
  const side = callout?.position === 'auto' || !callout ? (centerX <= screen.width / 2 ? 'right' : 'left') : callout.position;
  const labelSize = type.caption * 1.25;
  const labelW = (callout ? callout.label.length * labelSize * 0.62 : 0) + labelSize * 1.6;
  const labelH = labelSize * 2.1;
  const gap = px(46);
  const anchor =
    side === 'right'
      ? {x: centerX + halfW, y: centerY, lx: centerX + halfW + gap, ly: centerY - labelH / 2}
      : side === 'left'
        ? {x: centerX - halfW, y: centerY, lx: centerX - halfW - gap - labelW, ly: centerY - labelH / 2}
        : side === 'top'
          ? {x: centerX, y: centerY - halfH, lx: centerX - labelW / 2, ly: centerY - halfH - gap - labelH}
          : {x: centerX, y: centerY + halfH, lx: centerX - labelW / 2, ly: centerY + halfH + gap};
  const lineEndX = side === 'right' ? anchor.lx : side === 'left' ? anchor.lx + labelW : anchor.lx + labelW / 2;
  const lineEndY = side === 'top' ? anchor.ly + labelH : side === 'bottom' ? anchor.ly : anchor.ly + labelH / 2;

  const cursorX = screen.width * 0.9 + (centerX + px(10) - screen.width * 0.9) * cursorP;
  const cursorY = screen.height * 0.95 + (centerY + px(10) - screen.height * 0.95) * cursorP;
  const ripple = interpolate(clickFrame, [0, 22], [0, 1], clamp01);
  const cursorSize = px(34);

  return (
    <SceneFrame background="gradient">
      <div style={{alignItems: 'center', display: 'flex', flexDirection: 'column', gap: px(40), width: '100%'}}>
        <div style={{opacity: Math.min(1, frameP * 1.5), transform: `translateY(${(1 - frameP) * px(80)}px) scale(${0.94 + 0.06 * frameP})`}}>
          <DeviceFrame variant={variant} width={frameW} height={frameH}>
            <ScreenView src={screenshotUrl} width={screen.width} height={screen.height} region={region} zoomProgress={zoomP} dim={zoomP} chartProgress={chart}>
              {callout && calloutP > 0.01 ? (
                <>
                  <svg style={{height: '100%', left: 0, overflow: 'visible', pointerEvents: 'none', position: 'absolute', top: 0, width: '100%'}}>
                    <line x1={anchor.x} y1={anchor.y} x2={anchor.x + (lineEndX - anchor.x) * calloutP} y2={anchor.y + (lineEndY - anchor.y) * calloutP} stroke={brand.colors.accent} strokeLinecap="round" strokeWidth={px(4)} />
                  </svg>
                  <div
                    style={{
                      alignItems: 'center',
                      backgroundColor: brand.colors.accent,
                      borderRadius: labelH,
                      boxShadow: `0 ${px(8)}px ${px(24)}px ${withOpacity('#000000', 0.3)}`,
                      color: brand.colors.onAccent,
                      display: 'flex',
                      fontSize: labelSize,
                      fontWeight: textMetrics.fontWeight.bold,
                      height: labelH,
                      justifyContent: 'center',
                      left: anchor.lx,
                      opacity: calloutP,
                      position: 'absolute',
                      top: anchor.ly,
                      transform: `scale(${0.8 + 0.2 * calloutP})`,
                      whiteSpace: 'nowrap',
                      width: labelW,
                    }}
                  >
                    {callout.label}
                  </div>
                </>
              ) : null}
              {showCursor && cursorP > 0.01 ? (
                <>
                  {clickFrame >= 0 && clickFrame < 22 ? (
                    <div style={{border: `${px(4)}px solid ${brand.colors.accent}`, borderRadius: '50%', height: cursorSize * 2.4, left: cursorX - cursorSize * 1.2, opacity: 1 - ripple, position: 'absolute', top: cursorY - cursorSize * 1.2, transform: `scale(${0.3 + ripple})`, width: cursorSize * 2.4}} />
                  ) : null}
                  <svg width={cursorSize} height={cursorSize * 1.25} viewBox="0 0 24 30" style={{filter: `drop-shadow(0 ${px(4)}px ${px(6)}px rgba(0,0,0,0.4))`, left: cursorX, position: 'absolute', top: cursorY, transform: `scale(${clickFrame >= 0 && clickFrame < 6 ? 0.85 : 1})`}}>
                    <path d="M2 2l18 11-8 2.2 4.6 8.8-3.6 1.8-4.6-8.8L2 22z" fill="#FFFFFF" stroke="#111827" strokeLinejoin="round" strokeWidth={2} />
                  </svg>
                </>
              ) : null}
            </ScreenView>
          </DeviceFrame>
        </div>
        <div
          style={{
            backgroundColor: brand.colors.primary,
            borderRadius: px(60),
            boxShadow: `0 ${px(12)}px ${px(30)}px ${withOpacity(brand.colors.primary, 0.35)}`,
            color: brand.colors.onPrimary,
            fontFamily: brand.fonts.heading,
            fontSize: type.title * 1.1,
            fontWeight: textMetrics.fontWeight.semibold,
            maxWidth: '92%',
            opacity: captionP,
            padding: `${px(20)}px ${px(44)}px`,
            textAlign: 'center',
            transform: `translateY(${(1 - captionP) * px(30)}px)`,
          }}
        >
          {caption}
        </div>
      </div>
    </SceneFrame>
  );
};
