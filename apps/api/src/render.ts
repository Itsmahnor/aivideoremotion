import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import type {BrandKit, SceneJSON} from '@ai-video-studio/schema';
import {config} from './config';
import {dirs} from './storage';

export type RenderPreset = 'draft' | 'final';
export type RenderJob = {
  id: string;
  status: 'queued' | 'bundling' | 'rendering' | 'done' | 'error';
  progress: number;
  preset: RenderPreset;
  url?: string;
  error?: string;
  createdAt: number;
};

const jobs = new Map<string, RenderJob>();
let queue: Promise<void> = Promise.resolve();
let bundlePromise: Promise<string> | undefined;

const ENTRY = path.join(config.repoRoot, 'packages/video/src/index.ts');
const PUBLIC_DIR = path.join(config.repoRoot, 'packages/video/public');
/** Same composition as the Studio fixture; inputProps replace its default props. */
const COMPOSITION_ID = 'DynamicVideo-Fixture';

const getBundle = (): Promise<string> => {
  bundlePromise ??= bundle({entryPoint: ENTRY, publicDir: PUBLIC_DIR});
  return bundlePromise;
};

export const getJob = (id: string): RenderJob | undefined => jobs.get(id);

const run = async (job: RenderJob, sceneJson: SceneJSON, brand: BrandKit): Promise<void> => {
  try {
    job.status = 'bundling';
    const serveUrl = await getBundle();
    const inputProps = {sceneJson, brand};
    const browserExecutable = config.browserExecutable ?? null;
    const composition = await selectComposition({serveUrl, id: COMPOSITION_ID, inputProps, browserExecutable});
    job.status = 'rendering';
    const file = `${job.id}.mp4`;
    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      outputLocation: path.join(dirs.renders, file),
      inputProps,
      browserExecutable,
      scale: job.preset === 'draft' ? 0.5 : 1,
      crf: job.preset === 'draft' ? 30 : 18,
      onProgress: ({progress}) => {
        job.progress = progress;
      },
    });
    job.progress = 1;
    job.url = `${config.publicUrl}/files/renders/${file}`;
    job.status = 'done';
  } catch (error) {
    bundlePromise = undefined; // allow a clean retry
    job.status = 'error';
    job.error = (error as Error).message;
  }
};

/** One render at a time. Renders are heavy, so extra requests wait in a queue. */
export const enqueueRender = (sceneJson: SceneJSON, brand: BrandKit, preset: RenderPreset): RenderJob => {
  const job: RenderJob = {id: randomUUID(), status: 'queued', progress: 0, preset, createdAt: Date.now()};
  jobs.set(job.id, job);
  queue = queue.then(() => run(job, sceneJson, brand));
  return job;
};
