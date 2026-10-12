import {z} from 'zod';
import {brandKitSchema, briefSchema, storyboardSchema, uploadedAssetSchema, type UploadedAsset} from '@ai-video-studio/schema';
import {persistedStateSchema} from '../domain/schemas';
import {API_BASE, jsonBody, request} from './http';
import {
  ServiceError,
  type AssetService,
  type Availability,
  type ProjectStore,
  type RenderJobStatus,
  type RenderService,
  type ScriptGenerationMode,
  type ScriptGenerationService,
  type Services,
  type VoiceoverService,
} from './types';

/**
 * Provider for the repo's own API server (apps/api). It uses ONLY endpoints that exist in apps/api/src/routes.ts:
 * GET /health, POST /uploads, POST /plan, POST /plan/prompt, GET|POST /projects, GET /projects/:id, POST /render, GET /render/:id.
 * Every response is validated before the UI sees it.
 */

export const healthSchema = z.object({status: z.string(), mockAi: z.boolean(), hasApiKey: z.boolean(), model: z.string()});
export type Health = z.infer<typeof healthSchema>;

export type Connection = {state: 'checking'} | {state: 'offline'; error: string} | {state: 'online'; health: Health};

export const checkHealth = async (): Promise<Health> => {
  const raw = await request<unknown>('/health', {timeoutMs: 5000});
  const parsed = healthSchema.safeParse(raw);
  if (!parsed.success) throw new ServiceError('The server at the API address is not the AI Video Studio API.', 'invalid-response');
  return parsed.data;
};

const offline = (connection: Connection): Availability | null => {
  if (connection.state === 'checking') return {status: 'checking'};
  if (connection.state === 'offline') {
    return {status: 'unavailable', reason: `The API server at ${API_BASE} is not reachable.`, howToEnable: 'Start it with "npm run dev:api", then choose "Check again".'};
  }
  return null;
};

const planResponseSchema = z.object({
  storyboard: storyboardSchema,
  notes: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  costUsd: z.number().optional(),
  mock: z.boolean(),
  attempts: z.number(),
  assets: z.array(uploadedAssetSchema).default([]),
});

const renderJobSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['queued', 'bundling', 'rendering', 'done', 'error']),
  progress: z.number(),
  url: z.string().optional(),
  error: z.string().optional(),
});

const toJobStatus = (raw: unknown): RenderJobStatus => {
  const parsed = renderJobSchema.safeParse(raw);
  if (!parsed.success) throw new ServiceError('The render server sent an unexpected job status.', 'invalid-response');
  const job = parsed.data;
  return {
    jobId: job.id,
    phase: job.status === 'error' ? 'failed' : job.status,
    progress: Math.min(1, Math.max(0, job.progress)),
    ...(job.status === 'done' && job.url ? {videoUrl: job.url} : {}),
    ...(job.error ? {error: job.error} : {}),
  };
};

export const createLocalApiServices = (connection: Connection): Services => {
  const scriptAvailability = (mode: ScriptGenerationMode): Availability => {
    const down = offline(connection);
    if (down) return down;
    if (connection.state !== 'online') return {status: 'checking'};
    if (mode === 'template-draft') return {status: 'available', detail: 'Rule-based. Not AI.'};
    if (!connection.health.hasApiKey) {
      return {status: 'unavailable', reason: 'No AI provider is configured on the API server.', howToEnable: 'Add ANTHROPIC_API_KEY to apps/api/.env and restart the API. Or use the Claude chat option below.'};
    }
    return {status: 'available', detail: connection.health.model};
  };

  const script: ScriptGenerationService = {
    availability: scriptAvailability,
    chatPromptAvailability: () => offline(connection) ?? {status: 'available'},
    generate: async ({brand, brief, mode}, signal) => {
      const availability = scriptAvailability(mode);
      if (availability.status !== 'available') throw new ServiceError(availability.status === 'unavailable' ? availability.reason : 'Still checking the connection.', 'unavailable');
      const raw = await request<unknown>('/plan', {...jsonBody('POST', {brand, brief, mock: mode === 'template-draft'}), timeoutMs: 180_000, signal});
      const parsed = planResponseSchema.safeParse(raw);
      if (!parsed.success) throw new ServiceError('The script service returned data in an unexpected format.', 'invalid-response');
      const plan = parsed.data;
      return {
        storyboard: plan.storyboard,
        source: plan.mock ? 'template-draft' : 'claude-api',
        warnings: plan.warnings,
        notes: plan.notes,
        assets: plan.assets,
        ...(plan.mock ? {} : {costUsd: plan.costUsd}),
      };
    },
    chatPrompt: async (brand, brief) => {
      const raw = await request<{prompt?: unknown}>('/plan/prompt', jsonBody('POST', {brand, brief}));
      if (typeof raw.prompt !== 'string' || raw.prompt.length === 0) throw new ServiceError('The server returned an empty prompt.', 'invalid-response');
      return raw.prompt;
    },
  };

  const assets: AssetService = {
    availability: () => offline(connection) ?? {status: 'available'},
    upload: async ({file, kind, label}) => {
      if (offline(connection)) throw new ServiceError('The upload service is not connected.', 'unavailable');
      const form = new FormData();
      form.append('file', file);
      form.append('kind', kind);
      form.append('label', label);
      const raw = await request<unknown>('/uploads', {method: 'POST', body: form, timeoutMs: 60_000});
      const parsed = uploadedAssetSchema.safeParse(raw);
      if (!parsed.success) throw new ServiceError('The upload service returned an unexpected response.', 'invalid-response');
      return parsed.data as UploadedAsset;
    },
  };

  const render: RenderService = {
    availability: () => offline(connection) ?? {status: 'available', detail: 'Remotion on the API server'},
    start: async ({sceneJson, brand, preset}) => {
      if (offline(connection)) throw new ServiceError('The render service is not connected.', 'unavailable');
      return toJobStatus(await request<unknown>('/render', jsonBody('POST', {sceneJson, brand, preset})));
    },
    status: async (jobId) => toJobStatus(await request<unknown>(`/render/${encodeURIComponent(jobId)}`, {timeoutMs: 10_000})),
  };

  const projects: ProjectStore = {
    availability: () => offline(connection) ?? {status: 'available'},
    list: async () => z.array(z.object({id: z.string(), name: z.string(), updatedAt: z.string()})).parse(await request<unknown>('/projects')),
    get: async (id) => {
      const raw = await request<{id?: unknown; name?: unknown; brand?: unknown; brief?: unknown; plan?: unknown}>(`/projects/${encodeURIComponent(id)}`);
      const brand = brandKitSchema.safeParse(raw.brand);
      const brief = briefSchema.safeParse(raw.brief);
      if (!brand.success || !brief.success) throw new ServiceError('This saved project is damaged or from an incompatible version.', 'invalid-response');
      const plan = raw.plan as {kind?: unknown; state?: unknown; storyboard?: unknown} | undefined;
      const studio = plan?.kind === 'studio-v2' ? persistedStateSchema.safeParse(plan.state) : null;
      const legacy = !studio && plan?.storyboard ? storyboardSchema.safeParse(plan.storyboard) : null;
      return {
        id: String(raw.id ?? id),
        name: String(raw.name ?? 'Untitled'),
        brand: brand.data,
        brief: brief.data,
        ...(studio?.success ? {studio: studio.data} : {}),
        ...(legacy?.success ? {legacyStoryboard: legacy.data} : {}),
      };
    },
    save: async ({id, name, brand, brief, studio}) =>
      request<{id: string; updatedAt: string}>('/projects', jsonBody('POST', {...(id ? {id} : {}), name: name.slice(0, 80), brand, brief, plan: {kind: 'studio-v2', state: studio}})),
  };

  return {script, assets, voiceover: unconfiguredVoiceover, render, projects};
};

/** There is no voice-over provider in this project yet. This stays unavailable until one is wired in. */
export const unconfiguredVoiceover: VoiceoverService = {
  availability: () => ({status: 'unavailable', reason: 'No voice-over provider is connected yet.', howToEnable: 'Implement VoiceoverService (src/services/types.ts) against your text-to-speech API.'}),
  synthesize: async () => {
    throw new ServiceError('No voice-over provider is connected yet.', 'unavailable');
  },
};
