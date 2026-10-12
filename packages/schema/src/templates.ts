import {z} from 'zod';

/**
 * TEMPLATE CONTRACT: single source of truth for every scene template.
 * - The AI reads these schemas (via buildCatalogText) to know what it may fill in.
 * - Remotion templates in packages/video import the matching schema from here.
 * Rule: every prop has .describe() and a length limit.
 */

export const TEMPLATE_NAMES = [
  'HookStatement',
  'ProductReveal',
  'ScreenshotShowcase',
  'FeatureSpotlight',
  'StepFlow',
  'CTAEndCard',
] as const;
export type TemplateName = (typeof TEMPLATE_NAMES)[number];

export const focusRegionSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0).max(1),
    h: z.number().min(0).max(1),
  })
  .describe('Normalized box (0..1) of the key UI area inside the screenshot');

export const hookStatementProps = z.object({
  line: z.string().min(1).max(60).describe('Main hook line, max 8 words. A pain point or a bold claim.'),
  emphasisWords: z
    .array(z.string().min(1).max(20))
    .max(3)
    .default([])
    .describe('Words copied exactly from "line" to highlight in the accent color'),
  subline: z.string().max(70).optional().describe('Optional supporting line under the hook'),
  style: z.enum(['word-by-word', 'slide-up', 'scale-pop']).default('word-by-word').describe('Text entrance style'),
});

export const productRevealProps = z.object({
  productName: z.string().min(1).max(30).describe('Product name exactly as the user provided it'),
  tagline: z.string().min(1).max(60).describe('Short tagline, max 8 words'),
  screenshotUrl: z.string().optional().describe('Filled by the system from assetId. Never write this yourself.'),
  variant: z.enum(['rise', 'zoom-out']).default('rise').describe('How the product screen appears'),
});

export const screenshotShowcaseProps = z.object({
  screenshotUrl: z.string().optional().describe('Filled by the system from assetId. Never write this yourself.'),
  focusRegion: focusRegionSchema.optional().describe('Filled by the system from focusRegionLabel. Never write this yourself.'),
  caption: z.string().min(1).max(60).describe('One sentence that states what the viewer should notice'),
  callout: z
    .object({
      label: z.string().min(1).max(24).describe('Short label pointing at the region'),
      position: z.enum(['auto', 'top', 'bottom', 'left', 'right']).default('auto'),
    })
    .optional()
    .describe('Optional label with a line pointing at the focus region'),
  showCursor: z.boolean().default(true).describe('Show an animated cursor clicking the focus region'),
  device: z.enum(['browser', 'phone', 'none']).default('browser').describe('Frame around the screenshot'),
});

export const featureSpotlightProps = z.object({
  icon: z
    .enum(['chart', 'bolt', 'shield', 'users', 'clock', 'link', 'sparkle', 'lock', 'bell', 'layers'])
    .describe('Icon that best matches the feature'),
  title: z.string().min(1).max(30).describe('Feature name, max 4 words'),
  description: z.string().min(1).max(90).describe('One sentence on the benefit. Only use facts the user provided.'),
  screenshotUrl: z.string().optional().describe('Filled by the system from assetId. Never write this yourself.'),
  layout: z.enum(['left', 'right', 'stacked']).default('stacked').describe('Where the screen sits relative to the text'),
});

export const stepFlowProps = z.object({
  title: z.string().max(40).optional().describe('Optional heading above the steps'),
  steps: z
    .array(
      z.object({
        label: z.string().min(1).max(24).describe('Step name starting with a verb, e.g. "Connect your bank"'),
        description: z.string().max(70).optional().describe('Optional one-line detail'),
        screenshotUrl: z.string().optional().describe('Leave empty. The system shows a UI mock.'),
      }),
    )
    .min(2)
    .max(5)
    .describe('Ordered steps, 2 to 5'),
});

export const ctaEndCardProps = z.object({
  cta: z.string().min(1).max(30).describe('Call to action, max 6 words, e.g. "Start your free trial"'),
  url: z.string().min(1).max(40).describe('Website or sign-up URL exactly as the user provided it'),
  subline: z.string().max(60).optional().describe('Optional reassurance, e.g. "No credit card needed"'),
});

export const TEMPLATE_PROPS: Record<TemplateName, z.ZodType> = {
  HookStatement: hookStatementProps,
  ProductReveal: productRevealProps,
  ScreenshotShowcase: screenshotShowcaseProps,
  FeatureSpotlight: featureSpotlightProps,
  StepFlow: stepFlowProps,
  CTAEndCard: ctaEndCardProps,
};

export type TemplateMeta = {
  description: string;
  whenToUse: string;
  /** Templates whose props accept a screenshot (scene-level assetId is resolved into screenshotUrl). */
  usesScreenshot: boolean;
  /** Max on-screen words, used for pacing checks. */
  maxWords: number;
};

export const TEMPLATE_META: Record<TemplateName, TemplateMeta> = {
  HookStatement: {
    description: 'Big kinetic text on a branded animated background.',
    whenToUse: 'First scene. Opens with the audience pain or a bold claim. Use at most once, as scene 1.',
    usesScreenshot: false,
    maxWords: 10,
  },
  ProductReveal: {
    description: 'Logo, product name and tagline, then the product screen rises into a device frame.',
    whenToUse: 'Right after the hook or problem. Introduces the product. Use exactly once. Can be scene 1 for 15s videos.',
    usesScreenshot: true,
    maxWords: 10,
  },
  ScreenshotShowcase: {
    description: 'Device frame with zoom to one region, spotlight, callout and animated cursor click.',
    whenToUse: 'Prove ONE claim with a real screenshot. Needs an assetId to look real; without one a UI mock is shown. Max once per asset.',
    usesScreenshot: true,
    maxWords: 12,
  },
  FeatureSpotlight: {
    description: 'Icon, feature title and one-sentence benefit beside a screenshot.',
    whenToUse: 'Present exactly one user-provided feature. Use at most 3 per video.',
    usesScreenshot: true,
    maxWords: 14,
  },
  StepFlow: {
    description: 'Numbered steps connected by a line that draws in; the active step is highlighted.',
    whenToUse: 'Process explanations (how it works). Use at most once per video, 2 to 5 steps.',
    usesScreenshot: false,
    maxWords: 22,
  },
  CTAEndCard: {
    description: 'Centered call to action with logo, a pulsing button and the URL.',
    whenToUse: 'ALWAYS the last scene, exactly once.',
    usesScreenshot: false,
    maxWords: 10,
  },
};

// ---------- on-screen word counting (for pacing checks) ----------

const NON_TEXT_KEYS = new Set([
  'screenshotUrl', 'url', 'icon', 'style', 'variant', 'layout', 'device', 'position', 'showCursor', 'focusRegion',
]);

export const onScreenWords = (value: unknown, key = ''): number => {
  if (NON_TEXT_KEYS.has(key)) return 0;
  if (typeof value === 'string') return value.trim() ? value.trim().split(/\s+/).length : 0;
  if (Array.isArray(value)) return value.reduce<number>((sum, item) => sum + onScreenWords(item, key), 0);
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).reduce(
      (sum, [k, v]) => sum + (k === 'emphasisWords' ? 0 : onScreenWords(v, k)),
      0,
    );
  }
  return 0;
};

/** All visible text of a scene, in reading order (for the playground table). */
export const collectText = (value: unknown, key = ''): string[] => {
  if (NON_TEXT_KEYS.has(key)) return [];
  if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) return value.flatMap((item) => collectText(item, key));
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => (k === 'emphasisWords' ? [] : collectText(v, k)));
  }
  return [];
};

/** Reading-time rule: 1.5s + words/3, clamped to 3..8 seconds. */
export const readingSeconds = (words: number): number => Math.min(8, Math.max(3, 1.5 + words / 3));

// ---------- catalog text for the AI ----------

type JsonSchemaNode = {
  type?: string | string[];
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
  items?: JsonSchemaNode;
  enum?: unknown[];
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  minimum?: number;
  maximum?: number;
  description?: string;
  default?: unknown;
};

const toJsonSchema = (schema: z.ZodType): JsonSchemaNode => {
  const fn = (z as unknown as {toJSONSchema?: (s: z.ZodType, o?: {io?: 'input' | 'output'}) => unknown}).toJSONSchema;
  if (!fn) {
    throw new Error('z.toJSONSchema not found. This file needs zod v4. Run: npm i zod@^4 -w @ai-video-studio/schema');
  }
  return fn(schema, {io: 'input'}) as JsonSchemaNode;
};

const typeText = (node: JsonSchemaNode): string => {
  if (node.enum) return node.enum.map((v) => `'${String(v)}'`).join('|');
  const t = Array.isArray(node.type) ? node.type.join('|') : (node.type ?? 'any');
  const parts: string[] = [];
  if (t === 'string' && node.maxLength) parts.push(`max ${node.maxLength} chars`);
  if (t === 'array') parts.push(`${node.minItems ?? 0}-${node.maxItems ?? 'n'} items`);
  if (t === 'number' && node.minimum !== undefined && node.maximum !== undefined) parts.push(`${node.minimum}..${node.maximum}`);
  return parts.length ? `${t}, ${parts.join(', ')}` : t;
};

const fieldLines = (node: JsonSchemaNode, indent = 0): string[] => {
  const pad = '  '.repeat(indent);
  const required = new Set(node.required ?? []);
  const lines: string[] = [];
  for (const [name, prop] of Object.entries(node.properties ?? {})) {
    const def = prop.default !== undefined ? `, default ${JSON.stringify(prop.default)}` : '';
    const desc = prop.description ? `: ${prop.description}` : '';
    lines.push(`${pad}- ${name} (${typeText(prop)}, ${required.has(name) ? 'required' : 'optional'}${def})${desc}`);
    if (prop.type === 'object') lines.push(...fieldLines(prop, indent + 1));
    if (prop.type === 'array' && prop.items?.type === 'object') lines.push(...fieldLines(prop.items, indent + 1));
  }
  return lines;
};

export const buildCatalogText = (): string =>
  [
    '# TEMPLATE CATALOG',
    'You may ONLY use these templates and ONLY these props.',
    '',
    ...TEMPLATE_NAMES.flatMap((name) => [
      `## ${name}`,
      `What: ${TEMPLATE_META[name].description}`,
      `When to use: ${TEMPLATE_META[name].whenToUse}`,
      'Props:',
      ...fieldLines(toJsonSchema(TEMPLATE_PROPS[name])),
      '',
    ]),
  ].join('\n');
