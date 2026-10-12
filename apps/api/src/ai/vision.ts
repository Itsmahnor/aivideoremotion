import fs from 'node:fs';
import path from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import {z} from 'zod';
import {labeledFocusRegionSchema, type UploadedAsset} from '@ai-video-studio/schema';
import {config} from '../config';
import {dirs, readJson, writeJson} from '../storage';
import {createClient} from './planner';
import {addUsage, emptyUsage, usageFromResponse, type Usage} from './usage';

const analysisSchema = z.object({
  description: z.string().min(1).max(500),
  focusRegions: z.array(labeledFocusRegionSchema).max(3),
});
type Analysis = z.infer<typeof analysisSchema>;

const MEDIA_TYPES: Record<string, 'image/png' | 'image/jpeg' | 'image/webp'> = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp'};

const PROMPT = `You look at a screenshot of a software product so a video director can zoom into the right part.
Return ONLY a JSON object:
{
  "description": "2-3 plain sentences: what screen this is and what is visible. Mention only what you can really see.",
  "focusRegions": [ {"label": "short name of a UI area, max 4 words", "x": 0.0, "y": 0.0, "w": 0.0, "h": 0.0} ]
}
Rules: 1 to 3 regions of the most important UI areas. x, y, w, h are fractions (0 to 1) of the image width/height; x,y is the top-left corner. Boxes must stay inside the image and be at least 0.15 wide and 0.1 high. Never invent UI that is not visible.`;

/** Local file for an uploaded asset url, or null for anything that is not one of our own uploads. */
export const uploadPathFromUrl = (url: string): string | null => {
  try {
    const {pathname} = new URL(url);
    if (!pathname.startsWith('/files/uploads/')) return null;
    const file = path.join(dirs.uploads, path.basename(pathname));
    return fs.existsSync(file) ? file : null;
  } catch {
    return null;
  }
};

const clampRegion = (region: Analysis['focusRegions'][number]) => {
  const x = Math.min(0.85, Math.max(0, region.x));
  const y = Math.min(0.9, Math.max(0, region.y));
  return {...region, x, y, w: Math.min(1 - x, Math.max(0.15, region.w)), h: Math.min(1 - y, Math.max(0.1, region.h))};
};

const mockAnalysis = (asset: UploadedAsset): Analysis => ({
  description: `Screenshot labelled "${asset.label}". (Mock analysis: no image was sent to Claude.)`,
  focusRegions: [{label: 'Main area', x: 0.25, y: 0.2, w: 0.5, h: 0.45}],
});

/** Describes a screenshot and finds focus regions. Result is cached next to the file. */
export const analyzeAsset = async (asset: UploadedAsset, options: {mock?: boolean; client?: Pick<Anthropic, 'messages'>} = {}): Promise<{asset: UploadedAsset; usage: Usage}> => {
  let usage = emptyUsage();
  const file = uploadPathFromUrl(asset.url);
  if (asset.kind !== 'screenshot' || !file) return {asset, usage};

  const cacheFile = `${file}.analysis.json`;
  let analysis = readJson<Analysis>(cacheFile);
  if (!analysis) {
    if (options.mock ?? config.mockAi) {
      analysis = mockAnalysis(asset);
    } else {
      const mediaType = MEDIA_TYPES[path.extname(file).toLowerCase()];
      if (!mediaType) return {asset, usage};
      const client = options.client ?? (await createClient());
      const response = await client.messages.create({
        model: config.model,
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: [
              {type: 'image', source: {type: 'base64', media_type: mediaType, data: fs.readFileSync(file).toString('base64')}},
              {type: 'text', text: `${PROMPT}\n\nThe user labelled this screenshot: "${asset.label}".`},
            ],
          },
        ],
      });
      usage = addUsage(usage, usageFromResponse(response));
      const text = response.content.map((block) => (block.type === 'text' ? block.text : '')).join('');
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start === -1 || end === -1) throw new Error('Image analysis returned no JSON.');
      analysis = analysisSchema.parse(JSON.parse(text.slice(start, end + 1)));
    }
    analysis = {...analysis, focusRegions: analysis.focusRegions.map(clampRegion)};
    writeJson(cacheFile, analysis);
  }
  return {asset: {...asset, description: asset.description || analysis.description, focusRegions: asset.focusRegions.length ? asset.focusRegions : analysis.focusRegions}, usage};
};
