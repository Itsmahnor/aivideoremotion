import {describe, expect, it} from 'vitest';
import {contrastRatio, hexToRgb, normalizeHex, paletteWarnings, parseRgbString, rgbToHex} from './color';

describe('custom color input', () => {
  it('accepts any valid HEX in short or long form and normalizes it', () => {
    expect(normalizeHex('#abc')).toBe('#AABBCC');
    expect(normalizeHex('abc')).toBe('#AABBCC');
    expect(normalizeHex(' #4f46e5 ')).toBe('#4F46E5');
    expect(normalizeHex('12FA9c')).toBe('#12FA9C');
  });

  it('rejects malformed HEX', () => {
    for (const bad of ['', '#', '#12', '#12345', '#1234567', '#GGGGGG', 'red', '#12 456']) expect(normalizeHex(bad)).toBeNull();
  });

  it('converts RGB to HEX and back, and validates channels', () => {
    expect(rgbToHex({r: 79, g: 70, b: 229})).toBe('#4F46E5');
    expect(hexToRgb('#4F46E5')).toEqual({r: 79, g: 70, b: 229});
    expect(rgbToHex({r: 256, g: 0, b: 0})).toBeNull();
    expect(rgbToHex({r: -1, g: 0, b: 0})).toBeNull();
    expect(rgbToHex({r: 1.5, g: 0, b: 0})).toBeNull();
  });

  it('parses typed RGB strings', () => {
    expect(parseRgbString('rgb(255, 0, 128)')).toBe('#FF0080');
    expect(parseRgbString('10 20 30')).toBe('#0A141E');
    expect(parseRgbString('300, 0, 0')).toBeNull();
    expect(parseRgbString('a, b, c')).toBeNull();
  });
});

describe('contrast warnings', () => {
  it('computes WCAG contrast', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it('does not warn about a readable palette', () => {
    expect(paletteWarnings({primary: '#4F46E5', secondary: '#0EA5E9', accent: '#B45309', background: '#FFFFFF', text: '#0F172A'})).toEqual([]);
  });

  it('warns (but does not block) when text is hard to read', () => {
    const warnings = paletteWarnings({primary: '#FFFF00', secondary: '#FFFF00', accent: '#FFFFAA', background: '#FFFFFF', text: '#DDDDDD'});
    const ids = warnings.map((w) => w.id);
    expect(ids).toContain('text-bg');
    expect(ids).toContain('primary-bg');
    expect(ids).toContain('accent-bg');
    expect(ids).toContain('same');
    expect(warnings.find((w) => w.id === 'text-bg')?.level).toBe('danger');
  });
});
