import type Anthropic from '@anthropic-ai/sdk';
import {
  SCENE_COUNT,
  buildCatalogText,
  checkStoryboard,
  compileStoryboard,
  extractJsonFromText,
  getTotalDurationInFrames,
  storyboardSchema,
  type PlanInput,
  type SceneJSON,
  type Storyboard,
  type TemplateName,
} from '@ai-video-studio/schema';
import {config} from '../config';
import {loadSkills} from './skills';
import {addUsage, costUsd, emptyUsage, usageFromResponse, type Usage} from './usage';

// Pure storyboard rules live in @ai-video-studio/schema so the web app can validate and preview edits with the same code.
export {FPS, SCENE_COUNT, checkStoryboard, compileStoryboard, storyboardSchema, type PlanInput, type Storyboard} from '@ai-video-studio/schema';

// ---------------------------------------------------------------- prompts

const ROLE = `You are the creative director of an automated SaaS explainer video tool.
You do NOT write code. You choose scene templates from the catalog and fill in their props with short on-screen text.
The video has no voiceover, so on-screen text carries the whole story.
Return ONLY one JSON object, no markdown fences, no commentary.`;

const OUTPUT_SHAPE = `JSON shape:
{
  "title": "short internal title",
  "scenes": [
    {
      "id": "s1",
      "template": "HookStatement",
      "purpose": "why this scene exists, max 140 chars",
      "durationSec": 3.5,
      "props": { ...only props defined for that template... },
      "assetId": "optional id from the asset list (screenshot templates only)",
      "focusRegionLabel": "optional region label of that asset (ScreenshotShowcase only)"
    }
  ]
}`;

export const buildUserMessage = ({brand, brief}: PlanInput): string => {
  const [min, max] = SCENE_COUNT[brief.durationSec];
  const payload = {
    
    brand: {name: brand.name, tone: brand.tone, motionStyle: brand.motionStyle, donts: brand.rules.donts},
    videoType: brief.subtype,
    targetDurationSec: brief.durationSec,
    aspectRatio: brief.aspectRatio,
    audience: brief.details.audience,
    goal: brief.details.goal,
    tone: brief.details.tone,
    product: {name: brief.details.productName, oneLiner: brief.details.oneLiner, problem: brief.details.problem},
    keyFeatures: brief.details.keyFeatures,
    proof: brief.details.proof ?? null,
    cta: brief.details.cta,
    userPrompt: brief.userPrompt,
    assets: brief.assets.map((asset) => ({
      id: asset.id,
      kind: asset.kind,
      label: asset.label,
      description: asset.description ?? '',
      regionLabels: asset.focusRegions.map((region) => region.label),
    })),
  };
   return `Create the video plan for this brief.\nScene count must be ${min}-${max}. Total duration must be within 10% of ${brief.durationSec}s.\nFirst scene: HookStatement, ProductReveal or CustomScene. Last scene: CTAEndCard (only once).\n\nBRIEF:\n${JSON.stringify(payload, null, 2)}\n\n${OUTPUT_SHAPE}`;
};

// ---------------------------------------------------------------- mock planner (free; tests the whole app without Claude)

const cut = (text: string, max: number): string => (text.length <= max ? text : text.slice(0, max - 1).trimEnd());

export const mockStoryboard = ({brief}: PlanInput): Storyboard => {
  const {details} = brief;
  const shot = brief.assets.find((asset) => asset.kind === 'screenshot');
  const features = details.keyFeatures.slice(0, 3);
  const icons = ['chart', 'bolt', 'shield'] as const;
  const make = (template: TemplateName, props: Record<string, unknown>, extra: Partial<Storyboard['scenes'][number]> = {}) => ({
    id: 'x',
    template,
    purpose: `Mock ${template}`,
    durationSec: 4,
    props,
    ...extra,
  });
  const hook = make('HookStatement', {line: cut(details.problem, 60), emphasisWords: [], style: 'word-by-word'});
  const reveal = make('ProductReveal', {productName: cut(details.productName, 30), tagline: cut(details.oneLiner, 60)}, shot ? {assetId: shot.id} : {});
  const feature = (index: number) => {
    const item = features[index % features.length]!;
    return make('FeatureSpotlight', {icon: icons[index % 3], title: cut(item.title, 30), description: cut(item.description, 90)});
  };
  const showcase = () =>
    make('ScreenshotShowcase', {caption: cut(features[0]!.title, 60), showCursor: true}, shot ? {assetId: shot.id, ...(shot.focusRegions[0] ? {focusRegionLabel: shot.focusRegions[0].label} : {})} : {});
  const steps = make('StepFlow', {steps: (features.length >= 2 ? features : [...features, ...features]).slice(0, 3).map((item) => ({label: cut(item.title, 24)}))});
  const cta = make('CTAEndCard', {cta: cut(details.cta.text, 30), url: cut(details.cta.url, 40)});

  const byLength: Record<number, ReturnType<typeof make>[]> = {
    15: [hook, reveal, cta],
    30: [hook, reveal, feature(0), feature(1), feature(2), cta],
    60: [hook, reveal, showcase(), feature(0), feature(1), feature(2), steps, showcase(), cta],
    90: [hook, reveal, showcase(), feature(0), feature(1), feature(2), steps, showcase(), showcase(), showcase(), showcase(), cta],
  };
  const scenes = (byLength[brief.durationSec] ?? byLength[30]!).map((scene, index) => ({...scene, id: `s${index + 1}`}));
  return {title: `Mock plan for ${details.productName}`, scenes};
};

// ---------------------------------------------------------------- use Claude without an API key (chat copy/paste)

/** Everything Claude needs in one text: role, skills, template catalog and the brief. Paste it into claude.ai. */
export const buildFullPrompt = (input: PlanInput, skillsDir?: string): string =>
  [ROLE, loadSkills(input.brief.subtype, skillsDir), buildCatalogText(), buildUserMessage(input)].join('\n\n---\n\n');


/** Takes a storyboard written by Claude in the chat, checks it against the same rules, and compiles it. */
export const importStoryboard = (input: PlanInput, text: string): PlanResult => {
  let raw: unknown;
  try {
    raw = extractJsonFromText(text);
  } catch (error) {
    throw new Error(`Could not read the pasted text as JSON: ${(error as Error).message}`);
  }
  const parsed = storyboardSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`The JSON does not match the plan format:\n- ${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n- ')}`);
  }
  const {errors, warnings} = checkStoryboard(parsed.data, input);
  if (errors.length > 0) throw new Error(`The plan breaks the rules. Ask Claude to fix these and paste again:\n- ${errors.join('\n- ')}`);
  const {sceneJson, notes} = compileStoryboard(parsed.data, input);
  return {storyboard: parsed.data, sceneJson, notes, warnings, usage: emptyUsage(), costUsd: 0, attempts: 0, mock: false};
};

// ---------------------------------------------------------------- Claude call

const extractJson = (text: string): unknown => {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in the model reply.');
  return JSON.parse(cleaned.slice(start, end + 1));
};

export type PlanResult = {
  storyboard: Storyboard;
  sceneJson: SceneJSON;
  notes: string[];
  warnings: string[];
  usage: Usage;
  costUsd: number;
  attempts: number;
  mock: boolean;
};

export type PlanOptions = {mock?: boolean; client?: Pick<Anthropic, 'messages'>; skillsDir?: string; log?: (message: string) => void};

export const generatePlan = async (input: PlanInput, options: PlanOptions = {}): Promise<PlanResult> => {
  const mock = options.mock ?? config.mockAi;
  let usage = emptyUsage();
  let attempts = 0;
  let storyboard: Storyboard;

  if (mock) {
    storyboard = mockStoryboard(input);
  } else {
    const client = options.client ?? (await createClient());
    const system = [
      {type: 'text' as const, text: ROLE},
      {type: 'text' as const, text: `${loadSkills(input.brief.subtype, options.skillsDir)}\n\n${buildCatalogText()}`, cache_control: {type: 'ephemeral' as const}},
    ];
    const messages: Anthropic.MessageParam[] = [{role: 'user', content: buildUserMessage(input)}];
    let lastErrors: string[] = [];
    let accepted: Storyboard | undefined;

    for (attempts = 1; attempts <= 3 && !accepted; attempts++) {
      const response = await client.messages.create({model: config.model, max_tokens: 6000, system, messages});
      usage = addUsage(usage, usageFromResponse(response));
      const text = response.content.map((block) => (block.type === 'text' ? block.text : '')).join('');

      let errors: string[] = [];
      try {
        const parsed = storyboardSchema.safeParse(extractJson(text));
        if (!parsed.success) errors = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
        else {
          errors = checkStoryboard(parsed.data, input).errors;
          if (errors.length === 0) accepted = parsed.data;
        }
      } catch (error) {
        errors = [(error as Error).message];
      }
      if (!accepted) {
        lastErrors = errors;
        options.log?.(`attempt ${attempts} had ${errors.length} problem(s), asking Claude to repair...`);
        messages.push({role: 'assistant', content: text});
        messages.push({role: 'user', content: `Your JSON has these problems. Fix ALL of them and return the full corrected JSON only:\n- ${errors.join('\n- ')}`});
      }
    }
    attempts -= 1;
    if (!accepted) throw new Error(`Claude could not produce a valid plan after 3 attempts:\n- ${lastErrors.join('\n- ')}`);
    storyboard = accepted;
  }

  const {sceneJson, notes} = compileStoryboard(storyboard, input);
  const {warnings} = checkStoryboard(storyboard, input);
  if (getTotalDurationInFrames(sceneJson) <= 0) throw new Error('Compiled video has no duration.');
  return {storyboard, sceneJson, notes, warnings, usage, costUsd: costUsd(usage), attempts, mock};
};

export const createClient = async (): Promise<Anthropic> => {
  if (!config.apiKey) throw new Error('ANTHROPIC_API_KEY is missing. Add it to apps/api/.env, or set MOCK_AI=1 to test without Claude.');
  const {default: AnthropicSdk} = await import('@anthropic-ai/sdk');
  return new AnthropicSdk({apiKey: config.apiKey});
};
