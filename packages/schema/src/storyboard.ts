import {z} from 'zod';
import type {BrandKit} from './brand-kit';
import type {Brief} from './brief';
import {createSceneJsonSchema, type SceneJSON} from './scene-json';
import {TEMPLATE_META, TEMPLATE_NAMES, TEMPLATE_PROPS, onScreenWords, readingSeconds, type TemplateName} from './templates';

/**
 * Storyboard rules shared by the API (AI planner) and the web app (editing + live preview).
 * Pure functions only: no network, no file system, no AI.
 */

export type PlanInput = {brand: BrandKit; brief: Brief};

// ---------------------------------------------------------------- storyboard (what the AI returns)

export const storyboardSchema = z.object({
  title: z.string(),
  scenes: z
    .array(
      z.object({
        id: z.string().min(1),
        template: z.enum(TEMPLATE_NAMES),
        purpose: z.string().max(140),
        durationSec: z.number(),
        props: z.record(z.string(), z.unknown()),
        assetId: z.string().optional(),
        narration: z.string().max(300).optional(),
        focusRegionLabel: z.string().optional(),
      }),
    )
    .min(3),
});
export type Storyboard = z.infer<typeof storyboardSchema>;
type StoryScene = Storyboard['scenes'][number];

export const SCENE_COUNT: Record<number, [number, number]> = {15: [3, 4], 30: [5, 6], 60: [8, 10], 90: [11, 14]};
export const VIDEO_SIZE = {'16:9': {width: 1920, height: 1080}, '9:16': {width: 1080, height: 1920}, '1:1': {width: 1080, height: 1080}} as const;
export const MOTION_TRANSITION = {
  calm: {type: 'fade', frames: 15},
  energetic: {type: 'slide', frames: 8},
  playful: {type: 'wipe', frames: 12},
  corporate: {type: 'fade', frames: 12},
} as const;
export const FPS = 30;

/** Scene length from its content: reading time, plus extra time for a real screenshot. Clamped to 3..12 seconds. */
export const sceneSeconds = (scene: StoryScene): number => {
  const words = onScreenWords(scene.props);
  const shotExtra = scene.assetId && TEMPLATE_META[scene.template].usesScreenshot ? 2.5 : 0;
  const reading = 1.5 + words / 3 + shotExtra;
  return Math.min(12, Math.max(3, scene.durationSec, reading));
};

/** Scene count range for a target length. With no target (auto length), any count from 3 to 14 is allowed. */
export const sceneCountFor = (durationSec: number | undefined): [number, number] => (durationSec ? (SCENE_COUNT[durationSec] ?? [3, 14]) : [3, 14]);

// ---------------------------------------------------------------- checks

const checkCustomScene = (scene: StoryScene, assets: Brief['assets'], errors: string[]): void => {
  const layers = Array.isArray(scene.props.layers) ? (scene.props.layers as Record<string, unknown>[]) : [];
  layers.forEach((layer, index) => {
    const label = `Scene ${scene.id} layer ${index + 1} (${String(layer.type)})`;
    const [x, y, w, h] = ['x', 'y', 'w', 'h'].map((key) => Number(layer[key]));
    if (x + w > 100.5 || y + h > 100.5) errors.push(`${label}: the box leaves the screen. x + w and y + h must each be at most 100.`);
    if (layer.type === 'text' && !String(layer.text ?? '').trim()) errors.push(`${label}: text layers need "text".`);
    if (layer.type === 'counter' && typeof layer.value !== 'number') errors.push(`${label}: counter layers need "value".`);
    if (typeof layer.assetId === 'string') {
      const asset = assets.find((item) => item.id === layer.assetId);
      if (!asset) errors.push(`${label}: assetId "${layer.assetId}" does not exist.`);
      else if (asset.kind === 'logo') errors.push(`${label}: logo assets cannot be used as screenshots.`);
    }
  });
};

export const checkStoryboard = (storyboard: Storyboard, {brief}: PlanInput): {errors: string[]; warnings: string[]} => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const [min, max] = sceneCountFor(brief.durationSec);
  const {scenes} = storyboard;
  if (scenes.length < min || scenes.length > max) {
    errors.push(`Scene count is ${scenes.length}; it must be ${min}-${max}${brief.durationSec ? ` for a ${brief.durationSec}s video` : ''}.`);
  }

  const ids = new Set<string>();
  scenes.forEach((scene, index) => {
    if (ids.has(scene.id)) errors.push(`Duplicate scene id "${scene.id}".`);
    ids.add(scene.id);
    const parsed = TEMPLATE_PROPS[scene.template].safeParse(scene.props);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => errors.push(`Scene ${scene.id} (${scene.template}) props.${issue.path.join('.') || '(root)'}: ${issue.message}`));
    }
    if (scene.template === 'CTAEndCard' && index !== scenes.length - 1) errors.push(`CTAEndCard must only be the last scene (found in ${scene.id}).`);
    if (scene.template === 'CustomScene') checkCustomScene(scene, brief.assets, errors);
    if (scene.assetId) {
      const asset = brief.assets.find((item) => item.id === scene.assetId);
      if (!asset) errors.push(`Scene ${scene.id}: assetId "${scene.assetId}" does not exist.`);
      else if (asset.kind === 'logo') errors.push(`Scene ${scene.id}: logo assets cannot be used as screenshots.`);
      else if (scene.focusRegionLabel && !asset.focusRegions.some((region) => region.label === scene.focusRegionLabel)) {
        errors.push(`Scene ${scene.id}: focusRegionLabel "${scene.focusRegionLabel}" is not a region of asset ${asset.id}.`);
      }
      if (!TEMPLATE_META[scene.template].usesScreenshot) warnings.push(`Scene ${scene.id}: ${scene.template} ignores assetId.`);
    }
    const words = onScreenWords(scene.props);
    if (words > TEMPLATE_META[scene.template].maxWords) warnings.push(`Scene ${scene.id}: ${words} words (soft limit ${TEMPLATE_META[scene.template].maxWords}).`);
  });

  const first = scenes[0]?.template;
  if (first !== 'HookStatement' && first !== 'ProductReveal' && first !== 'CustomScene') errors.push('First scene must be HookStatement, ProductReveal or CustomScene.');
  if (scenes[scenes.length - 1]?.template !== 'CTAEndCard') errors.push('Last scene must be CTAEndCard.');
  const count = (template: TemplateName) => scenes.filter((scene) => scene.template === template).length;
  if (count('CTAEndCard') !== 1) errors.push('Use CTAEndCard exactly once.');
  if (count('ProductReveal') > 1) errors.push('Use ProductReveal at most once.');
  if (count('HookStatement') > 1) errors.push('Use HookStatement at most once.');
  if (count('FeatureSpotlight') > 3) errors.push('Use at most 3 FeatureSpotlight scenes.');
  if (count('StepFlow') > 1) errors.push('Use StepFlow at most once.');
  if (count('CustomScene') > 3) errors.push('Use at most 3 CustomScene scenes.');
  return {errors, warnings};
};

// ---------------------------------------------------------------- compile (deterministic, no AI)

const buildCaptions = (
  storyboardScenes: Storyboard['scenes'],
  compiled: {durationInFrames: number; transitionOut: {durationInFrames: number}}[],
): {text: string; startMs: number; endMs: number}[] => {
  const captions: {text: string; startMs: number; endMs: number}[] = [];
  let start = 0;
  storyboardScenes.forEach((scene, index) => {
    const timing = compiled[index]!;
    const text = (scene.narration ?? '').trim();
    if (text) {
      captions.push({
        text,
        startMs: Math.round((start / FPS) * 1000),
        endMs: Math.round(((start + timing.durationInFrames) / FPS) * 1000),
      });
    }
    // Transitions overlap the next scene, so the next scene starts earlier.
    start += timing.durationInFrames - timing.transitionOut.durationInFrames;
  });
  return captions;
};

export const compileStoryboard = (storyboard: Storyboard, {brand, brief}: PlanInput): {sceneJson: SceneJSON; notes: string[]} => {
  const notes: string[] = [];
  const transition = MOTION_TRANSITION[brand.motionStyle];

  // Length follows the content. A target length only nudges it, by at most 15%.
  let seconds = storyboard.scenes.map(sceneSeconds);
  const overlap = ((storyboard.scenes.length - 1) * transition.frames) / FPS;
  const sum = seconds.reduce((a, b) => a + b, 0);

  if (brief.durationSec) {
    const factor = Math.min(1.15, Math.max(0.85, (brief.durationSec + overlap) / sum));
    seconds = seconds.map((value) => value * factor);
  }
  const actual = seconds.reduce((a, b) => a + b, 0) - overlap;
  notes.push(`Video length: ${actual.toFixed(1)}s (content based).`);

  const scenes = storyboard.scenes.map((scene, index) => {
    const props: Record<string, unknown> = {...scene.props};
    delete props.screenshotUrl;
    delete props.focusRegion;
    const asset = brief.assets.find((item) => item.id === scene.assetId);
    if (asset && TEMPLATE_META[scene.template].usesScreenshot) {
      props.screenshotUrl = asset.url;
      const region = asset.focusRegions.find((item) => item.label === scene.focusRegionLabel);
      if (region && scene.template === 'ScreenshotShowcase') props.focusRegion = {x: region.x, y: region.y, w: region.w, h: region.h};
    }
    // Link each CustomScene layer's assetId to its screenshot URL.
    if (scene.template === 'CustomScene' && Array.isArray(props.layers)) {
      props.layers = (props.layers as Record<string, unknown>[]).map(({screenshotUrl: _drop, ...layer}) => {
        const layerAsset = typeof layer.assetId === 'string' ? brief.assets.find((item) => item.id === layer.assetId) : undefined;
        return layerAsset ? {...layer, screenshotUrl: layerAsset.url} : layer;
      });
    }
    const last = index === storyboard.scenes.length - 1;
    return {
      id: scene.id,
      template: scene.template,
      durationInFrames: Math.round((seconds[index] ?? 3) * FPS),
      props: TEMPLATE_PROPS[scene.template].parse(props) as Record<string, unknown>,
      transitionOut: last ? ({type: 'none', durationInFrames: 0} as const) : ({type: transition.type, durationInFrames: transition.frames} as const),
    };
  });

  const candidate = {
    version: 1 as const,
    meta: {fps: FPS, ...VIDEO_SIZE[brief.aspectRatio]},
    scenes,
    audio: {},
    captions: brand.captions.enabled ? buildCaptions(storyboard.scenes, scenes) : [],
  };
  // Final gate: the exact schema Remotion's DynamicVideo uses.
  const sceneJson = createSceneJsonSchema(TEMPLATE_PROPS).parse(candidate);
  return {sceneJson, notes};
};

// ---------------------------------------------------------------- pasted text

/** Pulls the JSON object out of a pasted chat reply (tolerates ```json fences and surrounding prose). */
export const extractJsonFromText = (text: string): unknown => {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON found. Paste the full JSON reply from Claude, starting with { and ending with }.');
  return JSON.parse(cleaned.slice(start, end + 1));
};