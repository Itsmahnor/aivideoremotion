import {useState, type FC} from 'react';
import {Download, FileJson, FileVideo, Film, Lock} from 'lucide-react';
import {getTotalDurationInFrames} from '@ai-video-studio/schema';
import {Badge, Button, EmptyState, Notice, ProgressBar, Section} from '../components/ui';
import {cn} from '../lib/utils';
import {hasDownloadableVideo, isRendering} from '../workflow/machine';
import {useWorkflow} from '../workflow/WorkflowProvider';
import {PHASE_LABEL, ProjectFacts} from './GenerateStep';
import type {FinalVideoMetadata} from '../services/types';

const slug = (text: string) => text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'video';

/** Saves a file via a blob so the browser uses our file name (the API serves renders with open CORS). */
const saveFromUrl = async (url: string, fileName: string) => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(String(response.status));
    const blobUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
    return null;
  } catch {
    return 'The file could not be downloaded directly. It may have been removed from the render server. Try rendering again.';
  }
};

const saveText = (text: string, fileName: string, type: string) => {
  const url = URL.createObjectURL(new Blob([text], {type}));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

export const ExportStep: FC = () => {
  const {state, dispatch, sceneJson, services} = useWorkflow();
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const {render, config} = state;
  const ready = hasDownloadableVideo(state);
  const name = slug(config.product.productName);

  const meta: FinalVideoMetadata | null =
    ready && sceneJson && render.videoUrl
      ? {
          url: render.videoUrl,
          fileName: `${name}-${config.video.aspectRatio.replace(':', 'x')}-${render.preset ?? 'draft'}.mp4`,
          container: 'mp4',
          codec: 'h264',
          width: render.preset === 'final' ? sceneJson.meta.width : Math.round(sceneJson.meta.width / 2),
          height: render.preset === 'final' ? sceneJson.meta.height : Math.round(sceneJson.meta.height / 2),
          fps: sceneJson.meta.fps,
          durationSec: getTotalDurationInFrames(sceneJson) / sceneJson.meta.fps,
          preset: render.preset ?? 'draft',
        }
      : null;

  const download = async () => {
    if (!meta) return;
    setDownloading(true);
    setDownloadError(await saveFromUrl(meta.url, meta.fileName));
    setDownloading(false);
  };

  const vertical = config.video.aspectRatio === '9:16';
  const voiceUnavailable = services.voiceover.availability().status === 'unavailable';

  return (
    <>
      <Section id="final" title="Final video" aside={ready ? <Badge tone="ok">Ready</Badge> : <Badge>No file yet</Badge>}>
        {ready && meta ? (
          <video
            key={meta.url}
            src={meta.url}
            controls
            playsInline
            preload="metadata"
            className={cn('mx-auto w-full rounded-xl bg-black ring-1 ring-line', vertical ? 'max-w-[340px]' : config.video.aspectRatio === '1:1' ? 'max-w-[520px]' : '')}
          >
            Your browser cannot play this video. Use the download button below.
          </video>
        ) : isRendering(state) ? (
          <div className="space-y-3 rounded-xl bg-sunken p-5 ring-1 ring-line" aria-live="polite">
            <p className="text-sm font-medium text-ink">{PHASE_LABEL[render.phase] ?? 'Working…'}</p>
            <ProgressBar value={render.progress} indeterminate={render.phase !== 'rendering'} label="Render progress" />
          </div>
        ) : render.phase === 'failed' ? (
          <Notice tone="error" title="The last render failed" actions={<Button size="sm" variant="secondary" onClick={() => dispatch({type: 'step/go', step: 'generate'})}>Back to generate</Button>}>
            {render.error}
          </Notice>
        ) : render.phase === 'done' ? (
          <Notice tone="warning" title="The rendered video is out of date" actions={<Button size="sm" variant="secondary" onClick={() => dispatch({type: 'step/go', step: 'generate'})}>Render again</Button>}>
            The script or settings changed after it was rendered. Download is disabled so you do not export the wrong version.
          </Notice>
        ) : (
          <EmptyState
            icon={<Film className="h-5 w-5" aria-hidden />}
            title="No video file yet"
            actions={<Button onClick={() => dispatch({type: 'step/go', step: 'generate'})}>Go to generate</Button>}
          >
            Render the approved storyboard on the previous step. The download becomes available once a real file exists.
          </EmptyState>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button onClick={() => void download()} disabled={!meta} loading={downloading} aria-describedby={!meta ? 'download-why' : undefined}>
            {meta ? <Download className="h-4 w-4" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />} Download MP4
          </Button>
          {!meta ? (
            <span id="download-why" className="text-[13px] text-muted">
              Available after a successful render of the current storyboard.
            </span>
          ) : (
            <span className="text-[13px] text-muted">{meta.fileName}</span>
          )}
        </div>
        {downloadError ? (
          <p role="alert" className="mt-2 text-[13px] text-bad">
            {downloadError}
          </p>
        ) : null}
      </Section>

      <Section id="formats" title="Export formats">
        <ul className="divide-y divide-line rounded-xl border border-line">
          <li className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-start gap-3">
              <FileVideo className="mt-0.5 h-5 w-5 text-muted" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-ink">MP4 video · H.264</p>
                <p className="text-[13px] text-muted">
                  {meta ? `${meta.width}×${meta.height} · ${meta.fps} fps · ${meta.durationSec.toFixed(1)}s · ${meta.preset === 'final' ? 'final quality' : 'draft (half resolution)'} · no audio track` : 'Final: full resolution. Draft: half resolution. No audio track.'}
                </p>
              </div>
            </div>
            <Badge tone={meta ? 'ok' : 'neutral'}>{meta ? 'Ready' : 'After render'}</Badge>
          </li>
          <li className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-start gap-3">
              <FileJson className="mt-0.5 h-5 w-5 text-muted" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-ink">Scene file · JSON</p>
                <p className="text-[13px] text-muted">The approved storyboard in the format the renderer reads. Useful for rendering elsewhere or version control.</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" disabled={!sceneJson} onClick={() => sceneJson && saveText(JSON.stringify(sceneJson, null, 2), `${name}.scene.json`, 'application/json')}>
              <Download className="h-3.5 w-3.5" aria-hidden /> Download
            </Button>
          </li>
          <li className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-start gap-3">
              <FileVideo className="mt-0.5 h-5 w-5 text-faint" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-ink">Voice-over audio and captions</p>
                <p className="text-[13px] text-muted">Needs a voice-over provider. {voiceUnavailable ? 'Not connected yet.' : ''}</p>
              </div>
            </div>
            <Badge tone="warn">Not available</Badge>
          </li>
        </ul>
      </Section>

      <Section id="settings" title="Video settings">
        <ProjectFacts />
        <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-line pt-4">
          <div className="flex items-center gap-1.5" aria-label="Brand colors">
            {Object.entries(config.brand.colors).map(([key, value]) => (
              <span key={key} title={`${key}: ${value}`} className="h-6 w-6 rounded-md ring-1 ring-line" style={{background: value}} />
            ))}
          </div>
          <span className="text-sm text-muted">
            {config.brand.fonts.heading} / {config.brand.fonts.body}
          </span>
          <span className="text-sm text-muted">
            Voice-over: {config.video.voiceover.enabled ? `requested (${voiceUnavailable ? 'not connected' : config.video.voiceover.voice})` : 'off'} · Captions: {config.video.captions.enabled ? `requested (${voiceUnavailable ? 'not connected' : config.video.captions.style})` : 'off'}
          </span>
        </div>
      </Section>
    </>
  );
};
