import type {FC} from 'react';
import {AbsoluteFill} from 'remotion';
import lightBrandKit from '@ai-video-studio/schema/fixtures/brand-kit.json';
import darkBrandKit from '@ai-video-studio/schema/fixtures/brand-kit-dark.json';
import {brandKitSchema, type TemplateName} from '@ai-video-studio/schema';
import {sceneRegistry} from './scenes/registry';
import {BrandThemeProvider} from './tokens';

export const harnessBrands = {
  light: brandKitSchema.parse(lightBrandKit),
  dark: brandKitSchema.parse(darkBrandKit),
};

export type SceneHarnessProps = {
  template: TemplateName;
  brand: 'light' | 'dark';
  props: Record<string, unknown>;
};

/** Studio-only wrapper: plays ONE template with one of the two fixture brands. */
export const SceneHarness: FC<SceneHarnessProps> = ({template, brand, props}) => {
  const Template = sceneRegistry[template].component;
  return (
    <BrandThemeProvider brand={harnessBrands[brand]}>
      <AbsoluteFill style={{backgroundColor: harnessBrands[brand].colors.background}}>
        <Template {...props} />
      </AbsoluteFill>
    </BrandThemeProvider>
  );
};
