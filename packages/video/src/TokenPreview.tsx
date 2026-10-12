import lightBrandKitFixture from '@ai-video-studio/schema/fixtures/brand-kit.json';
import darkBrandKitFixture from '@ai-video-studio/schema/fixtures/brand-kit-dark.json';
import {brandKitSchema, type BrandKit} from '@ai-video-studio/schema';
import type {FC} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {
  BrandThemeProvider,
  contrastMinimum,
  enterProgress,
  fitFontSize,
  getContrastRatio,
  getReadableTextColor,
  getTypeScale,
  percentageScale,
  previewLayoutTokens,
  springPresets,
  staggerDelay,
  staggerPresets,
  standardDurations,
  textMetrics,
  useBrand,
  useLayout,
} from './tokens';

export const tokenPreviewPropsSchema = brandKitSchema;
export type TokenPreviewProps = BrandKit;

export const previewBrands = {
  light: brandKitSchema.parse(lightBrandKitFixture),
  dark: brandKitSchema.parse(darkBrandKitFixture),
};

export const tokenPreviewDurationInFrames = standardDurations.hold * previewLayoutTokens.springDemoCount;

const colorNames = ['primary', 'secondary', 'accent', 'background', 'text'] as const;
const typeNames = ['display', 'headline', 'title', 'body', 'caption'] as const;
const springNames = Object.keys(springPresets) as Array<keyof typeof springPresets>;

const TokenPreviewContent: FC = () => {
  const brand = useBrand();
  const {fps} = useVideoConfig();
  const frame = useCurrentFrame();
  const {height, safeArea, spacing, width} = useLayout();
  const typeScale = getTypeScale(width, height);
  const contentWidth = width - safeArea.left - safeArea.right;
  const contentHeight = height - safeArea.top - safeArea.bottom;
  const headingSize = fitFontSize('Design tokens', contentWidth, typeScale.display, brand.fonts.heading);
  const springColors = [brand.colors.primary, brand.colors.secondary, brand.colors.accent];

  return (
    <main
      style={{
        backgroundColor: brand.colors.background,
        color: brand.colors.text,
        fontFamily: brand.fonts.body,
        height: '100%',
        padding: `${safeArea.top}px ${safeArea.right}px ${safeArea.bottom}px ${safeArea.left}px`,
        width: '100%',
      }}
    >
      <div style={{display: 'flex', flexDirection: 'column', gap: spacing.lg, height: contentHeight}}>
        <header>
          <div
            style={{
              fontFamily: brand.fonts.heading,
              fontSize: headingSize,
              fontWeight: textMetrics.fontWeight.bold,
              letterSpacing: textMetrics.letterSpacing.tight,
              lineHeight: textMetrics.lineHeight.tight,
            }}
          >
            {`${brand.name} tokens`}
          </div>
        </header>

        <section style={{display: 'flex', flexWrap: 'wrap', gap: spacing.sm}}>
          {colorNames.map((name) => {
            const color = brand.colors[name];
            const labelColor = getReadableTextColor(color, brand.colors.text);
            const contrastPasses = getContrastRatio(color, labelColor) >= contrastMinimum;
            return (
              <div
                key={name}
                style={{
                  backgroundColor: color,
                  borderColor: brand.colors.muted,
                  borderRadius: spacing.sm * previewLayoutTokens.cardRadiusMultiplier,
                  borderStyle: 'solid',
                  borderWidth: previewLayoutTokens.borderWidth,
                  color: labelColor,
                  flex: `${previewLayoutTokens.sectionGapMultiplier} ${previewLayoutTokens.sectionGapMultiplier} ${spacing.sm * previewLayoutTokens.swatchMinWidthMultiplier}px`,
                  fontSize: typeScale.caption,
                  padding: spacing.sm,
                }}
              >
                {contrastPasses ? '✓ ' : ''}{name}
              </div>
            );
          })}
        </section>

        <section style={{display: 'flex', flexDirection: 'column', gap: spacing.xs}}>
          {typeNames.map((name) => (
            <div
              key={name}
              style={{
                fontFamily: name === 'body' || name === 'caption' ? brand.fonts.body : brand.fonts.heading,
                fontSize: typeScale[name],
                fontWeight: name === 'body' || name === 'caption' ? textMetrics.fontWeight.regular : textMetrics.fontWeight.semibold,
                letterSpacing: name === 'display' ? textMetrics.letterSpacing.tight : textMetrics.letterSpacing.normal,
                lineHeight: name === 'display' ? textMetrics.lineHeight.tight : textMetrics.lineHeight.normal,
              }}
            >
              {name} type scale
            </div>
          ))}
        </section>

        <section style={{display: 'flex', gap: spacing.xs}}>
          {Object.entries(spacing).map(([name, value]) => (
            <div key={name} style={{display: 'flex', flex: previewLayoutTokens.sectionGapMultiplier, flexDirection: 'column', gap: spacing.xs}}>
              <div style={{backgroundColor: brand.colors.secondary, height: value}} />
              <span style={{fontSize: typeScale.caption}}>{name}</span>
            </div>
          ))}
        </section>

        <section style={{display: 'flex', flexDirection: 'column', gap: spacing.sm}}>
          {springNames.map((preset, index) => {
            const progress = enterProgress({
              frame,
              fps,
              delay: staggerDelay(index, staggerPresets[brand.motion.staggerPreset]),
              preset,
            });
            return (
              <div key={preset} style={{fontSize: typeScale.caption}}>
                <div>{preset}</div>
                <div style={{backgroundColor: brand.colors.muted, height: spacing.xs}}>
                  <div
                    style={{
                      backgroundColor: springColors[index]!,
                      height: spacing.xs,
                      transform: `translateX(${progress * spacing.xxl}px)`,
                      width: `${progress * percentageScale}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
};

export const TokenPreview: FC<TokenPreviewProps> = (brand) => (
  <BrandThemeProvider brand={brand}>
    <TokenPreviewContent />
  </BrandThemeProvider>
);
