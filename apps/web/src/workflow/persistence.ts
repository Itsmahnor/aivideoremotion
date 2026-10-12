import {persistedStateSchema, type PersistedState} from '../domain/schemas';
import {newId} from '../domain/defaults';
import {RENDER_ACTIVE, type Notice, type WorkflowState} from './machine';

/**
 * Browser persistence for the current draft. Storage may be missing (private mode), full,
 * hold malformed JSON, or hold data from an older app version. None of that may crash the app.
 */

export const STORAGE_KEY = 'ai-video-studio:project:v2';
const LEGACY_KEYS = ['ai-video-studio:project:v1'];

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const safeStorage = (): StorageLike | null => {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
};

type Envelope = {version: 2; savedAt: string; state: unknown};

export const toPersisted = (state: WorkflowState): PersistedState => ({
  config: state.config,
  step: state.step,
  script: state.script,
  approval: state.approval,
  render: state.render,
  sampleLoaded: state.sampleLoaded,
  ...(state.serverProjectId ? {serverProjectId: state.serverProjectId} : {}),
});

export type LoadResult = {state: PersistedState | null; notice?: Notice; savedAt?: string};

const warn = (text: string): Notice => ({id: newId('n'), tone: 'warning', text});

/**
 * Reads and validates the saved draft.
 * A render that was mid-flight when the page closed keeps its job id so polling can resume;
 * one that never got a job id is marked as interrupted (we cannot know its outcome).
 */
export const loadDraft = (storage: StorageLike | null = safeStorage()): LoadResult => {
  if (!storage) return {state: null};
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return {state: null, notice: warn('Browser storage is not available, so this draft will not be kept after you close the page.')};
  }
  if (!raw) {
    const legacy = LEGACY_KEYS.some((key) => {
      try {
        return storage.getItem(key) !== null;
      } catch {
        return false;
      }
    });
    return legacy ? {state: null, notice: warn('A draft from an older version of the app was found but cannot be opened here. Started a new project.')} : {state: null};
  }
  let envelope: Envelope;
  try {
    envelope = JSON.parse(raw) as Envelope;
  } catch {
    quarantine(storage, raw);
    return {state: null, notice: warn('Your saved draft was damaged and could not be restored. Started a new project.')};
  }
  if (!envelope || typeof envelope !== 'object' || envelope.version !== 2) {
    quarantine(storage, raw);
    return {state: null, notice: warn('Your saved draft is from a different app version and could not be restored. Started a new project.')};
  }
  const parsed = persistedStateSchema.safeParse(envelope.state);
  if (!parsed.success) {
    quarantine(storage, raw);
    return {state: null, notice: warn('Your saved draft did not pass validation and could not be restored. Started a new project.')};
  }
  const state = parsed.data;
  if (RENDER_ACTIVE.includes(state.render.phase) && !state.render.jobId) {
    state.render = {...state.render, phase: 'failed', error: 'The page was closed before the render request was confirmed. Start it again.'};
  }
  return {state, savedAt: envelope.savedAt};
};

/** Keeps a copy of unreadable data instead of silently deleting the user's work. */
const quarantine = (storage: StorageLike, raw: string) => {
  try {
    storage.setItem(`${STORAGE_KEY}:unreadable`, raw);
    storage.removeItem(STORAGE_KEY);
  } catch {
    /* storage full or blocked: nothing more we can do */
  }
};

export const saveDraft = (state: WorkflowState, storage: StorageLike | null = safeStorage()): {ok: true; savedAt: string} | {ok: false; error: string} => {
  if (!storage) return {ok: false, error: 'Browser storage is not available.'};
  const savedAt = new Date().toISOString();
  try {
    const envelope: Envelope = {version: 2, savedAt, state: toPersisted(state)};
    storage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    return {ok: true, savedAt};
  } catch (error) {
    return {ok: false, error: (error as Error).name === 'QuotaExceededError' ? 'Browser storage is full.' : 'Could not save to browser storage.'};
  }
};

export const clearDraft = (storage: StorageLike | null = safeStorage()) => {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
};
