import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';
import {z} from 'zod';
import {brandKitSchema} from './brand-kit';
import {briefSchema} from './brief';
import {createSceneJsonSchema, getTotalDurationInFrames, sceneJsonSchema} from './scene-json';
import {buildCatalogText, readingSeconds, TEMPLATE_NAMES, TEMPLATE_PROPS} from './templates';

const readFixture = async (name: string): Promise<unknown> => {
  const file = resolve(process.cwd(), 'src', 'fixtures', name);
  return JSON.parse(await readFile(file, 'utf8'));
};

describe('schema fixtures', () => {
  it('validates all supplied fixtures', async () => {
    expect(brandKitSchema.safeParse(await readFixture('brand-kit.json')).success).toBe(true);
    expect(brandKitSchema.safeParse(await readFixture('brand-kit-dark.json')).success).toBe(true);
    expect(briefSchema.safeParse(await readFixture('brief-saas-16x9.json')).success).toBe(true);
    expect(briefSchema.safeParse(await readFixture('brief-saas-9x16.json')).success).toBe(true);
    expect(sceneJsonSchema.safeParse(await readFixture('scene-json.json')).success).toBe(true);
  });

  it('rejects invalid data with clear errors', async () => {
    const brief = (await readFixture('brief-saas-9x16.json')) as Record<string, unknown>;
    expect(briefSchema.safeParse({...brief, aspectRatio: '4:3'}).error?.issues[0]?.path).toEqual(['aspectRatio']);
    expect(briefSchema.safeParse({...brief, durationSec: 45}).error?.issues[0]?.path).toEqual(['durationSec']);
    expect(brandKitSchema.safeParse({name: 'Incomplete'}).error?.issues[0]?.path).toEqual(['logoUrl']);
  });

  it('accepts relative audio paths and applies scene defaults', async () => {
    const base = (await readFixture('scene-json.json')) as Record<string, unknown>;
    const sceneJson = sceneJsonSchema.parse({...base, audio: {voiceoverUrl: '/content/demo-project/audio/vo.mp3'}});
    expect(sceneJson.audio.voiceoverUrl).toBe('/content/demo-project/audio/vo.mp3');
    expect(sceneJson.captions).toEqual([]);
    expect(sceneJson.scenes[5]?.transitionOut).toEqual({type: 'none', durationInFrames: 0});
  });

  it('rejects empty scene lists and duplicate scene ids', async () => {
    const sceneJson = sceneJsonSchema.parse(await readFixture('scene-json.json'));
    expect(sceneJsonSchema.safeParse({...sceneJson, scenes: []}).success).toBe(false);
    const duplicate = {...sceneJson, scenes: [sceneJson.scenes[0]!, {...sceneJson.scenes[5]!, id: 's1'}]};
    expect(sceneJsonSchema.safeParse(duplicate).error?.issues.some((issue) => issue.message.includes('must be unique'))).toBe(true);
  });

  it('rejects invalid scene transition timing', async () => {
    const sceneJson = sceneJsonSchema.parse(await readFixture('scene-json.json'));
    const longerTransition = {
      ...sceneJson,
      scenes: [{...sceneJson.scenes[0]!, transitionOut: {type: 'fade' as const, durationInFrames: 200}}, sceneJson.scenes[5]!],
    };
    expect(sceneJsonSchema.safeParse(longerTransition).success).toBe(false);

    const finalTransition = {
      ...sceneJson,
      scenes: [sceneJson.scenes[0]!, {...sceneJson.scenes[5]!, transitionOut: {type: 'wipe' as const, durationInFrames: 10}}],
    };
    expect(sceneJsonSchema.safeParse(finalTransition).error?.issues.some((issue) => issue.message.includes('last scene'))).toBe(true);
  });

  it('calculates total duration after transitions', async () => {
    const sceneJson = sceneJsonSchema.parse(await readFixture('scene-json.json'));
    // 135+150+180+150+180+120 = 915 frames minus 5 transitions of 12 frames
    expect(getTotalDurationInFrames(sceneJson)).toBe(855);
  });

  it('validates scene props through a registered template schema', () => {
    const schema = createSceneJsonSchema({headline: z.object({text: z.string().min(1)})});
    const result = schema.safeParse({
      version: 1,
      meta: {fps: 30, width: 1080, height: 1920},
      scenes: [
        {id: 'intro', template: 'headline', durationInFrames: 30, props: {text: ''}, transitionOut: {type: 'fade', durationInFrames: 10}},
        {id: 'outro', template: 'headline', durationInFrames: 30, props: {text: 'Done'}},
      ],
      audio: {},
      captions: [],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.message.includes('Invalid props for template "headline"'))).toBe(true);
    expect(result.error?.issues.some((issue) => issue.message.includes('text:'))).toBe(true);
  });
});

describe('template contract', () => {
  it('validates the scene fixture against the real template schemas', async () => {
    const result = createSceneJsonSchema(TEMPLATE_PROPS).safeParse(await readFixture('scene-json.json'));
    expect(result.success).toBe(true);
  });

  it('rejects props that break a template limit', () => {
    expect(TEMPLATE_PROPS.HookStatement.safeParse({line: 'x'.repeat(61)}).success).toBe(false);
    expect(TEMPLATE_PROPS.StepFlow.safeParse({steps: [{label: 'Only one'}]}).success).toBe(false);
  });

  it('builds a catalog that mentions every template and field description', () => {
    const catalog = buildCatalogText();
    TEMPLATE_NAMES.forEach((name) => expect(catalog).toContain(`## ${name}`));
    expect(catalog).toContain('Main hook line');
    expect(catalog).toContain('Ordered steps');
  });

  it('computes reading time inside the 3 to 8 second range', () => {
    expect(readingSeconds(2)).toBe(3);
    expect(readingSeconds(12)).toBe(5.5);
    expect(readingSeconds(100)).toBe(8);
  });
});
