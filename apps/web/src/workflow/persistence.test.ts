import {describe, expect, it} from 'vitest';
import {approved} from '../test/fixtures';
import {loadDraft, saveDraft, STORAGE_KEY, toPersisted, type StorageLike} from './persistence';

const memory = (initial: Record<string, string> = {}): StorageLike & {data: Record<string, string>} => {
  const data = {...initial};
  return {
    data,
    getItem: (key) => (key in data ? data[key]! : null),
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
};

describe('local persistence', () => {
  it('round-trips the whole project', () => {
    const storage = memory();
    const state = approved();
    expect(saveDraft(state, storage).ok).toBe(true);
    const loaded = loadDraft(storage);
    expect(loaded.notice).toBeUndefined();
    expect(loaded.state).toEqual(JSON.parse(JSON.stringify(toPersisted(state))));
  });

  it('returns nothing (and no warning) when there is no draft', () => {
    expect(loadDraft(memory())).toEqual({state: null});
  });

  it('survives malformed JSON and keeps a copy of it', () => {
    const storage = memory({[STORAGE_KEY]: '{not json'});
    const loaded = loadDraft(storage);
    expect(loaded.state).toBeNull();
    expect(loaded.notice?.text).toMatch(/damaged/);
    expect(storage.data[`${STORAGE_KEY}:unreadable`]).toBe('{not json');
    expect(storage.data[STORAGE_KEY]).toBeUndefined();
  });

  it('rejects drafts from another version', () => {
    const loaded = loadDraft(memory({[STORAGE_KEY]: JSON.stringify({version: 1, state: {}})}));
    expect(loaded.state).toBeNull();
    expect(loaded.notice?.text).toMatch(/version/);
  });

  it('rejects drafts that fail validation (e.g. an invalid color)', () => {
    const storage = memory();
    saveDraft(approved(), storage);
    const envelope = JSON.parse(storage.data[STORAGE_KEY]!);
    envelope.state.config.brand.colors.primary = 'blue';
    storage.data[STORAGE_KEY] = JSON.stringify(envelope);
    const loaded = loadDraft(storage);
    expect(loaded.state).toBeNull();
    expect(loaded.notice?.text).toMatch(/validation/);
  });

  it('handles storage that throws', () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw Object.assign(new Error('full'), {name: 'QuotaExceededError'});
      },
      removeItem: () => undefined,
    };
    expect(loadDraft(broken).notice?.text).toMatch(/not available/);
    expect(saveDraft(approved(), broken)).toEqual({ok: false, error: 'Browser storage is full.'});
  });

  it('marks a render that never got a job id as interrupted', () => {
    const storage = memory();
    const state = approved();
    saveDraft({...state, render: {phase: 'submitting', progress: 0, preset: 'draft', key: 'k'}}, storage);
    expect(loadDraft(storage).state?.render.phase).toBe('failed');
  });

  it('keeps a render with a job id so polling can resume', () => {
    const storage = memory();
    const state = approved();
    saveDraft({...state, render: {phase: 'rendering', progress: 0.4, preset: 'draft', jobId: 'j1', key: 'k'}}, storage);
    expect(loadDraft(storage).state?.render).toMatchObject({phase: 'rendering', jobId: 'j1'});
  });
});
