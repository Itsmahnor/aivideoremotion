import type {FC, ReactNode} from 'react';
import {Img} from 'remotion';
import type {FocusRegion} from '../../tokens/focus';
import {resolveAsset} from '../assets';
import {MockUI} from './MockUI';

type Props = {
  src?: string;
  width: number;
  height: number;
  region?: FocusRegion;
  /** 0..1: how far the camera has zoomed into `region` */
  zoomProgress?: number;
  /** 0..1: how dark the area outside `region` becomes */
  dim?: number;
  chartProgress?: number;
  highlight?: number;
  /** Drawn above the image, in screen coordinates (not zoomed) */
  children?: ReactNode;
};

export const getZoomScale = (region: FocusRegion): number => Math.min(2.5, Math.max(1.2, 0.8 / Math.max(region.w, region.h)));

/** Camera transform for zooming toward a region (translation is clamped so image edges never show). */
export const getZoomTransform = (region: FocusRegion | undefined, width: number, height: number, progress: number) => {
  const target = region ? getZoomScale(region) : 1;
  const scale = 1 + (target - 1) * progress;
  const cx = region ? region.x + region.w / 2 : 0.5;
  const cy = region ? region.y + region.h / 2 : 0.5;
  const maxX = ((scale - 1) * width) / 2;
  const maxY = ((scale - 1) * height) / 2;
  const tx = Math.max(-maxX, Math.min(maxX, -(cx - 0.5) * width * scale * progress));
  const ty = Math.max(-maxY, Math.min(maxY, -(cy - 0.5) * height * scale * progress));
  return {scale, tx, ty, centerX: width / 2 + scale * (cx - 0.5) * width + tx, centerY: height / 2 + scale * (cy - 0.5) * height + ty};
};

/** The inside of a device: a real screenshot, or a MockUI when none was provided. Supports zooming to a region. */
export const ScreenView: FC<Props> = ({src, width, height, region, zoomProgress = 0, dim = 0, chartProgress = 1, highlight = -1, children}) => {
  const {scale, tx, ty} = getZoomTransform(region, width, height, zoomProgress);

  return (
    <div style={{height, overflow: 'hidden', position: 'relative', width}}>
      <div style={{height: '100%', position: 'absolute', transform: `translate(${tx}px, ${ty}px) scale(${scale})`, transformOrigin: 'center center', width: '100%'}}>
        {src ? <Img src={resolveAsset(src)} style={{display: 'block', height: '100%', objectFit: 'cover', width: '100%'}} /> : <MockUI width={width} height={height} progress={chartProgress} highlight={highlight} />}
        {region && dim > 0 ? (
          <div
            style={{
              borderRadius: Math.min(width, height) * 0.012,
              boxShadow: `0 0 0 ${Math.max(width, height) * 2}px rgba(0, 0, 0, ${0.55 * dim})`,
              height: `${region.h * 100}%`,
              left: `${region.x * 100}%`,
              pointerEvents: 'none',
              position: 'absolute',
              top: `${region.y * 100}%`,
              width: `${region.w * 100}%`,
            }}
          />
        ) : null}
      </div>
      {children}
    </div>
  );
};
