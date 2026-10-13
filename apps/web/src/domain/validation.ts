import {
  SCENE_COUNT,
  TEMPLATE_META,
  TEMPLATE_PROPS,
  checkStoryboard,
  type TemplateName,
} from '@ai-video-studio/schema';
import type {ZodType} from 'zod';
import {paletteWarnings, type ContrastWarning} from './color';
import {toBrandKit, toBrief, toStoryboard} from './mapping';
import type {EditableScene, ProjectConfig, Script} from './schemas';

/**
 * All user-facing validation lives here, so components never re-implement rules.
 * Every value is trimmed before it is checked.
 */

/** Field path (e.g. "product.problem", "product.features.2.title") -> message. */
export type FieldErrors = Record<string, string>;

export const LIMITS = {
  productName: {min: 2, max: 30},
  oneLiner: {min: 10, max: 100},
  description: {min: 0, max: 600},
  problem: {min: 10, max: 200},
  featureTitle: {min: 2, max: 40},
  featureDescription: {min: 10, max: 140},
  benefits: {min: 0, max: 300},
  targetAudience: {min: 3, max: 120},
  objectiveNotes: {min: 0, max: 150},
  ctaText: {min: 2, max: 40},
  ctaUrl: {min: 4, max: 60},
  customerCount: {min: 0, max: 40},
  brandName: {min: 0, max: 40},
  brandTone: {min: 0, max: 80},
  assetLabel: {min: 1, max: 60},
  purpose: {min: 0, max: 140},
 narration: {min: 0, max: 140},
  features: {min: 1, max: 5},
} as const;

export const SCENE_SECONDS = {min: 3, max: 8} as const;

type Limit = {min: number; max: number};

/** Checks one text value. Returns an error message or undefined. */
export const checkText = (value: string, limit: Limit, label: string, required: boolean): string | undefined => {
  const text = value.trim();
  if (!text) return required ? `${label} is required.` : undefined;
  if (text.length < limit.min) return `${label} needs at least ${limit.min} characters (now ${text.length}).`;
  if (text.length > limit.max) return `${label} can be at most ${limit.max} characters (now ${text.length}).`;
  return undefined;
};

const URL_PATTERN = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(:\d{2,5})?(\/[^\s]*)?$/i;

export const checkUrl = (value: string): string | undefined => {
  const base = checkText(value, LIMITS.ctaUrl, 'Call-to-action link', true);
  if (base) return base;
  return URL_PATTERN.test(value.trim()) ? undefined : 'Enter a web address such as yourapp.com/start or https://yourapp.com.';
};

const put = (errors: FieldErrors, key: string, message: string | undefined) => {
  if (message) errors[key] = message;
};

// ---------------------------------------------------------------- step 1

export const validateProduct = (config: ProjectConfig): FieldErrors => {
  const p = config.product;
  const e: FieldErrors = {};
  put(e, 'product.productName', checkText(p.productName, LIMITS.productName, 'Product name', true));
  put(e, 'product.oneLiner', checkText(p.oneLiner, LIMITS.oneLiner, 'One-line description', true));
  put(e, 'product.description', checkText(p.description, LIMITS.description, 'Description', false));
  put(e, 'product.problem', checkText(p.problem, LIMITS.problem, 'Problem', true));
  if (p.features.length < LIMITS.features.min) e['product.features'] = 'Add at least one key feature.';
  if (p.features.length > LIMITS.features.max) e['product.features'] = `Use at most ${LIMITS.features.max} features.`;
  p.features.forEach((feature, i) => {
    put(e, `product.features.${i}.title`, checkText(feature.title, LIMITS.featureTitle, 'Feature name', true));
    put(e, `product.features.${i}.description`, checkText(feature.description, LIMITS.featureDescription, 'Feature description', true));
  });
  const titles = p.features.map((f) => f.title.trim().toLowerCase()).filter(Boolean);
  titles.forEach((title, i) => {
    if (titles.indexOf(title) !== i) e[`product.features.${i}.title`] ??= 'Each feature needs a different name.';
  });
  put(e, 'product.benefits', checkText(p.benefits, LIMITS.benefits, 'Benefits', false));
  put(e, 'product.targetAudience', checkText(p.targetAudience, LIMITS.targetAudience, 'Target audience', true));
  if (!p.goal) e['product.goal'] = 'Choose a marketing objective.';
  put(e, 'product.objectiveNotes', checkText(p.objectiveNotes, LIMITS.objectiveNotes, 'Objective details', false));
  put(e, 'product.cta.text', checkText(p.cta.text, LIMITS.ctaText, 'Call-to-action text', true));
  put(e, 'product.cta.url', checkUrl(p.cta.url));
  put(e, 'product.customerCount', checkText(p.customerCount, LIMITS.customerCount, 'Customer count', false));
  return e;
};

/** Soft hints that never block progress. */
export const productHints = (config: ProjectConfig): FieldErrors => {
  const hints: FieldErrors = {};
  const words = config.product.cta.text.trim().split(/\s+/).filter(Boolean).length;
  if (words > 6) hints['product.cta.text'] = `${words} words. Six or fewer reads best on the end card.`;
  return hints;
};

// ---------------------------------------------------------------- step 2

export const validateCustomization = (config: ProjectConfig, fonts: readonly string[]): FieldErrors => {
  const {brand, assets} = config;
  const e: FieldErrors = {};
  put(e, 'brand.name', checkText(brand.name, LIMITS.brandName, 'Brand name', false));
  put(e, 'brand.tone', checkText(brand.tone, LIMITS.brandTone, 'Brand voice', false));
  if (fonts.length > 0) {
    if (!fonts.includes(brand.fonts.heading)) e['brand.fonts.heading'] = 'Choose a supported heading font.';
    if (!fonts.includes(brand.fonts.body)) e['brand.fonts.body'] = 'Choose a supported body font.';
  }
  if (brand.gradient.angle < 0 || brand.gradient.angle > 360 || !Number.isFinite(brand.gradient.angle)) e['brand.gradient.angle'] = 'Angle must be between 0 and 360 degrees.';
  assets.forEach((asset) => put(e, `assets.${asset.id}.label`, checkText(asset.label, LIMITS.assetLabel, 'Screenshot label', true)));
  return e;
};

export const customizationWarnings = (config: ProjectConfig): ContrastWarning[] => paletteWarnings(config.brand.colors);

// ---------------------------------------------------------------- step 3

export type SceneIssues = {fields: FieldErrors; messages: string[]};
export type ScriptIssues = {errors: string[]; warnings: string[]; scenes: Record<string, SceneIssues>; valid: boolean};

const issuesFor = (schema: ZodType, value: unknown): FieldErrors => {
  const result = schema.safeParse(value);
  if (result.success) return {};
  const fields: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || 'props';
    fields[key] ??= issue.message;
  }
  return fields;
};

/** Errors for one scene: template props (from the shared template contract) plus frontend-only fields. */
export const validateScene = (scene: EditableScene, config: ProjectConfig): SceneIssues => {
  const fields = issuesFor(TEMPLATE_PROPS[scene.template], scene.props);
  const messages: string[] = [];
  put(fields, 'purpose', checkText(scene.purpose, LIMITS.purpose, 'Visual direction', false));
  put(fields, 'narration', checkText(scene.narration, LIMITS.narration, 'Narration', false));
  if (!Number.isFinite(scene.durationSec) || scene.durationSec < SCENE_SECONDS.min || scene.durationSec > SCENE_SECONDS.max) {
    fields.durationSec = `Use ${SCENE_SECONDS.min} to ${SCENE_SECONDS.max} seconds.`;
  }
  if (scene.template === 'HookStatement') {
    const line = String(scene.props.line ?? '').toLowerCase();
    const words = Array.isArray(scene.props.emphasisWords) ? (scene.props.emphasisWords as unknown[]) : [];
    const missing = words.filter((w) => typeof w === 'string' && !line.includes(w.toLowerCase()));
    if (missing.length > 0) fields.emphasisWords = `Highlighted words must appear in the hook line: ${missing.join(', ')}.`;
  }
  if (scene.assetId && !config.assets.some((a) => a.id === scene.assetId)) messages.push('The screenshot for this scene was removed. Pick another or none.');
  return {fields, messages};
};

/**
 * Full storyboard check. Combines per-scene field errors with the shared storyboard rules
 * (scene count, first/last scene, template limits) that the AI planner also enforces.
 */
export const validateScript = (script: Script | null, config: ProjectConfig): ScriptIssues => {
  if (!script || script.scenes.length === 0) {
    return {errors: ['The storyboard is empty. Generate a script or add scenes.'], warnings: [], scenes: {}, valid: false};
  }
  const scenes: Record<string, SceneIssues> = {};
  let sceneProblems = 0;
  for (const scene of script.scenes) {
    const issues = validateScene(scene, config);
    scenes[scene.id] = issues;
    sceneProblems += Object.keys(issues.fields).length + issues.messages.length;
  }
  const input = {brand: toBrandKit(config), brief: toBrief(config)};
  const shared = checkStoryboard(toStoryboard(script), input);
  // Prop errors are already shown per field; keep only storyboard-level rules here.
  const errors = shared.errors.filter((message) => !/ props\./.test(message));
  if (!script.title.trim()) errors.push('Give the storyboard a title.');
  if (script.title.trim().length > 80) errors.push('The storyboard title can be at most 80 characters.');
  const warnings = [...shared.warnings.filter((w) => !/ignores assetId/.test(w))];
  const covered = new Set(script.scenes.map((s) => s.section));
  if (!covered.has('problem') && !covered.has('hook')) warnings.push('No scene states the problem. Consider tagging the hook or another scene as "Problem".');
  if (!covered.has('feature') && !covered.has('benefit')) warnings.push('No scene shows a feature or benefit.');
  const valid = errors.length === 0 && sceneProblems === 0;
  if (sceneProblems > 0) errors.unshift(`${sceneProblems} field${sceneProblems === 1 ? '' : 's'} in the scenes need${sceneProblems === 1 ? 's' : ''} attention.`);
  return {errors, warnings, scenes, valid};
};

export const sceneCountRange = (durationSec: number): [number, number] => SCENE_COUNT[durationSec] ?? [3, 14];
export const templateLimitWords = (template: TemplateName): number => TEMPLATE_META[template].maxWords;

/** Order in which fields appear on screen, so "focus first error" lands on the top-most one. */
export const firstErrorKey = (errors: FieldErrors, order: string[]): string | undefined => order.find((key) => errors[key]) ?? Object.keys(errors)[0];
