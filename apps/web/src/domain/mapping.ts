import {
  type BrandKit,
  type Brief,
  type Storyboard,
  type TemplateName,
} from '@ai-video-studio/schema';
import {hashOf} from './hash';
import type {EditableScene, ProductInfo, ProjectConfig, Script, ScriptSection, ScriptSource} from './schemas';

/**
 * Maps the frontend project model onto the contracts the existing generation pipeline understands
 * (BrandKit + Brief from @ai-video-studio/schema). Everything is trimmed here, once.
 */

const MAX_PROMPT = 1500;

export const VISUAL_STYLE_DIRECTION: Record<ProjectConfig['video']['visualStyle'], string> = {
  'modern-saas': 'Modern SaaS: crisp, product-first, confident pacing.',
  minimal: 'Minimal: lots of space, few words per scene, calm pacing.',
  cinematic: 'Cinematic: dramatic hook, slower reveals, emotional build-up.',
  corporate: 'Corporate: measured, trustworthy, precise wording.',
  playful: 'Playful: light, upbeat wording and a bit of humour.',
};

/** Extra direction for the script writer, built from fields the Brief schema has no slot for. Always fits 1500 chars. */
export const composeDirection = (config: ProjectConfig): string => {
  const p = config.product;
  const parts = [
    p.description.trim() && `About the product (user's own words): ${p.description.trim()}`,
    p.targetAudience.trim() && `Target audience: ${p.targetAudience.trim()}`,
    p.benefits.trim() && `Key benefits: ${p.benefits.trim()}`,
    p.objectiveNotes.trim() && `Marketing objective: ${p.objectiveNotes.trim()}`,
    `Visual style: ${VISUAL_STYLE_DIRECTION[config.video.visualStyle]}`,
  ].filter(Boolean) as string[];
  const text = parts.join('\n');
  return text.length <= MAX_PROMPT ? text : `${text.slice(0, MAX_PROMPT - 1).trimEnd()}…`;
};

export const toBrandKit = (config: ProjectConfig): BrandKit => {
  const {brand, product, video} = config;
  return {
    name: brand.name.trim() || product.productName.trim() || 'Untitled',
    logoUrl: brand.logoUrl,
    colors: brand.colors,
    fonts: brand.fonts,
    tone: brand.tone.trim() || `${product.tone[0]!.toUpperCase()}${product.tone.slice(1)}`,
    motionStyle: video.motionStyle,
    rules: {dos: brand.rules.dos.map((r) => r.trim()).filter(Boolean), donts: brand.rules.donts.map((r) => r.trim()).filter(Boolean)},
  };
};

export const toBrief = (config: ProjectConfig): Brief => {
  const {product, video} = config;
  const proof = product.customerCount.trim() ? {stats: [], customerCount: product.customerCount.trim()} : undefined;
  return {
    videoType: 'saas-explainer',
    subtype: video.subtype,
    aspectRatio: video.aspectRatio,
    durationSec: video.durationSec,
    userPrompt: composeDirection(config),
    assets: config.assets,
    details: {
      productName: product.productName.trim(),
      oneLiner: product.oneLiner.trim(),
      problem: product.problem.trim(),
      keyFeatures: product.features.map((f) => ({title: f.title.trim(), description: f.description.trim()})),
      ...(proof ? {proof} : {}),
      audience: product.audienceSegment,
      goal: product.goal || 'signups',
      tone: product.tone,
      cta: {type: product.cta.type, text: product.cta.text.trim(), url: product.cta.url.trim()},
    },
  };
};

// ---------------------------------------------------------------- script <-> storyboard

export const DEFAULT_SECTION: Record<TemplateName, ScriptSection> = {
  HookStatement: 'hook',
  ProductReveal: 'introduction',
  ScreenshotShowcase: 'feature',
  FeatureSpotlight: 'feature',
  StepFlow: 'feature',
  CTAEndCard: 'cta',
    CustomScene: 'feature',
};

export const SECTION_LABEL: Record<ScriptSection, string> = {
  hook: 'Opening hook',
  problem: 'Problem',
  introduction: 'Product introduction',
  feature: 'Feature demo',
  benefit: 'Benefit',
  cta: 'Call to action',
};

/** Hash of the product facts a script is written from. */
export const productHash = (product: ProductInfo): string =>
  hashOf({...product, features: product.features.map(({title, description}) => ({title: title.trim(), description: description.trim()}))});

export const fromStoryboard = (storyboard: Storyboard, source: ScriptSource, config: ProjectConfig, extra: {warnings?: string[]; notes?: string[]; costUsd?: number} = {}): Script => ({
  title: storyboard.title,
  scenes: storyboard.scenes.map(
    (scene): EditableScene => ({
      id: scene.id,
      template: scene.template,
      section: DEFAULT_SECTION[scene.template],
      purpose: scene.purpose,
      narration: '',
      durationSec: scene.durationSec,
      props: scene.props,
      ...(scene.assetId ? {assetId: scene.assetId} : {}),
      ...(scene.focusRegionLabel ? {focusRegionLabel: scene.focusRegionLabel} : {}),
    }),
  ),
  source,
  generatedAt: new Date().toISOString(),
  basedOn: productHash(config.product),
  warnings: extra.warnings ?? [],
  notes: extra.notes ?? [],
  ...(extra.costUsd !== undefined ? {costUsd: extra.costUsd} : {}),
});

/** Strips frontend-only fields (section, narration) to get the storyboard the compiler understands. */
export const toStoryboard = (script: Script): Storyboard => ({
  title: script.title,
  scenes: script.scenes.map(({section: _s, narration: _n, ...scene}) => scene),
});

export const SOURCE_LABEL: Record<ScriptSource, string> = {
  'claude-api': 'Written by Claude (API)',
  'claude-chat': 'Pasted from a Claude chat',
  'template-draft': 'Template draft (rule-based, not AI)',
};
