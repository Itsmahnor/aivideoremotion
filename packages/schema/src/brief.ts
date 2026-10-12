import {z} from 'zod';
import {uploadedAssetSchema} from './assets';
import {EXPLAINER_SUBTYPES, saasExplainerDetailsSchema, VIDEO_TYPES} from './niche';

export const aspectRatioSchema = z.enum(['9:16', '1:1', '16:9']);

export const DURATIONS_SEC = [15, 30, 60, 90] as const;

export const briefSchema = z.object({
  videoType: z.literal(VIDEO_TYPES[0]),
  subtype: z.enum(EXPLAINER_SUBTYPES),
  aspectRatio: aspectRatioSchema,
  durationSec: z.literal(DURATIONS_SEC),
  userPrompt: z.string().max(1500),
  assets: z.array(uploadedAssetSchema).max(10).default([]),
  details: saasExplainerDetailsSchema,
});

export type Brief = z.infer<typeof briefSchema>;
