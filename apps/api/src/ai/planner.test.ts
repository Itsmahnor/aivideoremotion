import {describe, expect, it} from 'vitest';
import brandFixture from '@ai-video-studio/schema/fixtures/brand-kit.json';
import briefFixture from '@ai-video-studio/schema/fixtures/brief-saas-16x9.json';
import {brandKitSchema, briefSchema, getTotalDurationInFrames, type Brief} from '@ai-video-studio/schema';
import {checkStoryboard, compileStoryboard, FPS, generatePlan, mockStoryboard, type PlanInput, type Storyboard} from './planner';

const brand = brandKitSchema.parse(brandFixture);
const makeInput = (overrides: Partial<Brief> = {}): PlanInput => ({brand, brief: briefSchema.parse({...briefFixture, ...overrides})});

describe('mock planner + compiler', () => {
  it.each([15, 30, 60, 90] as const)('produces a valid %is plan close to the target length', async (durationSec) => {
    const input = makeInput({durationSec});
    const storyboard = mockStoryboard(input);
    expect(checkStoryboard(storyboard, input).errors).toEqual([]);
    const {sceneJson} = compileStoryboard(storyboard, input);
    const seconds = getTotalDurationInFrames(sceneJson) / FPS;
    expect(Math.abs(seconds - durationSec) / durationSec).toBeLessThanOrEqual(0.12);
    expect(sceneJson.scenes.at(-1)?.transitionOut.type).toBe('none');
  });

  it('sets the video size from the aspect ratio', () => {
    const input = makeInput({aspectRatio: '9:16'});
    const {sceneJson} = compileStoryboard(mockStoryboard(input), input);
    expect(sceneJson.meta).toMatchObject({width: 1080, height: 1920});
  });
});

describe('checkStoryboard', () => {
  it('flags overlong text, a missing CTA and unknown assets', () => {
    const input = makeInput({durationSec: 15});
    const storyboard: Storyboard = {
      title: 'bad',
      scenes: [
        {id: 's1', template: 'HookStatement', purpose: 'x', durationSec: 4, props: {line: 'x'.repeat(80)}},
        {id: 's2', template: 'ProductReveal', purpose: 'x', durationSec: 4, props: {productName: 'Flowly', tagline: 'Tag'}, assetId: 'nope'},
        {id: 's3', template: 'FeatureSpotlight', purpose: 'x', durationSec: 4, props: {icon: 'bolt', title: 'T', description: 'D'}},
      ],
    };
    const {errors} = checkStoryboard(storyboard, input);
    expect(errors.some((error) => error.includes('props.line'))).toBe(true);
    expect(errors.some((error) => error.includes('Last scene must be CTAEndCard'))).toBe(true);
    expect(errors.some((error) => error.includes('assetId "nope"'))).toBe(true);
  });
});

describe('generatePlan with a fake Claude client', () => {
  const reply = (text: string) => ({
    content: [{type: 'text', text}],
    usage: {input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 500, cache_creation_input_tokens: 0},
  });

  it('repairs an invalid first answer and sums token usage', async () => {
    const input = makeInput({durationSec: 15});
    const good = JSON.stringify(mockStoryboard(input));
    const replies = ['not json at all', good];
    let calls = 0;
    const client = {messages: {create: async () => reply(replies[calls++]!)}};
    const result = await generatePlan(input, {mock: false, client: client as never});
    expect(result.attempts).toBe(2);
    expect(result.usage).toEqual({input: 2000, output: 400, cacheRead: 1000, cacheWrite: 0});
    expect(result.costUsd).toBeGreaterThan(0);
    expect(result.sceneJson.scenes.length).toBeGreaterThanOrEqual(3);
  });

  it('gives up with a clear error after 3 bad answers', async () => {
    const client = {messages: {create: async () => reply('{"title":"x","scenes":[]}')}};
    await expect(generatePlan(makeInput(), {mock: false, client: client as never})).rejects.toThrow(/after 3 attempts/);
  });
});

describe('chat copy/paste workflow', () => {
  it('builds a prompt that contains skills, the catalog and the brief', async () => {
    const {buildFullPrompt} = await import('./planner');
    const prompt = buildFullPrompt(makeInput());
    expect(prompt).toContain('## SKILL: onscreen-text');
    expect(prompt).toContain('## PLAYBOOK: problem-solution');
    expect(prompt).toContain('## HookStatement');
    expect(prompt).toContain('"name": "Flowly"');
  });

  it('imports the Flowly example plan (also with markdown fences) and rejects broken ones', async () => {
    const {importStoryboard} = await import('./planner');
    const {readFileSync} = await import('node:fs');
    const text = readFileSync(new URL('../../../../examples/flowly-plan.json', import.meta.url), 'utf8');
    const input = makeInput();
    const result = importStoryboard(input, '```json\n' + text + '\n```');
    expect(result.sceneJson.scenes).toHaveLength(6);
    expect(Math.abs(getTotalDurationInFrames(result.sceneJson) / FPS - 30)).toBeLessThan(3);
    expect(() => importStoryboard(input, 'hello')).toThrow(/Could not read/);
    expect(() => importStoryboard(input, text.replace('CTAEndCard', 'HookStatement'))).toThrow(/breaks the rules/);
  });
});
