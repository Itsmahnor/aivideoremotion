import type {FC} from 'react';
import {getTypeScale, textMetrics, useBrand, useLayout, withOpacity} from '../../tokens';

type Props = {text: string; style: 'clean' | 'bold' | 'highlight'};

export const CaptionBar: FC<Props> = ({text, style}) => {
  const brand = useBrand();
  const {width, height, safeArea} = useLayout();
  const size = getTypeScale(width, height).body;

  const look =
    style === 'bold'
      ? {backgroundColor: brand.colors.text, color: brand.colors.background, fontFamily: brand.fonts.heading, fontWeight: textMetrics.fontWeight.bold}
      : style === 'highlight'
        ? {backgroundColor: brand.colors.accent, color: brand.colors.onAccent, fontWeight: textMetrics.fontWeight.semibold}
        : {backgroundColor: withOpacity(brand.colors.background, 0.78), color: brand.colors.text, fontWeight: textMetrics.fontWeight.regular};

  return (
    <div style={{bottom: safeArea.bottom * 0.6, display: 'flex', justifyContent: 'center', left: 0, position: 'absolute', right: 0}}>
      <div
        style={{
          borderRadius: size * 0.8,
          fontFamily: brand.fonts.body,
          fontSize: size,
          lineHeight: textMetrics.lineHeight.normal,
          maxWidth: '86%',
          padding: `${size * 0.5}px ${size * 0.9}px`,
          textAlign: 'center',
          ...look,
        }}
      >
        {text}
      </div>
    </div>
  );
};