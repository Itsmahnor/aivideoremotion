import {useEffect, type FC} from 'react';
import {readableOn} from '../domain/color';
import type {ProjectConfig} from '../domain/schemas';
import {ensurePreviewFont, fontStack} from '../lib/fonts';

const RATIO: Record<ProjectConfig['video']['aspectRatio'], string> = {'16:9': '16 / 9', '9:16': '9 / 16', '1:1': '1 / 1'};

const assetSrc = (url: string) => (/^(https?:|data:|blob:)/.test(url) ? url : `/${url.replace(/^\//, '')}`);

/**
 * Instant, static mock-up of the chosen colors, gradient, fonts and format.
 * It is a style preview drawn with CSS, not a rendered frame of the video.
 */
export const StylePreview: FC<{config: ProjectConfig; fonts: readonly string[]}> = ({config, fonts}) => {
  const {brand, product, video} = config;
  useEffect(() => {
    ensurePreviewFont(brand.fonts.heading, fonts);
    ensurePreviewFont(brand.fonts.body, fonts);
  }, [brand.fonts.heading, brand.fonts.body, fonts]);

  const name = brand.name.trim() || product.productName.trim() || 'Your product';
  const headline = product.oneLiner.trim() || 'Your one-line description';
  const words = headline.split(' ');
  const accentIndex = Math.min(words.length - 1, 2);
  const background = brand.gradient.enabled ? `linear-gradient(${brand.gradient.angle}deg, ${brand.gradient.from}, ${brand.gradient.to})` : brand.colors.background;
  const textColor = brand.gradient.enabled ? readableOn(brand.gradient.from) : brand.colors.text;
  const vertical = video.aspectRatio === '9:16';

  return (
    <figure className="m-0">
      <div className="mx-auto flex items-center justify-center rounded-xl bg-sunken p-3 ring-1 ring-line" style={{maxWidth: vertical ? 260 : video.aspectRatio === '1:1' ? 360 : 560}}>
        <div
          className="relative flex w-full flex-col justify-between overflow-hidden rounded-lg p-[6%] shadow-card"
          style={{aspectRatio: RATIO[video.aspectRatio], background, color: textColor}}
          aria-hidden
        >
          <div className="flex items-center gap-2">
            {brand.logoUrl ? (
              <img src={assetSrc(brand.logoUrl)} alt="" className="h-5 max-w-[96px] object-contain" />
            ) : (
              <span className="text-[11px] font-bold tracking-tight" style={{fontFamily: fontStack(brand.fonts.heading)}}>
                {name}
              </span>
            )}
          </div>
          <div>
            <p className="font-bold leading-[1.1]" style={{fontFamily: fontStack(brand.fonts.heading), fontSize: vertical ? 22 : 'clamp(18px, 3.4vw, 30px)'}}>
              {words.map((word, i) => (
                <span key={`${word}-${i}`} style={i === accentIndex ? {color: brand.colors.accent} : undefined}>
                  {word}{' '}
                </span>
              ))}
            </p>
            <p className="mt-2 text-[12px] opacity-75" style={{fontFamily: fontStack(brand.fonts.body)}}>
              {product.problem.trim() ? `Problem: ${product.problem.trim().slice(0, 80)}` : 'Supporting text in your body font'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md px-3 py-1.5 text-[11px] font-semibold" style={{background: brand.colors.primary, color: readableOn(brand.colors.primary), fontFamily: fontStack(brand.fonts.body)}}>
              {product.cta.text.trim() || 'Call to action'}
            </span>
            <span className="h-1.5 w-8 rounded-full" style={{background: brand.colors.secondary}} />
          </div>
        </div>
      </div>
      <figcaption className="mt-2 text-center text-[12px] text-muted">
        Style preview · {video.aspectRatio} · {brand.fonts.heading} / {brand.fonts.body}. A rough mock-up, not a frame of the final video.
      </figcaption>
    </figure>
  );
};

export const PaletteStrip: FC<{colors: ProjectConfig['brand']['colors']}> = ({colors}) => (
  <div className="flex h-2 overflow-hidden rounded-full ring-1 ring-line" aria-hidden>
    {Object.entries(colors).map(([key, value]) => (
      <span key={key} className="flex-1" style={{background: value}} />
    ))}
  </div>
);
