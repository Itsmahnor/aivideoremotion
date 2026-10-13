import type {UploadedAsset} from '@ai-video-studio/schema';
import {emptyConfig, idleRender, newId, sampleConfig} from '../domain/defaults';
import {hashOf} from '../domain/hash';
import {DEFAULT_SECTION, productHash, toBrandKit} from '../domain/mapping';
import {STEP_IDS, type Approval, type EditableScene, type ProjectConfig, type RenderState, type Script, type StepId} from '../domain/schemas';
import {validateCustomization, validateProduct, validateScript} from '../domain/validation';
import type {TemplateName} from '@ai-video-studio/schema';

/**
 * Central workflow state machine.
 * - Every transition is checked here, not only by disabled buttons in the UI.
 * - Approval and render validity are DERIVED from content hashes, so any relevant edit invalidates them
 *   automatically and nothing can stay "approved" or "completed" by accident.
 */

export type WorkflowStatus = 'draft' | 'validating' | 'ready_for_review' | 'awaiting_approval' | 'approved' | 'generating' | 'completed' | 'failed';

export type Notice = {id: string; tone: 'info' | 'success' | 'warning' | 'error'; text: string};

export type WorkflowState = {
  config: ProjectConfig;
  step: StepId;
  script: Script | null;
  approval: Approval | null;
  render: RenderState;
  sampleLoaded: boolean;
  serverProjectId?: string;
  /** Operations in flight. Not persisted. */
  busy: {script: boolean; scriptBasedOn?: string; uploads: number};
  scriptError: string | null;
  /** Steps where the user tried to continue; their forms then show every error, not only touched ones. */
  attempted: Partial<Record<StepId, boolean>>;
  notice: Notice | null;
};

export type ConfigSection = 'product' | 'brand' | 'video';

export type WorkflowAction =
  | {type: 'config/update'; section: ConfigSection; update: (config: ProjectConfig) => ProjectConfig}
  | {type: 'assets/set'; assets: UploadedAsset[]}
  | {type: 'assets/add'; asset: UploadedAsset}
  | {type: 'uploads/started'}
  | {type: 'uploads/finished'}
  | {type: 'step/go'; step: StepId}
  | {type: 'step/next'}
  | {type: 'step/back'}
  | {type: 'script/requested'}
  | {type: 'script/received'; script: Script; assets?: UploadedAsset[]}
  | {type: 'script/failed'; error: string}
  | {type: 'script/imported'; script: Script}
  | {type: 'script/title'; title: string}
  | {type: 'scene/update'; id: string; patch: Partial<EditableScene>}
  | {type: 'scene/add'; template: TemplateName; afterId?: string}
  | {type: 'scene/remove'; id: string}
  | {type: 'scene/move'; id: string; direction: -1 | 1}
  | {type: 'script/discard'}
  | {type: 'script/approve'; acknowledgeOutdated?: boolean}
  | {type: 'script/revoke'}
  | {type: 'render/requested'; preset: 'draft' | 'final'}
  | {type: 'render/accepted'; jobId: string; phase: RenderState['phase']; progress: number}
  | {type: 'render/progress'; jobId: string; phase: RenderState['phase']; progress: number; videoUrl?: string; error?: string}
  | {type: 'render/failed'; jobId?: string; error: string}
  | {type: 'render/clear'}
  | {type: 'project/hydrate'; state: Pick<WorkflowState, 'config' | 'step' | 'script' | 'approval' | 'render' | 'sampleLoaded' | 'serverProjectId'>; notice?: Notice}
  | {type: 'project/sample'}
  | {type: 'project/reset'}
  | {type: 'project/serverSaved'; id: string}
  | {type: 'notice/set'; notice: Notice | null};

export type MachineContext = {fonts: readonly string[]};

// ---------------------------------------------------------------- derived values

export const formatOf = (config: ProjectConfig) => ({aspectRatio: config.video.aspectRatio, durationSec: config.video.durationSec, subtype: config.video.subtype});

/** Everything an approval vouches for: the storyboard, the product facts, the format and the screenshots it uses. */
export const approvalKeyOf = (state: Pick<WorkflowState, 'config' | 'script'>): string =>
  hashOf({
    script: state.script ? {title: state.script.title, scenes: state.script.scenes} : null,
    product: productHash(state.config.product),
    format: formatOf(state.config),
    assets: state.config.assets.map(({id, url, focusRegions}) => ({id, url, focusRegions})),
  });

/** Everything a rendered video is made from: the approved content plus the brand the renderer draws with. */
export const renderKeyOf = (state: Pick<WorkflowState, 'config' | 'script'>): string => hashOf({approval: approvalKeyOf(state), brand: toBrandKit(state.config)});

export const isApproved = (state: WorkflowState): boolean => state.approval !== null && state.approval.key === approvalKeyOf(state);
export const isScriptOutdated = (state: WorkflowState): boolean => state.script !== null && state.script.basedOn !== productHash(state.config.product);
export const RENDER_ACTIVE: readonly RenderState['phase'][] = ['submitting', 'queued', 'bundling', 'rendering'];
export const isRendering = (state: WorkflowState): boolean => RENDER_ACTIVE.includes(state.render.phase);
/** The render belongs to the current content (not made from an older storyboard or brand). */
export const isRenderCurrent = (state: WorkflowState): boolean => state.render.key !== undefined && state.render.key === renderKeyOf(state);
/** A real, downloadable file exists for exactly what is on screen now. */
export const hasDownloadableVideo = (state: WorkflowState): boolean => state.render.phase === 'done' && Boolean(state.render.videoUrl) && isRenderCurrent(state);

export const productValid = (state: WorkflowState): boolean => Object.keys(validateProduct(state.config)).length === 0;
export const customizeValid = (state: WorkflowState, ctx: MachineContext): boolean => Object.keys(validateCustomization(state.config, ctx.fonts)).length === 0 && state.busy.uploads === 0;

export const deriveStatus = (state: WorkflowState): WorkflowStatus => {
  if (state.busy.script) return 'validating';
  if (isRendering(state)) return 'generating';
  if (state.render.phase === 'done' && hasDownloadableVideo(state)) return 'completed';
  if (state.render.phase === 'failed' && isRenderCurrent(state)) return 'failed';
  if (!state.script) return state.scriptError ? 'failed' : 'draft';
  if (isApproved(state)) return 'approved';
  if (!isScriptOutdated(state) && validateScript(state.script, state.config).valid) return 'awaiting_approval';
  return 'ready_for_review';
};

export const STATUS_LABEL: Record<WorkflowStatus, string> = {
  draft: 'Draft',
  validating: 'Validating',
  ready_for_review: 'Ready for review',
  awaiting_approval: 'Awaiting approval',
  approved: 'Approved',
  generating: 'Generating',
  completed: 'Completed',
  failed: 'Failed',
};

/** Why a step cannot be opened yet, or null when it can. */
export const stepBlocker = (state: WorkflowState, step: StepId, ctx: MachineContext): string | null => {
  const index = STEP_IDS.indexOf(step);
  if (index >= 1 && !productValid(state)) return 'Complete the product details first.';
  if (index >= 2 && state.busy.uploads > 0) return 'Wait for uploads to finish.';
  if (index >= 2 && !customizeValid(state, ctx)) return 'Fix the video settings first.';
  if (index >= 3 && !isApproved(state)) return 'Approve the script first.';
  return null;
};

/** Why the user cannot move past the current step, or null. */
const leaveBlocker = (state: WorkflowState, ctx: MachineContext): string | null => {
  const next = STEP_IDS[STEP_IDS.indexOf(state.step) + 1];
  if (!next) return 'This is the last step.';
  if (state.step === 'product' && !productValid(state)) return 'Some product details are missing or invalid. Fix the highlighted fields to continue.';
  if (state.step === 'customize' && state.busy.uploads > 0) return 'Wait for uploads to finish.';
  if (state.step === 'customize' && !customizeValid(state, ctx)) return 'Some settings are invalid. Fix the highlighted fields to continue.';
  if (state.step === 'script' && !isApproved(state)) return 'Approve the script to continue. Approval is only possible when the storyboard has no errors.';
  return stepBlocker(state, next, ctx);
};

// ---------------------------------------------------------------- state

export const initialState = (): WorkflowState => ({
  config: emptyConfig(),
  step: 'product',
  script: null,
  approval: null,
  render: idleRender,
  sampleLoaded: false,
  busy: {script: false, uploads: 0},
  scriptError: null,
  attempted: {},
  notice: null,
});

const note = (tone: Notice['tone'], text: string): Notice => ({id: newId('n'), tone, text});
const reject = (state: WorkflowState, text: string): WorkflowState => ({...state, notice: note('error', text)});

const BLANK_PROPS: Record<TemplateName, Record<string, unknown>> = {
  HookStatement: {line: '', emphasisWords: [], style: 'word-by-word'},
  ProductReveal: {productName: '', tagline: '', variant: 'rise'},
  ScreenshotShowcase: {caption: '', showCursor: true, device: 'browser'},
  FeatureSpotlight: {icon: 'sparkle', title: '', description: '', layout: 'stacked'},
  StepFlow: {steps: [{label: ''}, {label: ''}]},
  CTAEndCard: {cta: '', url: ''},
    CustomScene: {background: 'gradient', layers: [{type: 'text', text: '', x: 10, y: 35, w: 80, h: 30, size: 'headline', color: 'text', enter: 'fade', delaySec: 0}]},
};

export const blankScene = (template: TemplateName, config: ProjectConfig): EditableScene => {
  const props = structuredClone(BLANK_PROPS[template]);
  if (template === 'ProductReveal') props.productName = config.product.productName.trim().slice(0, 30);
  if (template === 'CTAEndCard') {
    props.cta = config.product.cta.text.trim().slice(0, 30);
    props.url = config.product.cta.url.trim().slice(0, 40);
  }
  return {id: newId('s'), template, section: DEFAULT_SECTION[template], purpose: '', narration: '', durationSec: 4, props};
};

const editScript = (state: WorkflowState, update: (script: Script) => Script): WorkflowState => {
  if (!state.script) return reject(state, 'There is no storyboard to edit yet.');
  if (state.busy.script) return reject(state, 'A script is being generated. Wait for it to finish before editing.');
  if (isRendering(state)) return reject(state, 'The video is rendering. Wait for it to finish before editing the storyboard.');
  return {...state, script: update(state.script)};
};

export const createReducer =
  (ctx: MachineContext) =>
  (state: WorkflowState, action: WorkflowAction): WorkflowState => {
    switch (action.type) {
      case 'config/update': {
        if (action.section === 'product' && state.busy.script) return reject(state, 'A script is being generated from the current details. Wait for it to finish before changing them.');
        return {...state, config: action.update(state.config)};
      }
      case 'assets/set':
        return {...state, config: {...state.config, assets: action.assets}};
      case 'assets/add':
        if (state.config.assets.length >= 10) return reject(state, 'You can add at most 10 screenshots.');
        return {...state, config: {...state.config, assets: [...state.config.assets, action.asset]}};
      case 'uploads/started':
        return {...state, busy: {...state.busy, uploads: state.busy.uploads + 1}};
      case 'uploads/finished':
        return {...state, busy: {...state.busy, uploads: Math.max(0, state.busy.uploads - 1)}};

      case 'step/go': {
        if (action.step === state.step) return state;
        const goingBack = STEP_IDS.indexOf(action.step) < STEP_IDS.indexOf(state.step);
        const blocker = goingBack ? null : stepBlocker(state, action.step, ctx);
        if (blocker) return {...reject(state, blocker), attempted: {...state.attempted, [state.step]: true}};
        return {...state, step: action.step, notice: null};
      }
      case 'step/next': {
        const blocker = leaveBlocker(state, ctx);
        if (blocker) return {...reject(state, blocker), attempted: {...state.attempted, [state.step]: true}};
        return {...state, step: STEP_IDS[STEP_IDS.indexOf(state.step) + 1]!, notice: null};
      }
      case 'step/back': {
        const index = STEP_IDS.indexOf(state.step);
        return index === 0 ? state : {...state, step: STEP_IDS[index - 1]!, notice: null};
      }

      case 'script/requested': {
        if (state.busy.script) return reject(state, 'A script is already being generated.');
        if (isRendering(state)) return reject(state, 'Wait for the current render to finish.');
        const blocker = stepBlocker(state, 'script', ctx);
        if (blocker) return reject(state, blocker);
        return {...state, busy: {...state.busy, script: true, scriptBasedOn: productHash(state.config.product)}, scriptError: null, notice: null};
      }
      case 'script/received': {
        if (!state.busy.script) return state; // stale response after a reset: ignore
        const script = {...action.script, basedOn: state.busy.scriptBasedOn ?? action.script.basedOn};
        const config = action.assets ? {...state.config, assets: action.assets} : state.config;
        return {...state, config, script, approval: null, busy: {...state.busy, script: false, scriptBasedOn: undefined}, scriptError: null, notice: note('success', 'Script ready. Review and edit each scene, then approve it.')};
      }
      case 'script/failed':
        if (!state.busy.script) return state;
        return {...state, busy: {...state.busy, script: false, scriptBasedOn: undefined}, scriptError: action.error};
      case 'script/imported': {
        if (state.busy.script) return reject(state, 'Wait for the current script generation to finish.');
        if (isRendering(state)) return reject(state, 'Wait for the current render to finish.');
        return {...state, script: action.script, approval: null, scriptError: null, notice: note('success', 'Pasted plan loaded. Fix any highlighted issues, then approve it.')};
      }
      case 'script/title':
        return editScript(state, (script) => ({...script, title: action.title}));
      case 'scene/update':
        return editScript(state, (script) => ({...script, scenes: script.scenes.map((scene) => (scene.id === action.id ? {...scene, ...action.patch, id: scene.id} : scene))}));
      case 'scene/add':
        return editScript(state, (script) => {
          const scene = blankScene(action.template, state.config);
          const at = action.afterId ? script.scenes.findIndex((s) => s.id === action.afterId) + 1 : script.scenes.length;
          const scenes = [...script.scenes];
          scenes.splice(at <= 0 ? scenes.length : at, 0, scene);
          return {...script, scenes};
        });
      case 'scene/remove':
        return editScript(state, (script) => ({...script, scenes: script.scenes.filter((scene) => scene.id !== action.id)}));
      case 'scene/move':
        return editScript(state, (script) => {
          const from = script.scenes.findIndex((scene) => scene.id === action.id);
          const to = from + action.direction;
          if (from < 0 || to < 0 || to >= script.scenes.length) return script;
          const scenes = [...script.scenes];
          [scenes[from], scenes[to]] = [scenes[to]!, scenes[from]!];
          return {...script, scenes};
        });
      case 'script/discard': {
        if (state.busy.script || isRendering(state)) return reject(state, 'Wait for the current operation to finish.');
        return {...state, script: null, approval: null, scriptError: null};
      }
      case 'script/approve': {
        if (!state.script) return reject(state, 'There is no storyboard to approve.');
        if (state.busy.script) return reject(state, 'Wait for script generation to finish.');
        if (isRendering(state)) return reject(state, 'Wait for the current render to finish.');
        const issues = validateScript(state.script, state.config);
        if (!issues.valid) return reject(state, `The storyboard cannot be approved yet: ${issues.errors[0] ?? 'it has errors.'}`);
        let next = state;
        if (isScriptOutdated(state)) {
          if (!action.acknowledgeOutdated) return reject(state, 'The product details changed after this script was written. Regenerate it, or confirm that you reviewed it.');
          next = {...state, script: {...state.script, basedOn: productHash(state.config.product)}};
        }
        return {...next, approval: {key: approvalKeyOf(next), at: new Date().toISOString()}, notice: note('success', 'Script approved.')};
      }
      case 'script/revoke':
        if (isRendering(state)) return reject(state, 'Wait for the current render to finish.');
        return {...state, approval: null};

      case 'render/requested': {
        if (!isApproved(state)) return reject(state, 'Approve the script before generating the video.');
        if (isRendering(state)) return reject(state, 'A render is already running.');
        if (state.busy.script) return reject(state, 'Wait for script generation to finish.');
        return {...state, render: {phase: 'submitting', preset: action.preset, progress: 0, key: renderKeyOf(state), startedAt: new Date().toISOString()}, notice: null};
      }
      case 'render/accepted':
        if (state.render.phase !== 'submitting') return state;
        return {...state, render: {...state.render, jobId: action.jobId, phase: action.phase, progress: action.progress}};
      case 'render/progress': {
        if (state.render.jobId !== action.jobId || !isRendering(state)) return state; // late update from an old job
        if (action.phase === 'done' && !action.videoUrl) {
          return {...state, render: {...state.render, phase: 'failed', error: 'The renderer reported success but returned no video file.', finishedAt: new Date().toISOString()}};
        }
        const finished = action.phase === 'done' || action.phase === 'failed';
        return {
          ...state,
          render: {
            ...state.render,
            phase: action.phase,
            progress: action.progress,
            ...(action.videoUrl ? {videoUrl: action.videoUrl} : {}),
            ...(action.error ? {error: action.error} : {}),
            ...(finished ? {finishedAt: new Date().toISOString()} : {}),
          },
        };
      }
      case 'render/failed':
        if (action.jobId && state.render.jobId !== action.jobId) return state;
        if (!isRendering(state)) return state;
        return {...state, render: {...state.render, phase: 'failed', error: action.error, finishedAt: new Date().toISOString()}};
      case 'render/clear':
        if (isRendering(state)) return reject(state, 'A render is running.');
        return {...state, render: idleRender};

      case 'project/hydrate': {
        const loaded: WorkflowState = {...initialState(), ...action.state, notice: action.notice ?? null};
        // Never land on a step the restored content does not allow (e.g. "generate" without a valid approval).
        let index = STEP_IDS.indexOf(loaded.step);
        while (index > 0 && stepBlocker(loaded, STEP_IDS[index]!, ctx)) index -= 1;
        return {...loaded, step: STEP_IDS[index]!};
      }
      case 'project/sample':
        if (state.busy.script || isRendering(state) || state.busy.uploads > 0) return reject(state, 'Wait for the current operation to finish.');
        return {...initialState(), config: sampleConfig(), sampleLoaded: true, notice: note('info', 'Sample inputs loaded for a fictional product. Nothing has been generated yet.')};
      case 'project/reset':
        if (state.busy.script || isRendering(state) || state.busy.uploads > 0) return reject(state, 'Wait for the current operation to finish.');
        return {...initialState(), notice: note('info', 'Started a new project.')};
      case 'project/serverSaved':
        return {...state, serverProjectId: action.id, notice: note('success', 'Project saved to the API server.')};
      case 'notice/set':
        return {...state, notice: action.notice};
      default:
        return state;
    }
  };
