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
  'CustomScene',
] as const;
export const LAYER_TYPES = ['text', 'shape', 'image', 'device', 'counter'] as const;
export const LAYER_COLORS = ['text', 'muted', 'primary', 'secondary', 'accent', 'background', 'surface', 'onPrimary', 'onAccent'] as const;
export const ENTER_TYPES = ['fade', 'slide-up', 'slide-left', 'slide-right', 'pop', 'none'] as const;
export const TEXT_SIZES = ['caption', 'body', 'title', 'headline', 'display'] as const;

const percent = (what: string) => z.number().min(0).max(100).describe(what);

export const customLayerSchema = z.object({
  type: z
    .enum(LAYER_TYPES)
    .describe('text = words. shape = decoration or card behind other layers. image = an uploaded asset. device = an uploaded asset inside a browser or phone frame. counter = a number that counts up.'),
  x: percent('Left edge, percent of the safe area width (0-100)'),
  y: percent('Top edge, percent of the safe area height (0-100)'),
  w: z.number().min(1).max(100).describe('Width, percent of the safe area width. x + w must be at most 100.'),
  h: z.number().min(1).max(100).describe('Height, percent of the safe area height. y + h must be at most 100.'),
  text: z.string().max(80).optional().describe('Words to show. Required for type "text". Max 12 words.'),
  size: z.enum(TEXT_SIZES).default('title').describe('Text or counter size. display is the biggest.'),
  align: z.enum(['left', 'center', 'right']).default('left').describe('Text alignment inside its box'),
  color: z
    .enum(LAYER_COLORS)
    .default('text')
    .describe('Brand color token, never a hex code. Text on a primary shape needs onPrimary; on an accent shape needs onAccent.'),
  shape: z.enum(['rect', 'pill', 'circle']).default('rect').describe('Shape kind (type "shape" only)'),
  opacity: z.number().min(0).max(1).default(1).describe('1 = solid. Use 0.1 to 0.3 for soft decorations.'),
  value: z.number().optional().describe('Final number for type "counter". Only use numbers the user provided.'),
  decimals: z.number().int().min(0).max(2).default(0).describe('Decimals shown on a counter'),
  prefix: z.string().max(4).optional().describe('Before the counter number, e.g. "$"'),
  suffix: z.string().max(6).optional().describe('After the counter number, e.g. "x" or "%"'),
  device: z.enum(['browser', 'phone']).default('browser').describe('Frame for type "device"'),
  assetId: z.string().optional().describe('Id from the asset list. Only for image and device layers.'),
  screenshotUrl: z.string().optional().describe('Filled by the system from assetId. Never write this yourself.'),
  enter: z.enum(ENTER_TYPES).default('fade').describe('Entrance. slide-left enters from the left side, slide-right from the right side.'),
  delaySec: z.number().min(0).max(5).default(0).describe('Seconds before this layer appears. Stagger layers by 0.3 to 0.6s.'),
});

export const customSceneProps = z.object({
  background: z.enum(['gradient', 'grid', 'dots']).default('gradient').describe('Animated brand background behind the layers'),
  layers: z.array(customLayerSchema).min(1).max(12).describe('Drawn in order: first layer is at the back, last layer is on top. Max 12.'),
});
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
    CustomScene: customSceneProps,
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
    CustomScene: {
    description: 'A free layout built from layers (text, shape, image, device, counter) placed by percent, each with its own entrance animation.',
    whenToUse:
      'When the user asks for a specific layout or idea that no other template shows. Prefer a fixed template when one fits. Never use it for the final call to action.',
    usesScreenshot: false,
    maxWords: 30,
  },
};

// ---------- on-screen word counting (for pacing checks) ----------

const NON_TEXT_KEYS = new Set([
  'screenshotUrl', 'url', 'icon', 'style', 'variant', 'layout', 'device', 'position', 'showCursor', 'focusRegion',
  'size', 'align', 'color', 'shape', 'enter', 'assetId', 'background', 'type',
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
