import {Component, useMemo, type FC, type ReactNode} from 'react';
import {AbsoluteFill, Audio, Easing, interpolate, Sequence, useVideoConfig, type CalculateMetadataFunction} from 'remotion';
import {linearTiming, TransitionSeries} from '@remotion/transitions';
import {
  createSceneJsonSchema,
  getTotalDurationInFrames,
  sceneJsonSchema,
  TEMPLATE_PROPS,
  type BrandKit,
  type SceneJSON,
  type TemplateName,
} from '@ai-video-studio/schema';
import {sceneRegistry} from '../scenes/registry';
import {resolveAsset} from '../scenes/assets';
import {SceneDurationContext} from '../scenes/kit';
import {BrandThemeProvider} from '../tokens';
import {CaptionBar} from '../scenes/components/CaptionBar';
import {backgroundCss} from '../tokens/background';
import {presentationFor} from '../transitions';

export type DynamicVideoProps = {
  sceneJson: unknown;
  brand: BrandKit;
};

const sceneJsonWithTemplates = createSceneJsonSchema(TEMPLATE_PROPS);

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const DEFAULT_MUSIC_VOLUME = 0.25;
const DEFAULT_DUCK = 0.35;
const DEFAULT_SFX_VOLUME = 0.5;
const SFX_FRAMES = 60;

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

/** Music, voice-over and sound effects. Nothing here renders unless the matching URL is set in SceneJSON.audio. */
const AudioLayer: FC<{sceneJson: SceneJSON}> = ({sceneJson}) => {
  const {fps} = useVideoConfig();
  const {audio, captions, scenes} = sceneJson;
  const total = getTotalDurationInFrames(sceneJson);

  // Where each scene starts and where its outgoing transition begins, on the real (overlapped) timeline.
  const timeline = useMemo(() => {
    let start = 0;
    return scenes.map((scene, index) => {
      const entry = {
        start,
        transitionStart: start + scene.durationInFrames - scene.transitionOut.durationInFrames,
        incoming: index > 0 ? scenes[index - 1]!.transitionOut.durationInFrames : 0,
        hasTransition: scene.transitionOut.type !== 'none',
      };
      start += scene.durationInFrames - scene.transitionOut.durationInFrames;
      return entry;
    });
  }, [scenes]);

  const voiceWindows = useMemo(
    () => captions.map((caption) => ({from: Math.round((caption.startMs * fps) / 1000), to: Math.round((caption.endMs * fps) / 1000)})),
    [captions, fps],
  );

  const musicLevel = audio.musicVolume ?? DEFAULT_MUSIC_VOLUME;
  const duck = audio.duckTo ?? DEFAULT_DUCK;
  const hasVoice = Boolean(audio.voiceoverUrl);

  /** Music volume per frame: fade in, fade out, and duck under the voice. */
  const musicVolume = (frame: number): number => {
    const fadeIn = interpolate(frame, [0, fps], [0, 1], clamp);
    const fadeOut = interpolate(frame, [Math.max(0, total - fps * 1.5), total], [1, 0], clamp);
    let ducking = 1;
    if (hasVoice) {
      ducking = duck;
      if (voiceWindows.length > 0) {
        // Dip while a caption is on screen, with a short ramp either side.
        ducking = voiceWindows.reduce((lowest, w) => Math.min(lowest, interpolate(frame, [w.from - 6, w.from + 6, w.to - 6, w.to + 6], [1, duck, duck, 1], clamp)), 1);
      }
    }
    return musicLevel * fadeIn * fadeOut * ducking;
  };

  const sfx = audio.sfx;
  const sfxVolume = sfx?.volume ?? DEFAULT_SFX_VOLUME;

  return (
    <>
      {audio.musicUrl ? <Audio src={resolveAsset(audio.musicUrl)} loop volume={musicVolume} /> : null}
      {audio.voiceoverUrl ? <Audio src={resolveAsset(audio.voiceoverUrl)} /> : null}
      {sfx?.transitionUrl
        ? timeline.map((item, index) =>
            item.hasTransition ? (
              <Sequence key={`sfx-t-${index}`} from={item.transitionStart} durationInFrames={SFX_FRAMES}>
                <Audio src={resolveAsset(sfx.transitionUrl!)} volume={sfxVolume} />
              </Sequence>
            ) : null,
          )
        : null}
      {sfx?.entranceUrl
        ? timeline.map((item, index) => (
            <Sequence key={`sfx-e-${index}`} from={item.start + item.incoming} durationInFrames={SFX_FRAMES}>
              <Audio src={resolveAsset(sfx.entranceUrl!)} volume={sfxVolume * 0.7} />
            </Sequence>
          ))
        : null}
    </>
  );
};

export const DynamicVideo: FC<DynamicVideoProps> = ({sceneJson, brand}) => {
  const parsed = useMemo(() => sceneJsonWithTemplates.safeParse(sceneJson), [sceneJson]);

  if (!parsed.success) {
    return <MessageFrame title="Invalid scene JSON" lines={parsed.error.issues.slice(0, 6).map((issue) => `${issue.path.join('.')}: ${issue.message}`)} />;
  }

  const {captions, meta} = parsed.data;

  const children = parsed.data.scenes.flatMap((scene) => {
    const entry = sceneRegistry[scene.template as TemplateName];
    // Parse again so template defaults (variant, device, ...) are applied.
    const props = TEMPLATE_PROPS[scene.template as TemplateName].parse(scene.props) as Record<string, unknown>;
    const Template = entry.component;
    const presentation = presentationFor(scene.transitionOut.type, {width: meta.width, height: meta.height});
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
      <AbsoluteFill style={{background: backgroundCss(brand)}}>
        <TransitionSeries>{children}</TransitionSeries>
        {brand.captions.enabled
          ? captions.map((caption, index) => (
              <Sequence
                key={`caption-${index}`}
                from={Math.round((caption.startMs * meta.fps) / 1000)}
                durationInFrames={Math.max(1, Math.round(((caption.endMs - caption.startMs) * meta.fps) / 1000))}
              >
                <CaptionBar text={caption.text} style={brand.captions.style} />
              </Sequence>
            ))
          : null}
        <AudioLayer sceneJson={parsed.data} />
      </AbsoluteFill>
    </BrandThemeProvider>
  );
};