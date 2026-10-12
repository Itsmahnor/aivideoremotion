import {Component, useMemo, type FC, type ReactNode} from 'react';
import {AbsoluteFill, Easing, type CalculateMetadataFunction} from 'remotion';
import {linearTiming, TransitionSeries, type TransitionPresentation} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
import {slide} from '@remotion/transitions/slide';
import {wipe} from '@remotion/transitions/wipe';
import {
  createSceneJsonSchema,
  getTotalDurationInFrames,
  sceneJsonSchema,
  TEMPLATE_PROPS,
  type BrandKit,
  type Scene,
  type TemplateName,
} from '@ai-video-studio/schema';
import {sceneRegistry} from '../scenes/registry';
import {SceneDurationContext} from '../scenes/kit';
import {BrandThemeProvider} from '../tokens';

export type DynamicVideoProps = {
  sceneJson: unknown;
  brand: BrandKit;
};

const sceneJsonWithTemplates = createSceneJsonSchema(TEMPLATE_PROPS);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPresentation = TransitionPresentation<any>;

const presentationFor = (type: Scene['transitionOut']['type']): AnyPresentation | null => {
  if (type === 'fade') return fade();
  if (type === 'slide') return slide({direction: 'from-right'});
  if (type === 'wipe') return wipe({direction: 'from-left'});
  return null;
};

export const calculateDynamicVideoMetadata: CalculateMetadataFunction<DynamicVideoProps> = ({props}) => {
  const parsed = sceneJsonSchema.parse(props.sceneJson);
  return {
    durationInFrames: getTotalDurationInFrames(parsed),
    fps: parsed.meta.fps,
    width: parsed.meta.width,
    height: parsed.meta.height,
  };
};

const MessageFrame: FC<{title: string; lines: string[]}> = ({title, lines}) => (
  <AbsoluteFill style={{alignItems: 'center', backgroundColor: '#1F2937', color: '#F9FAFB', fontFamily: 'system-ui, sans-serif', justifyContent: 'center', padding: 80}}>
    <div style={{fontSize: 52, fontWeight: 700, marginBottom: 28}}>{title}</div>
    {lines.map((line) => (
      <div key={line} style={{color: '#FCA5A5', fontFamily: 'monospace', fontSize: 28, marginBottom: 10, maxWidth: 1400}}>
        {line}
      </div>
    ))}
  </AbsoluteFill>
);

class SceneBoundary extends Component<{template: string; children: ReactNode}, {failed: boolean; message: string}> {
  state = {failed: false, message: ''};

  static getDerivedStateFromError(error: Error) {
    return {failed: true, message: error.message};
  }

  render() {
    if (this.state.failed) return <MessageFrame title={`Scene "${this.props.template}" crashed`} lines={[this.state.message]} />;
    return this.props.children;
  }
}

export const DynamicVideo: FC<DynamicVideoProps> = ({sceneJson, brand}) => {
  const parsed = useMemo(() => sceneJsonWithTemplates.safeParse(sceneJson), [sceneJson]);

  if (!parsed.success) {
    return <MessageFrame title="Invalid scene JSON" lines={parsed.error.issues.slice(0, 6).map((issue) => `${issue.path.join('.')}: ${issue.message}`)} />;
  }

  const children = parsed.data.scenes.flatMap((scene) => {
    const entry = sceneRegistry[scene.template as TemplateName];
    // Parse again so template defaults (variant, device, ...) are applied.
    const props = TEMPLATE_PROPS[scene.template as TemplateName].parse(scene.props) as Record<string, unknown>;
    const Template = entry.component;
    const presentation = presentationFor(scene.transitionOut.type);
    const nodes: ReactNode[] = [
      <TransitionSeries.Sequence key={`${scene.id}-scene`} durationInFrames={scene.durationInFrames}>
        <SceneDurationContext.Provider value={scene.durationInFrames}>
          <SceneBoundary template={scene.template}>
            <Template {...props} />
          </SceneBoundary>
        </SceneDurationContext.Provider>
      </TransitionSeries.Sequence>,
    ];
    if (presentation) {
      nodes.push(
        <TransitionSeries.Transition
          key={`${scene.id}-transition`}
          presentation={presentation}
          timing={linearTiming({durationInFrames: scene.transitionOut.durationInFrames, easing: Easing.inOut(Easing.cubic)})}
        />,
      );
    }
    return nodes;
  });

  return (
    <BrandThemeProvider brand={brand}>
      <AbsoluteFill style={{backgroundColor: brand.colors.background}}>
        <TransitionSeries>{children}</TransitionSeries>
      </AbsoluteFill>
    </BrandThemeProvider>
  );
};
