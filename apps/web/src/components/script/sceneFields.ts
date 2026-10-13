import {z} from 'zod';
import {TEMPLATE_PROPS, type TemplateName} from '@ai-video-studio/schema';

/**
 * Which on-screen fields each template exposes in the editor.
 * Limits and option lists are NOT repeated here: they are read from the template contract
 * (packages/schema/src/templates.ts) so the editor can never drift from what the renderer accepts.
 */

export type FieldSpec =
  | {kind: 'text'; key: string; label: string; required?: boolean; multiline?: boolean; hint?: string}
  | {kind: 'select'; key: string; label: string}
  | {kind: 'bool'; key: string; label: string}
  | {kind: 'words'; key: string; label: string; hint?: string}
  | {kind: 'callout'; label: string}
  | {kind: 'steps'};

export const TEMPLATE_LABEL: Record<TemplateName, string> = {
  HookStatement: 'Hook statement',
  ProductReveal: 'Product reveal',
  ScreenshotShowcase: 'Screenshot showcase',
  FeatureSpotlight: 'Feature spotlight',
  StepFlow: 'Step-by-step flow',
  CTAEndCard: 'Call-to-action end card',
  // in TEMPLATE_LABEL:
  CustomScene: 'Custom scene',

};

export const TEMPLATE_FIELDS: Record<TemplateName, FieldSpec[]> = {
  // in TEMPLATE_FIELDS (editing is phase 2, so no fields yet):
  CustomScene: [],
  HookStatement: [
    {kind: 'text', key: 'line', label: 'Hook line', required: true, hint: 'A pain point or bold claim, about 8 words.'},
    {kind: 'text', key: 'subline', label: 'Supporting line'},
    {kind: 'words', key: 'emphasisWords', label: 'Highlighted words', hint: 'Up to 3 words from the hook line, separated by commas.'},
    {kind: 'select', key: 'style', label: 'Text animation'},
  ],
  ProductReveal: [
    {kind: 'text', key: 'productName', label: 'Product name', required: true},
    {kind: 'text', key: 'tagline', label: 'Tagline', required: true},
    {kind: 'select', key: 'variant', label: 'Reveal'},
  ],
  ScreenshotShowcase: [
    {kind: 'text', key: 'caption', label: 'Caption', required: true, hint: 'What the viewer should notice.'},
    {kind: 'callout', label: 'Callout label'},
    {kind: 'select', key: 'device', label: 'Frame'},
    {kind: 'bool', key: 'showCursor', label: 'Show animated cursor'},
  ],
  FeatureSpotlight: [
    {kind: 'text', key: 'title', label: 'Feature title', required: true},
    {kind: 'text', key: 'description', label: 'Benefit', required: true, multiline: true},
    {kind: 'select', key: 'icon', label: 'Icon'},
    {kind: 'select', key: 'layout', label: 'Layout'},
  ],
  StepFlow: [{kind: 'text', key: 'title', label: 'Heading'}, {kind: 'steps'}],
  CTAEndCard: [
    {kind: 'text', key: 'cta', label: 'Call to action', required: true},
    {kind: 'text', key: 'url', label: 'Link', required: true},
    {kind: 'text', key: 'subline', label: 'Reassurance line', hint: 'e.g. No credit card needed'},
  ],
};

type JsonNode = {type?: string; maxLength?: number; enum?: string[]; properties?: Record<string, JsonNode>; items?: JsonNode; minItems?: number; maxItems?: number};

const cache = new Map<TemplateName, JsonNode>();
const schemaOf = (template: TemplateName): JsonNode => {
  let node = cache.get(template);
  if (!node) {
    node = z.toJSONSchema(TEMPLATE_PROPS[template], {io: 'input'}) as unknown as JsonNode;
    cache.set(template, node);
  }
  return node;
};

/** Walks a dotted path ("callout.label", "steps.label") through the template's JSON schema. */
const nodeAt = (template: TemplateName, path: string): JsonNode | undefined =>
  path.split('.').reduce<JsonNode | undefined>((node, part) => {
    if (!node) return undefined;
    if (node.type === 'array') return node.items?.properties?.[part] ?? node.items;
    return node.properties?.[part];
  }, schemaOf(template));

export const maxLengthOf = (template: TemplateName, path: string): number | undefined => nodeAt(template, path)?.maxLength;
export const optionsOf = (template: TemplateName, path: string): string[] => nodeAt(template, path)?.enum ?? [];
export const itemRangeOf = (template: TemplateName, path: string): [number, number] => {
  const node = nodeAt(template, path);
  return [node?.minItems ?? 0, node?.maxItems ?? 10];
};

export const optionLabel = (value: string) => value.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
