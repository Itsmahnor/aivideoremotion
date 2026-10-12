import {Composition} from 'remotion';
import {z} from 'zod';
import sceneJsonFixture from '@ai-video-studio/schema/fixtures/scene-json.json';
import {loadFont} from '@remotion/google-fonts/Inter';
import {brandKitSchema, TEMPLATE_NAMES, TEMPLATE_PROPS, testCompositionSchema} from '@ai-video-studio/schema';
import type {FC} from 'react';
import {calculateDynamicVideoMetadata, DynamicVideo, type DynamicVideoProps} from './compositions/DynamicVideo';
import {playgroundEntries} from './fixtures/playground';
import {sceneRegistry} from './scenes/registry';
import {harnessBrands, SceneHarness} from './SceneHarness';
import {TestComposition} from './TestComposition';
import {TokenPreview, previewBrands, tokenPreviewDurationInFrames, tokenPreviewPropsSchema} from './TokenPreview';
import {aspectRatioConfigs, standardFps} from './tokens';

const {fontFamily} = loadFont();

const defaultProps = {
  title: 'Test composition',
  theme: {
    colors: {background: '#111827', foreground: '#f9fafb'},
    fonts: {body: fontFamily},
  },
};

export const RemotionRoot: FC = () => {
  return (
    <>
      <Composition
        id="TestComposition"
        component={TestComposition}
        durationInFrames={150}
        fps={30}
        width={1280}
        height={720}
        defaultProps={defaultProps}
        schema={testCompositionSchema}
      />
      {TEMPLATE_NAMES.flatMap((template) =>
        (['16:9', '9:16'] as const).map((ratio) => (
          <Composition
            key={`${template}-${ratio}`}
            id={`Scene-${template}-${ratio === '16:9' ? '16x9' : '9x16'}`}
            component={SceneHarness}
            durationInFrames={sceneRegistry[template].defaultDurationInFrames}
            fps={standardFps}
            width={aspectRatioConfigs[ratio].width}
            height={aspectRatioConfigs[ratio].height}
            schema={z.object({
              template: z.literal(template),
              brand: z.enum(['light', 'dark']),
              props: TEMPLATE_PROPS[template] as z.ZodType<Record<string, unknown>>,
            })}
            defaultProps={{template, brand: 'light' as const, props: sceneRegistry[template].sampleProps}}
          />
        )),
      )}
      <Composition
        id="DynamicVideo-Fixture"
        component={DynamicVideo}
        durationInFrames={1}
        fps={standardFps}
        width={1920}
        height={1080}
        calculateMetadata={calculateDynamicVideoMetadata}
        defaultProps={{sceneJson: sceneJsonFixture, brand: harnessBrands.light} satisfies DynamicVideoProps}
      />
      {playgroundEntries.map((entry) => (
        <Composition
          key={entry.id}
          id={`Playground-${entry.id}`}
          component={DynamicVideo}
          durationInFrames={1}
          fps={standardFps}
          width={1920}
          height={1080}
          calculateMetadata={calculateDynamicVideoMetadata}
          defaultProps={{sceneJson: entry.sceneJson, brand: entry.brand} satisfies DynamicVideoProps}
        />
      ))}
      <Composition
        id="TokenPreview9x16"
        component={TokenPreview}
        durationInFrames={tokenPreviewDurationInFrames}
        fps={standardFps}
        width={aspectRatioConfigs['9:16'].width}
        height={aspectRatioConfigs['9:16'].height}
        defaultProps={previewBrands.light}
        schema={tokenPreviewPropsSchema}
      />
      <Composition
        id="TokenPreview16x9"
        component={TokenPreview}
        durationInFrames={tokenPreviewDurationInFrames}
        fps={standardFps}
        width={aspectRatioConfigs['16:9'].width}
        height={aspectRatioConfigs['16:9'].height}
        defaultProps={previewBrands.dark}
        schema={tokenPreviewPropsSchema}
      />
    </>
  );
};

export {defaultProps};
