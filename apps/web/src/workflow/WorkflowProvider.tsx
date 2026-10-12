import {createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type FC, type ReactNode} from 'react';
import {compileStoryboard, extractJsonFromText, storyboardSchema, type SceneJSON} from '@ai-video-studio/schema';
import {fromStoryboard, toBrandKit, toBrief, toStoryboard} from '../domain/mapping';
import {newId} from '../domain/defaults';
import {validateScript} from '../domain/validation';
import {downscaleImage} from '../lib/image';
import {checkHealth, createLocalApiServices, type Connection} from '../services/localApi';
import {ServiceError, type ScriptGenerationMode, type Services} from '../services/types';
import {createReducer, initialState, isRendering, type MachineContext, type WorkflowAction, type WorkflowState} from './machine';
import {loadDraft, saveDraft, toPersisted} from './persistence';

export type SaveStatus = {state: 'idle'} | {state: 'saved'; at: string} | {state: 'error'; error: string};

type WorkflowContextValue = {
  state: WorkflowState;
  dispatch: (action: WorkflowAction) => void;
  ctx: MachineContext;
  services: Services;
  connection: Connection;
  recheckConnection: () => void;
  saveStatus: SaveStatus;
  /** The compiled SceneJSON for the current storyboard, or null when it has errors. */
  sceneJson: SceneJSON | null;
  actions: {
    generateScript: (mode: ScriptGenerationMode) => Promise<void>;
    cancelScript: () => void;
    importPastedPlan: (text: string) => string | null;
    chatPrompt: () => Promise<string>;
    startRender: (preset: 'draft' | 'final') => Promise<void>;
    uploadLogo: (file: File) => Promise<string | null>;
    uploadScreenshots: (files: File[]) => Promise<string[]>;
    saveToServer: () => Promise<void>;
    openFromServer: (id: string) => Promise<void>;
  };
};

const WorkflowContext = createContext<WorkflowContextValue | null>(null);

export const useWorkflow = (): WorkflowContextValue => {
  const value = useContext(WorkflowContext);
  if (!value) throw new Error('useWorkflow must be used inside <WorkflowProvider>.');
  return value;
};

const message = (error: unknown): string => (error instanceof Error ? error.message : 'Something went wrong.');
const IMAGE_TYPES = /^image\/(png|jpeg|webp)$/;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const WorkflowProvider: FC<{fonts: readonly string[]; children: ReactNode}> = ({fonts, children}) => {
  const ctx = useMemo<MachineContext>(() => ({fonts}), [fonts]);
  const reducer = useMemo(() => createReducer(ctx), [ctx]);
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const loaded = loadDraft();
    // Restore through the reducer so the same safety checks apply as for any other transition.
    return loaded.state ? reducer(initialState(), {type: 'project/hydrate', state: loaded.state, notice: loaded.notice}) : {...initialState(), notice: loaded.notice ?? null};
  });
  const stateRef = useRef(state);
  stateRef.current = state;

  // ---- connection to the API server
  const [connection, setConnection] = useState<Connection>({state: 'checking'});
  const recheckConnection = useCallback(() => {
    setConnection({state: 'checking'});
    checkHealth()
      .then((health) => setConnection({state: 'online', health}))
      .catch((error) => setConnection({state: 'offline', error: message(error)}));
  }, []);
  useEffect(recheckConnection, [recheckConnection]);
  const services = useMemo(() => createLocalApiServices(connection), [connection]);

  // ---- autosave (debounced) to this browser
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({state: 'idle'});
  const persisted = useMemo(() => JSON.stringify(toPersisted(state)), [state]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const result = saveDraft(stateRef.current);
      setSaveStatus(result.ok ? {state: 'saved', at: result.savedAt} : {state: 'error', error: result.error});
    }, 400);
    return () => window.clearTimeout(timer);
  }, [persisted]);

  // ---- warn before leaving while work is in flight
  const busy = state.busy.script || state.busy.uploads > 0 || isRendering(state);
  useEffect(() => {
    if (!busy) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [busy]);

  // ---- compiled preview (same compiler as the API)
  const sceneJson = useMemo<SceneJSON | null>(() => {
    if (!state.script || !validateScript(state.script, state.config).valid) return null;
    try {
      return compileStoryboard(toStoryboard(state.script), {brand: toBrandKit(state.config), brief: toBrief(state.config)}).sceneJson;
    } catch {
      return null;
    }
  }, [state.script, state.config]);

  // ---- render polling (also resumes after a reload)
  const jobId = state.render.jobId;
  const rendering = isRendering(state);
  useEffect(() => {
    if (!jobId || !rendering || connection.state !== 'online') return;
    let failures = 0;
    let stopped = false;
    const tick = async () => {
      try {
        const status = await services.render.status(jobId);
        failures = 0;
        if (stopped) return;
        dispatch({type: 'render/progress', jobId, phase: status.phase, progress: status.progress, videoUrl: status.videoUrl, error: status.error});
      } catch (error) {
        if (stopped) return;
        if (error instanceof ServiceError && error.status === 404) {
          dispatch({type: 'render/failed', jobId, error: 'The render server no longer knows this job (it may have restarted). Start the render again.'});
          return;
        }
        failures += 1;
        if (failures >= 4) dispatch({type: 'render/failed', jobId, error: `Lost contact with the render server: ${message(error)}`});
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 1500);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [jobId, rendering, connection.state, services]);

  // ---- operations
  const scriptAbort = useRef<AbortController | null>(null);

  const generateScript = useCallback(
    async (mode: ScriptGenerationMode) => {
      const before = stateRef.current;
      if (before.busy.script) return;
      dispatch({type: 'script/requested'});
      // The reducer may have rejected the request; only continue if it is now busy.
      const after = reducer(before, {type: 'script/requested'});
      if (!after.busy.script) return;
      const controller = new AbortController();
      scriptAbort.current = controller;
      try {
        const result = await services.script.generate({brand: toBrandKit(before.config), brief: toBrief(before.config), mode}, controller.signal);
        const script = fromStoryboard(result.storyboard, result.source, before.config, {warnings: result.warnings, notes: result.notes, costUsd: result.costUsd});
        dispatch({type: 'script/received', script, assets: result.assets.length > 0 ? result.assets : undefined});
      } catch (error) {
        dispatch({type: 'script/failed', error: controller.signal.aborted ? 'Generation was cancelled.' : message(error)});
      } finally {
        scriptAbort.current = null;
      }
    },
    [reducer, services],
  );

  const cancelScript = useCallback(() => scriptAbort.current?.abort(), []);

  const importPastedPlan = useCallback((text: string): string | null => {
    const current = stateRef.current;
    let raw: unknown;
    try {
      raw = extractJsonFromText(text);
    } catch (error) {
      return `Could not read the pasted text as JSON. ${message(error)}`;
    }
    const parsed = storyboardSchema.safeParse(raw);
    if (!parsed.success) {
      return `The JSON does not match the storyboard format:\n${parsed.error.issues
        .slice(0, 8)
        .map((issue) => `• ${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('\n')}`;
    }
    dispatch({type: 'script/imported', script: fromStoryboard(parsed.data, 'claude-chat', current.config)});
    return null;
  }, []);

  const chatPrompt = useCallback(() => services.script.chatPrompt(toBrandKit(stateRef.current.config), toBrief(stateRef.current.config)), [services]);

  const startRender = useCallback(
    async (preset: 'draft' | 'final') => {
      const before = stateRef.current;
      const after = reducer(before, {type: 'render/requested', preset});
      dispatch({type: 'render/requested', preset});
      if (after.render.phase !== 'submitting') return;
      if (!sceneJson) {
        dispatch({type: 'render/failed', error: 'The storyboard could not be compiled. Go back to the script step and fix it.'});
        return;
      }
      try {
        const job = await services.render.start({sceneJson, brand: toBrandKit(before.config), preset});
        dispatch({type: 'render/accepted', jobId: job.jobId, phase: job.phase, progress: job.progress});
      } catch (error) {
        dispatch({type: 'render/failed', error: message(error)});
      }
    },
    [reducer, sceneJson, services],
  );

  const checkFile = (file: File): string | null => {
    if (!IMAGE_TYPES.test(file.type)) return `${file.name}: only PNG, JPG or WebP images are supported.`;
    if (file.size > 20 * MAX_UPLOAD_BYTES) return `${file.name}: the file is too large.`;
    return null;
  };

  const uploadLogo = useCallback(
    async (file: File): Promise<string | null> => {
      const problem = checkFile(file);
      if (problem) return problem;
      dispatch({type: 'uploads/started'});
      try {
        const asset = await services.assets.upload({file: await downscaleImage(file, 800), kind: 'logo', label: 'Logo'});
        dispatch({type: 'config/update', section: 'brand', update: (config) => ({...config, brand: {...config.brand, logoUrl: asset.url}})});
        return null;
      } catch (error) {
        return message(error);
      } finally {
        dispatch({type: 'uploads/finished'});
      }
    },
    [services],
  );

  const uploadScreenshots = useCallback(
    async (files: File[]): Promise<string[]> => {
      const problems: string[] = [];
      const room = 10 - stateRef.current.config.assets.length;
      if (files.length > room) problems.push(`Only ${Math.max(0, room)} more screenshot(s) fit (10 maximum). Extra files were skipped.`);
      for (const file of files.slice(0, Math.max(0, room))) {
        const problem = checkFile(file);
        if (problem) {
          problems.push(problem);
          continue;
        }
        dispatch({type: 'uploads/started'});
        try {
          const small = await downscaleImage(file);
          if (small.size > MAX_UPLOAD_BYTES) throw new Error('still larger than 5 MB after resizing.');
          const asset = await services.assets.upload({file: small, kind: 'screenshot', label: file.name.replace(/\.[^.]+$/, '').slice(0, 60) || 'Screenshot'});
          dispatch({type: 'assets/add', asset});
        } catch (error) {
          problems.push(`${file.name}: ${message(error)}`);
        } finally {
          dispatch({type: 'uploads/finished'});
        }
      }
      return problems;
    },
    [services],
  );

  const saveToServer = useCallback(async () => {
    const current = stateRef.current;
    try {
      const result = await services.projects.save({
        id: current.serverProjectId,
        name: current.config.product.productName.trim() || 'Untitled',
        brand: toBrandKit(current.config),
        brief: toBrief(current.config),
        studio: toPersisted(current),
      });
      dispatch({type: 'project/serverSaved', id: result.id});
    } catch (error) {
      dispatch({type: 'notice/set', notice: {id: newId('n'), tone: 'error', text: `Could not save to the server. ${message(error)}`}});
    }
  }, [services]);

  const openFromServer = useCallback(
    async (id: string) => {
      try {
        const project = await services.projects.get(id);
        if (project.studio) {
          dispatch({type: 'project/hydrate', state: {...project.studio, render: {phase: 'idle', progress: 0}, serverProjectId: project.id}});
          return;
        }
        // Project saved by an older version of the app: rebuild what we can from brand + brief.
        const base = initialState().config;
        const {brand, brief} = project;
        const config = {
          ...base,
          product: {
            ...base.product,
            productName: brief.details.productName,
            oneLiner: brief.details.oneLiner,
            description: brief.userPrompt.slice(0, 600),
            problem: brief.details.problem,
            features: brief.details.keyFeatures.map((f) => ({...f, id: newId('f')})),
            audienceSegment: brief.details.audience,
            goal: brief.details.goal,
            tone: brief.details.tone,
            cta: brief.details.cta,
            customerCount: brief.details.proof?.customerCount ?? '',
          },
          brand: {...base.brand, name: brand.name, logoUrl: brand.logoUrl, colors: brand.colors, fonts: brand.fonts, tone: brand.tone, rules: brand.rules},
          video: {...base.video, subtype: brief.subtype, aspectRatio: brief.aspectRatio, durationSec: brief.durationSec, motionStyle: brand.motionStyle},
          assets: brief.assets,
        };
        const script = project.legacyStoryboard ? fromStoryboard(project.legacyStoryboard, 'claude-api', config) : null;
        dispatch({
          type: 'project/hydrate',
          state: {config, step: 'product', script, approval: null, render: {phase: 'idle', progress: 0}, sampleLoaded: false, serverProjectId: project.id},
          notice: {id: newId('n'), tone: 'info', text: 'Opened a project saved by an older version. Add the target audience and marketing objective, then review the script.'},
        });
      } catch (error) {
        dispatch({type: 'notice/set', notice: {id: newId('n'), tone: 'error', text: `Could not open the project. ${message(error)}`}});
      }
    },
    [services],
  );

  const value = useMemo<WorkflowContextValue>(
    () => ({
      state,
      dispatch,
      ctx,
      services,
      connection,
      recheckConnection,
      saveStatus,
      sceneJson,
      actions: {generateScript, cancelScript, importPastedPlan, chatPrompt, startRender, uploadLogo, uploadScreenshots, saveToServer, openFromServer},
    }),
    [state, ctx, services, connection, recheckConnection, saveStatus, sceneJson, generateScript, cancelScript, importPastedPlan, chatPrompt, startRender, uploadLogo, uploadScreenshots, saveToServer, openFromServer],
  );

  return <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>;
};
