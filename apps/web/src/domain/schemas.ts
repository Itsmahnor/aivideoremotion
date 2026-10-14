import {z} from 'zod';
import {
  AUDIENCES,
  CTA_TYPES,
  DURATIONS_SEC,
  EXPLAINER_SUBTYPES,
  GOALS,
  TEMPLATE_NAMES,
  TONES,
  TRANSITION_TYPES,
  aspectRatioSchema,
  uploadedAssetSchema,
} from '@ai-video-studio/schema';

/**
 * Frontend project model. These schemas are the single source for the TypeScript types
 * AND for safely reading anything back from browser storage (malformed data is rejected, never trusted).
 * Field-level rules for the user (min/max lengths, required) live in ./validation.ts.
 */

const hex = z.string().regex(/^#[0-9A-F]{6}$/);

export const VISUAL_STYLES = ['modern-saas', 'minimal', 'cinematic', 'corporate', 'playful'] as const;
export const MOTION_STYLES = ['calm', 'energetic', 'playful', 'corporate'] as const;
export const VOICES = ['warm', 'neutral', 'energetic'] as const;
export const CAPTION_STYLES = ['clean', 'bold', 'highlight'] as const;
export const SCRIPT_SECTIONS = ['hook', 'problem', 'introduction', 'feature', 'benefit', 'cta'] as const;
export const SCRIPT_SOURCES = ['claude-api', 'claude-chat', 'template-draft'] as const;
export const STEP_IDS = ['product', 'customize', 'script', 'generate', 'export'] as const;

export const featureSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  description: z.string(),
});

export const productInfoSchema = z.object({
  productName: z.string(),
  oneLiner: z.string(),
  description: z.string(),
  problem: z.string(),
  features: z.array(featureSchema).min(1).max(5),
  benefits: z.string(),
  targetAudience: z.string(),
  audienceSegment: z.enum(AUDIENCES),
  goal: z.union([z.enum(GOALS), z.literal('')]),
  objectiveNotes: z.string(),
  tone: z.enum(TONES),
  cta: z.object({type: z.enum(CTA_TYPES), text: z.string(), url: z.string()}),
  customerCount: z.string(),
});

export const brandSettingsSchema = z.object({
  name: z.string(),
  logoUrl: z.string(),
  colors: z.object({primary: hex, secondary: hex, accent: hex, background: hex, text: hex}),
  gradient: z.object({enabled: z.boolean(), from: hex, to: hex, angle: z.number().min(0).max(360)}),
  fonts: z.object({heading: z.string().min(1), body: z.string().min(1)}),
  tone: z.string(),
  rules: z.object({dos: z.array(z.string()), donts: z.array(z.string())}),
});

export const videoSettingsSchema = z.object({
  subtype: z.enum(EXPLAINER_SUBTYPES),
  aspectRatio: aspectRatioSchema,
  durationSec: z.literal(DURATIONS_SEC),
  visualStyle: z.enum(VISUAL_STYLES),
  motionStyle: z.enum(MOTION_STYLES),
  voiceover: z.object({enabled: z.boolean(), voice: z.enum(VOICES), language: z.string()}),
  captions: z.object({enabled: z.boolean(), style: z.enum(CAPTION_STYLES)}),
});

export const projectConfigSchema = z.object({
  product: productInfoSchema,
  brand: brandSettingsSchema,
  video: videoSettingsSchema,
  assets: z.array(uploadedAssetSchema).max(10),
});

export const editableSceneSchema = z.object({
  id: z.string().min(1),
  template: z.enum(TEMPLATE_NAMES),
  section: z.enum(SCRIPT_SECTIONS),
  purpose: z.string(),
  narration: z.string(),
  durationSec: z.number(),
  props: z.record(z.string(), z.unknown()),
  assetId: z.string().optional(),
  focusRegionLabel: z.string().optional(),
  /** Optional transition into the next scene. Empty = chosen automatically by scene role. */
  transitionOut: z.enum(TRANSITION_TYPES).optional(),
});

export const scriptSchema = z.object({
  title: z.string(),
  scenes: z.array(editableSceneSchema),
  source: z.enum(SCRIPT_SOURCES),
  generatedAt: z.string(),
  /** Hash of the product details the script was written from. A mismatch means the script is out of date. */
  basedOn: z.string(),
  warnings: z.array(z.string()),
  notes: z.array(z.string()),
  costUsd: z.number().optional(),
});

export const approvalSchema = z.object({key: z.string(), at: z.string()});

export const RENDER_PHASES = ['idle', 'submitting', 'queued', 'bundling', 'rendering', 'done', 'failed'] as const;

export const renderStateSchema = z.object({
  phase: z.enum(RENDER_PHASES),
  preset: z.enum(['draft', 'final']).optional(),
  jobId: z.string().optional(),
  progress: z.number().min(0).max(1),
  videoUrl: z.string().optional(),
  error: z.string().optional(),
  /** Hash of everything the render was made from. A mismatch means the video is out of date. */
  key: z.string().optional(),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
});

export const persistedStateSchema = z.object({
  config: projectConfigSchema,
  step: z.enum(STEP_IDS),
  script: scriptSchema.nullable(),
  approval: approvalSchema.nullable(),
  render: renderStateSchema,
  sampleLoaded: z.boolean(),
  serverProjectId: z.string().optional(),
});

export type Feature = z.infer<typeof featureSchema>;
export type ProductInfo = z.infer<typeof productInfoSchema>;
export type BrandSettings = z.infer<typeof brandSettingsSchema>;
export type VideoSettings = z.infer<typeof videoSettingsSchema>;
export type ProjectConfig = z.infer<typeof projectConfigSchema>;
export type EditableScene = z.infer<typeof editableSceneSchema>;
export type Script = z.infer<typeof scriptSchema>;
export type ScriptSection = (typeof SCRIPT_SECTIONS)[number];
export type ScriptSource = (typeof SCRIPT_SOURCES)[number];
export type Approval = z.infer<typeof approvalSchema>;
export type RenderState = z.infer<typeof renderStateSchema>;
export type RenderPhase = (typeof RENDER_PHASES)[number];
export type StepId = (typeof STEP_IDS)[number];
export type VisualStyle = (typeof VISUAL_STYLES)[number];
export type PersistedState = z.infer<typeof persistedStateSchema>;