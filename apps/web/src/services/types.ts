import type {BrandKit, Brief, SceneJSON, Storyboard, UploadedAsset} from '@ai-video-studio/schema';
import type {PersistedState, ScriptSource} from '../domain/schemas';

/**
 * Integration contracts. UI code talks only to these interfaces; provider-specific code
 * (today: the repo's local Express API) lives behind them in ./localApi.ts.
 * No secrets or API keys ever live in the frontend: providers call a server you control.
 */

export type Availability =
  | {status: 'checking'}
  | {status: 'available'; detail?: string}
  | {status: 'unavailable'; reason: string; howToEnable?: string};

// ---------------------------------------------------------------- script generation

export type ScriptGenerationMode = 'claude-api' | 'template-draft';

export type ScriptGenerationRequest = {brand: BrandKit; brief: Brief; mode: ScriptGenerationMode};

export type ScriptGenerationResponse = {
  storyboard: Storyboard;
  source: ScriptSource;
  warnings: string[];
  notes: string[];
  /** Screenshots after server-side analysis (descriptions, focus regions). */
  assets: UploadedAsset[];
  costUsd?: number;
};

export interface ScriptGenerationService {
  availability(mode: ScriptGenerationMode): Availability;
  generate(request: ScriptGenerationRequest, signal?: AbortSignal): Promise<ScriptGenerationResponse>;
  /** Full instructions to paste into a Claude chat (no API key needed). */
  chatPrompt(brand: BrandKit, brief: Brief): Promise<string>;
  chatPromptAvailability(): Availability;
}

// ---------------------------------------------------------------- assets

export type AssetUploadRequest = {file: File; kind: 'screenshot' | 'logo'; label: string};

/** Result of storing (and later, generating) an image asset. */
export type AssetGenerationResult = UploadedAsset;

export interface AssetService {
  availability(): Availability;
  upload(request: AssetUploadRequest): Promise<AssetGenerationResult>;
}

// ---------------------------------------------------------------- voice-over (not connected yet)

export type VoiceoverRequest = {
  lines: {sceneId: string; text: string}[];
  voice: 'warm' | 'neutral' | 'energetic';
  language: string;
};

export type VoiceoverResult = {
  audioUrl: string;
  durationMs: number;
  /** Word or line timings, compatible with SceneJSON.captions. */
  captions: {text: string; startMs: number; endMs: number}[];
};

export interface VoiceoverService {
  availability(): Availability;
  synthesize(request: VoiceoverRequest): Promise<VoiceoverResult>;
}

// ---------------------------------------------------------------- rendering

export type RenderPreset = 'draft' | 'final';

export type RenderRequest = {sceneJson: SceneJSON; brand: BrandKit; preset: RenderPreset};

export type RenderJobPhase = 'queued' | 'bundling' | 'rendering' | 'done' | 'failed';

export type RenderJobStatus = {
  jobId: string;
  phase: RenderJobPhase;
  /** 0..1 as reported by the renderer. */
  progress: number;
  /** Present only when a real file exists. */
  videoUrl?: string;
  error?: string;
};

export type FinalVideoMetadata = {
  url: string;
  fileName: string;
  container: 'mp4';
  codec: 'h264';
  width: number;
  height: number;
  fps: number;
  durationSec: number;
  preset: RenderPreset;
};

export interface RenderService {
  availability(): Availability;
  start(request: RenderRequest): Promise<RenderJobStatus>;
  status(jobId: string): Promise<RenderJobStatus>;
}

// ---------------------------------------------------------------- saved projects

export type SavedProjectSummary = {id: string; name: string; updatedAt: string};

export type SavedProject = {id: string; name: string; brand: BrandKit; brief: Brief; studio?: PersistedState; legacyStoryboard?: Storyboard};

export interface ProjectStore {
  availability(): Availability;
  list(): Promise<SavedProjectSummary[]>;
  get(id: string): Promise<SavedProject>;
  save(project: {id?: string; name: string; brand: BrandKit; brief: Brief; studio: PersistedState}): Promise<{id: string; updatedAt: string}>;
}

export type Services = {
  script: ScriptGenerationService;
  assets: AssetService;
  voiceover: VoiceoverService;
  render: RenderService;
  projects: ProjectStore;
};

/** Errors thrown by services carry a kind so the UI can offer the right recovery action. */
export class ServiceError extends Error {
  constructor(
    message: string,
    readonly kind: 'unavailable' | 'network' | 'timeout' | 'rejected' | 'server' | 'invalid-response',
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}
