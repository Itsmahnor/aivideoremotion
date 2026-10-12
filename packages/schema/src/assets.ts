import {z} from 'zod';
import {focusRegionSchema} from './templates';

export const labeledFocusRegionSchema = focusRegionSchema.extend({
  label: z.string().min(1).max(40).describe('Short name of the UI area, e.g. "Alerts panel"'),
});

export const uploadedAssetSchema = z.object({
  id: z.string().min(1),
  url: z.string().min(1).describe('Absolute URL, or a path inside packages/video/public'),
  kind: z.enum(['screenshot', 'logo', 'image']).default('screenshot'),
  label: z.string().min(1).max(60),
  purpose: z.string().max(120).optional(),
  description: z.string().max(500).optional().describe('Filled by AI vision after upload'),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  focusRegions: z.array(labeledFocusRegionSchema).max(3).default([]),
});

export type UploadedAsset = z.infer<typeof uploadedAssetSchema>;
