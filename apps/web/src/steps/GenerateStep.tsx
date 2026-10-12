import {useMemo, useRef, type FC} from 'react';
import type {PlayerRef} from '@remotion/player';
import {Clapperboard, Film, PlugZap, RotateCcw} from 'lucide-react';
import {getTotalDurationInFrames} from '@ai-video-studio/schema';
import {Preview, SceneThumbnail, sceneStartFrames} from '../components/Preview';
import {TEMPLATE_LABEL} from '../components/script/sceneFields';
import {Badge, Button, EmptyState, Notice, ProgressBar, Section} from '../components/ui';
import {toBrandKit} from '../domain/mapping';
import {hasDownloadableVideo, isRenderCurrent, isRendering} from '../workflow/machine';
import {useWorkflow} from '../workflow/WorkflowProvider';

export const PHASE_LABEL: Record<string, string> = {
  submitting: 'Sending to the renderer…',
  queued: 'Waiting in the render queue…',
  bundling: 'Preparing the renderer (the first render takes longer)…',
  rendering: 'Rendering frames…',
};

export const ProjectFacts: FC = () => {
  const {state, sceneJson} = useWorkflow();
  const {config} = state;
  const seconds = sceneJson ? getTotalDurationInFrames(sceneJson) / sceneJson.meta.fps : 0;
  const facts: [string, string][] = [
    ['Product', config.product.productName.trim() || '—'],
    ['Format', `${config.video.aspectRatio} · ${sceneJson ? `${sceneJson.meta.width}×${sceneJson.meta.height}` : '—'}`],
    ['Length', sceneJson ? `${seconds.toFixed(1)}s (target ${config.video.durationSec}s)` : `${config.video.durationSec}s`],
    ['Scenes', `${state.script?.scenes.length ?? 0}`],
    ['Frame rate', sceneJson ? `${sceneJson.meta.fps} fps` : '—'],
    ['Style', `${config.video.visualStyle.replace(/-/g, ' ')} · ${config.video.motionStyle} motion`],
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
      {facts.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-[12px] text-muted">{label}</dt>
          <dd className="truncate text-sm font-medium capitalize text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
};

export const GenerateStep: FC = () => {
  const {state, dispatch, sceneJson, services, actions, recheckConnection} = useWorkflow();
  const player = useRef<PlayerRef>(null);
  const brand = useMemo(() => toBrandKit(state.config), [state.config]);
  const starts = useMemo(() => (sceneJson ? sceneStartFrames(sceneJson) : []), [sceneJson]);
  const availability = services.render.availability();
  const {render} = state;
  const rendering = isRendering(state);
  const current = isRenderCurrent(state);

  if (!sceneJson) {
    return (
      <EmptyState
        icon={<Clapperboard className="h-5 w-5" aria-hidden />}
        title="The storyboard cannot be previewed"
        actions={<Button onClick={() => dispatch({type: 'step/go', step: 'script'})}>Back to the script</Button>}
      >
        It has errors or was changed. Fix it in the script step and approve it again.
      </EmptyState>
    );
  }

  return (
    <>
      <Section id="project" title="Project">
        <ProjectFacts />
      </Section>

      <Section
        id="preview"
        title="Live preview"
        description="Played in your browser from the approved storyboard with the same templates the renderer uses. This is a preview, not the exported file."
        aside={
          <Button variant="secondary" size="sm" onClick={() => dispatch({type: 'step/go', step: 'script'})}>
            Edit script
          </Button>
        }
      >
        <Preview ref={player} sceneJson={sceneJson} brand={brand} />
        <p className="mt-2 text-center text-[12px] text-muted">
          Click the video or press Space to play and pause. Double-click for full screen.
        </p>
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Scenes</p>
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {sceneJson.scenes.map((scene, i) => (
              <li key={scene.id}>
                <button
                  type="button"
                  onClick={() => {
                    player.current?.seekTo(starts[i] ?? 0);
                    player.current?.play();
                  }}
                  className="group w-full overflow-hidden rounded-lg border border-line bg-surface text-left hover:border-signal"
                  aria-label={`Play from scene ${i + 1}: ${TEMPLATE_LABEL[scene.template as keyof typeof TEMPLATE_LABEL] ?? scene.template}`}
                >
                  <div className="pointer-events-none flex justify-center bg-black">
                    <div style={sceneJson.meta.height > sceneJson.meta.width ? {height: 160, width: (160 * sceneJson.meta.width) / sceneJson.meta.height} : {width: '100%', aspectRatio: `${sceneJson.meta.width} / ${sceneJson.meta.height}`}}>
                      <SceneThumbnail sceneJson={sceneJson} brand={brand} index={i} />
                    </div>
                  </div>
                  <div className="px-2.5 py-2">
                    <p className="truncate text-[12px] font-semibold text-ink">
                      {i + 1}. {TEMPLATE_LABEL[scene.template as keyof typeof TEMPLATE_LABEL] ?? scene.template}
                    </p>
                    <p className="text-[11px] tabular-nums text-muted">{(scene.durationInFrames / sceneJson.meta.fps).toFixed(1)}s</p>
                  </div>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      <Section id="render" title="Render video file" description="Creates a real MP4 on the render server. Draft is half resolution and quicker; final is full resolution." aside={<RenderBadge />}>
        {availability.status === 'unavailable' ? (
          <Notice
            tone="warning"
            title="Video rendering is not connected"
            actions={
              <Button variant="secondary" size="sm" onClick={recheckConnection}>
                Check again
              </Button>
            }
          >
            {availability.reason} {availability.howToEnable} Until then, you can preview the video above and download the scene file on the next step.
          </Notice>
        ) : null}

        {rendering ? (
          <div className="space-y-3" aria-live="polite">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-ink">{PHASE_LABEL[render.phase] ?? 'Working…'}</span>
              {render.phase === 'rendering' ? <span className="tabular-nums text-muted">{Math.round(render.progress * 100)}%</span> : null}
            </div>
            <ProgressBar value={render.progress} indeterminate={render.phase !== 'rendering'} label="Render progress" />
            <p className="text-[12px] text-muted">You can keep this page open. Editing is paused until the render finishes.</p>
          </div>
        ) : null}

        {render.phase === 'failed' ? (
          <Notice
            tone="error"
            live
            title="The render failed"
            actions={
              <Button size="sm" variant="secondary" disabled={availability.status !== 'available'} onClick={() => void actions.startRender(render.preset ?? 'draft')}>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Try again
              </Button>
            }
          >
            <span className="whitespace-pre-wrap">{render.error ?? 'Unknown error.'}</span>
          </Notice>
        ) : null}

        {render.phase === 'done' && !current ? (
          <Notice tone="warning" title="This video is out of date">
            The script or settings changed after it was rendered, so it no longer matches. Render again to get an up-to-date file.
          </Notice>
        ) : null}

        {hasDownloadableVideo(state) ? (
          <Notice
            tone="success"
            title={`${render.preset === 'final' ? 'Final' : 'Draft'} video ready`}
            actions={<Button size="sm" onClick={() => dispatch({type: 'step/next'})}>Go to export</Button>}
          >
            The file was rendered from the current storyboard.
          </Notice>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button disabled={availability.status !== 'available' || rendering} loading={render.phase === 'submitting'} onClick={() => void actions.startRender('draft')}>
            <Film className="h-4 w-4" aria-hidden /> Render draft
          </Button>
          <Button variant="secondary" disabled={availability.status !== 'available' || rendering} onClick={() => void actions.startRender('final')}>
            Render final quality
          </Button>
          {availability.status === 'unavailable' ? (
            <span className="flex items-center gap-1.5 text-[13px] text-muted">
              <PlugZap className="h-3.5 w-3.5" aria-hidden /> Needs the render server
            </span>
          ) : null}
        </div>
      </Section>
    </>
  );
};

const RenderBadge: FC = () => {
  const {state} = useWorkflow();
  if (isRendering(state)) return <Badge tone="signal">Rendering</Badge>;
  if (hasDownloadableVideo(state)) return <Badge tone="ok">File ready</Badge>;
  if (state.render.phase === 'failed') return <Badge tone="bad">Failed</Badge>;
  if (state.render.phase === 'done') return <Badge tone="warn">Out of date</Badge>;
  return <Badge>Not rendered</Badge>;
};
