import {describe, expect, it} from 'vitest';
import {colorFallbacks, getContrastRatio, getReadableTextColor, withOpacity} from './color';
import {aspectRatioConfigs, getSpacing} from './layout';
import {motionStyleMap, staggerDelay, staggerPresets} from './motion';

describe('design tokens', () => {
  it('calculates contrast and readable fallback colors', () => {
    expect(getContrastRatio(colorFallbacks.light, colorFallbacks.dark)).toBeGreaterThanOrEqual(21);
    expect(getReadableTextColor(colorFallbacks.light, colorFallbacks.light)).toBe(colorFallbacks.dark);
    expect(withOpacity('#123456', 0.5)).toBe('rgba(18, 52, 86, 0.5)');
  });

  it('calculates stagger delays from named presets', () => {
    expect(staggerDelay(3, staggerPresets.normal)).toBe(24);
  });

  it('defines social-safe portrait zones and scaled spacing', () => {
    expect(aspectRatioConfigs['9:16'].safeZone).toEqual({top: 0.14, bottom: 0.2, horizontal: 0.06});
    expect(getSpacing(1080, 1920).md).toBe(24);
  });

  it('maps every brand motion style to the expected token settings', () => {
    expect(motionStyleMap.calm).toMatchObject({springPreset: 'smooth', staggerPreset: 'slow'});
    expect(motionStyleMap.energetic).toMatchObject({springPreset: 'snappy', staggerPreset: 'fast'});
    expect(motionStyleMap.playful.springPreset).toBe('bouncy');
    expect(motionStyleMap.corporate).toMatchObject({springPreset: 'smooth', staggerPreset: 'normal'});
  });
});
