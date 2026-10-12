import {afterEach, describe, expect, it, vi} from 'vitest';
import {toBrandKit, toBrief} from '../domain/mapping';
import {sampleConfig} from '../domain/defaults';
import {samplePlan} from '../test/fixtures';
import {createLocalApiServices} from './localApi';
import {ServiceError} from './types';

const online = (hasApiKey: boolean) => createLocalApiServices({state: 'online', health: {status: 'ok', mockAi: false, hasApiKey, model: 'claude-test'}});
const reply = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}}));

afterEach(() => vi.unstubAllGlobals());

describe('service availability is explicit', () => {
  it('reports everything unavailable when the API server is offline', async () => {
    const services = createLocalApiServices({state: 'offline', error: 'down'});
    expect(services.script.availability('claude-api').status).toBe('unavailable');
    expect(services.script.availability('template-draft').status).toBe('unavailable');
    expect(services.render.availability().status).toBe('unavailable');
    expect(services.assets.availability().status).toBe('unavailable');
    const config = sampleConfig();
    await expect(services.script.generate({brand: toBrandKit(config), brief: toBrief(config), mode: 'claude-api'})).rejects.toBeInstanceOf(ServiceError);
  });

  it('does not offer AI generation without a configured key', () => {
    const services = online(false);
    expect(services.script.availability('claude-api')).toMatchObject({status: 'unavailable'});
    expect(services.script.availability('template-draft').status).toBe('available');
  });

  it('voice-over is never claimed to be connected', async () => {
    const services = online(true);
    expect(services.voiceover.availability().status).toBe('unavailable');
    await expect(services.voiceover.synthesize({lines: [], voice: 'neutral', language: 'English'})).rejects.toThrow(/No voice-over provider/);
  });
});

describe('responses are validated', () => {
  it('maps a template draft to a non-AI source', async () => {
    vi.stubGlobal('fetch', reply({storyboard: samplePlan, notes: [], warnings: [], mock: true, attempts: 0, assets: []}));
    const config = sampleConfig();
    const result = await online(false).script.generate({brand: toBrandKit(config), brief: toBrief(config), mode: 'template-draft'});
    expect(result.source).toBe('template-draft');
  });

  it('rejects a malformed plan', async () => {
    vi.stubGlobal('fetch', reply({storyboard: {title: 'x', scenes: []}, mock: false, attempts: 1}));
    const config = sampleConfig();
    await expect(online(true).script.generate({brand: toBrandKit(config), brief: toBrief(config), mode: 'claude-api'})).rejects.toMatchObject({kind: 'invalid-response'});
  });

  it('surfaces server error messages', async () => {
    vi.stubGlobal('fetch', reply({error: 'Claude is overloaded'}, 529));
    const config = sampleConfig();
    await expect(online(true).script.generate({brand: toBrandKit(config), brief: toBrief(config), mode: 'claude-api'})).rejects.toMatchObject({kind: 'server', message: 'Claude is overloaded'});
  });

  it('maps render job states and only exposes a URL for finished jobs', async () => {
    vi.stubGlobal('fetch', reply({id: 'j1', status: 'error', progress: 0.2, error: 'no chrome'}));
    expect(await online(true).render.status('j1')).toEqual({jobId: 'j1', phase: 'failed', progress: 0.2, error: 'no chrome'});
    vi.stubGlobal('fetch', reply({id: 'j1', status: 'rendering', progress: 0.5, url: 'http://x/partial.mp4'}));
    expect((await online(true).render.status('j1')).videoUrl).toBeUndefined();
    vi.stubGlobal('fetch', reply({id: 'j1', status: 'done', progress: 1, url: 'http://x/final.mp4'}));
    expect((await online(true).render.status('j1')).videoUrl).toBe('http://x/final.mp4');
  });

  it('reports network failures as such', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    await expect(online(true).render.status('j1')).rejects.toMatchObject({kind: 'network'});
  });
});
