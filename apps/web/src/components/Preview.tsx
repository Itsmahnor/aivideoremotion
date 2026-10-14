import {Player, Thumbnail, type PlayerRef} from '@remotion/player';
import {DynamicVideo, type DynamicVideoProps} from '@ai-video-studio/video/player';
import {getTotalDurationInFrames, type BrandKit, type SceneJSON} from '@ai-video-studio/schema';
import {forwardRef, useMemo, type FC} from 'react';

/**
 * Live preview: the same DynamicVideo composition that Remotion renders to MP4, played in the browser.
 * It is a preview of the storyboard, not the exported file.
 */
export const Preview = forwardRef<PlayerRef, {sceneJson: SceneJSON; brand: BrandKit}>(({sceneJson, brand}, ref) => {
  const inputProps = useMemo<DynamicVideoProps>(() => ({sceneJson, brand}), [sceneJson, brand]);
  const {width, height, fps} = sceneJson.meta;
  const maxWidth = height > width ? 340 : height === width ? 520 : 960;
  const hasAudio = Boolean(sceneJson.audio.musicUrl || sceneJson.audio.voiceoverUrl);
  return (
    <div style={{maxWidth}} className="mx-auto w-full overflow-hidden rounded-xl bg-black ring-1 ring-line">
      <Player
        ref={ref}
        component={DynamicVideo}
        inputProps={inputProps}
        durationInFrames={getTotalDurationInFrames(sceneJson)}
        fps={fps}
        compositionWidth={width}
        compositionHeight={height}
        controls
        clickToPlay
        doubleClickToFullscreen
        spaceKeyToPlayOrPause
        showVolumeControls={hasAudio}
        initialFrame={0}
        style={{width: '100%'}}
        acknowledgeRemotionLicense
      />
    </div>
  );
});
Preview.displayName = 'Preview';

/** Start frame of each scene on the timeline (transitions overlap scenes). */
export const sceneStartFrames = (sceneJson: SceneJSON): number[] => {
  let frame = 0;
  return sceneJson.scenes.map((scene) => {
    const start = frame;
    frame += scene.durationInFrames - scene.transitionOut.durationInFrames;
    return start;
  });
};

/** A still frame from the middle of one scene. */
export const SceneThumbnail: FC<{sceneJson: SceneJSON; brand: BrandKit; index: number}> = ({sceneJson, brand, index}) => {
  const inputProps = useMemo<DynamicVideoProps>(() => ({sceneJson, brand}), [sceneJson, brand]);
  const starts = useMemo(() => sceneStartFrames(sceneJson), [sceneJson]);
  const scene = sceneJson.scenes[index];
  if (!scene) return null;
  const frame = Math.min(getTotalDurationInFrames(sceneJson) - 1, (starts[index] ?? 0) + Math.round(scene.durationInFrames * 0.6));
  return (
    <Thumbnail
      component={DynamicVideo}
      inputProps={inputProps}
      compositionWidth={sceneJson.meta.width}
      compositionHeight={sceneJson.meta.height}
      durationInFrames={getTotalDurationInFrames(sceneJson)}
      fps={sceneJson.meta.fps}
      frameToDisplay={frame}
      style={{width: '100%', height: '100%'}}
    />
  );
};