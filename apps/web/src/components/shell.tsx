import type {FC} from 'react';
import {Check, Lock, RefreshCw} from 'lucide-react';
import {STEP_IDS, type StepId} from '../domain/schemas';
import {cn} from '../lib/utils';
import type {Availability} from '../services/types';
import {customizeValid, hasDownloadableVideo, isApproved, productValid, stepBlocker, type WorkflowState} from '../workflow/machine';
import {useWorkflow} from '../workflow/WorkflowProvider';

export const STEP_META: Record<StepId, {short: string; heading: string; description: string}> = {
  product: {short: 'Product', heading: 'Describe your SaaS product', description: 'The script is written only from the facts you give here. Nothing is invented.'},
  customize: {short: 'Customize', heading: 'Customize the video', description: 'Brand colors, format, style and optional screenshots. Every setting has a sensible default.'},
  script: {short: 'Script', heading: 'Script and storyboard', description: 'Generate the script, edit every scene, then approve it before the video is made.'},
  generate: {short: 'Generate', heading: 'Generate the video', description: 'Preview the approved storyboard and render it to a video file.'},
  export: {short: 'Export', heading: 'Preview and export', description: 'Watch the rendered file and download it.'},
};

type StepState = 'complete' | 'current' | 'available' | 'locked';

const stepState = (state: WorkflowState, step: StepId, fonts: readonly string[]): StepState => {
  if (state.step === step) return 'current';
  if (stepBlocker(state, step, {fonts})) return 'locked';
  const done =
    (step === 'product' && productValid(state)) ||
    (step === 'customize' && productValid(state) && customizeValid(state, {fonts})) ||
    (step === 'script' && isApproved(state)) ||
    (step === 'generate' && hasDownloadableVideo(state));
  return done ? 'complete' : 'available';
};

/** Vertical stepper (desktop rail) or compact horizontal stepper (mobile). Locked steps explain why. */
export const Stepper: FC<{orientation: 'vertical' | 'horizontal'}> = ({orientation}) => {
  const {state, dispatch, ctx} = useWorkflow();
  const vertical = orientation === 'vertical';
  return (
    <nav aria-label="Workflow steps">
      <ol className={cn(vertical ? 'space-y-1' : 'flex gap-1 overflow-x-auto pb-1')}>
        {STEP_IDS.map((step, index) => {
          const s = stepState(state, step, ctx.fonts);
          const blocker = s === 'locked' ? stepBlocker(state, step, ctx) : null;
          return (
            <li key={step} className={cn(!vertical && 'min-w-0 flex-1')}>
              <button
                type="button"
                onClick={() => dispatch({type: 'step/go', step})}
                aria-current={s === 'current' ? 'step' : undefined}
                aria-disabled={s === 'locked' || undefined}
                title={blocker ?? undefined}
                aria-describedby={blocker ? `step-${step}-${orientation}-why` : undefined}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-lg text-left transition-colors',
                  vertical ? 'px-2.5 py-2' : 'flex-col gap-1.5 px-1 py-1.5 sm:flex-row sm:gap-2 sm:px-2',
                  vertical && s === 'current' && 'bg-white/[0.07]',
                  vertical && s !== 'current' && s !== 'locked' && 'hover:bg-white/[0.04]',
                  !vertical && s === 'current' && 'bg-signal-soft',
                  s === 'locked' && 'cursor-not-allowed',
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                    s === 'current' && 'bg-signal text-white',
                    s === 'complete' && (vertical ? 'bg-ok/20 text-[#5BD69B]' : 'bg-ok-soft text-ok'),
                    s === 'available' && (vertical ? 'bg-white/10 text-rail-ink' : 'bg-sunken text-ink ring-1 ring-line'),
                    s === 'locked' && (vertical ? 'bg-white/[0.04] text-rail-muted' : 'bg-sunken text-faint'),
                  )}
                  aria-hidden
                >
                  {s === 'complete' ? <Check className="h-3.5 w-3.5" /> : s === 'locked' ? <Lock className="h-3 w-3" /> : index + 1}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      'block truncate text-sm font-medium',
                      vertical ? (s === 'locked' ? 'text-rail-muted' : 'text-rail-ink') : s === 'locked' ? 'text-faint' : 'text-ink',
                      !vertical && 'text-[12px] sm:text-sm',
                    )}
                  >
                    <span className="sr-only">Step {index + 1}: </span>
                    {STEP_META[step].short}
                    <span className="sr-only">{s === 'complete' ? ' (complete)' : s === 'locked' ? ' (locked)' : ''}</span>
                  </span>
                  {vertical && blocker ? (
                    <span id={`step-${step}-${orientation}-why`} className="block truncate text-[11px] text-rail-muted">
                      {blocker}
                    </span>
                  ) : blocker ? (
                    <span id={`step-${step}-${orientation}-why`} className="sr-only">
                      {blocker}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

const dot = (availability: Availability) =>
  availability.status === 'available' ? 'bg-[#3FCF8E]' : availability.status === 'checking' ? 'bg-rail-muted animate-pulse' : 'bg-[#F5A524]';

/** Which integrations are actually connected. Never claims a service works when it does not. */
export const ServiceList: FC<{tone: 'rail' | 'light'}> = ({tone}) => {
  const {services, connection, recheckConnection} = useWorkflow();
  const rows: {label: string; availability: Availability}[] = [
    {label: 'AI script writer', availability: services.script.availability('claude-api')},
    {label: 'Uploads', availability: services.assets.availability()},
    {label: 'Video rendering', availability: services.render.availability()},
    {label: 'Voice-over', availability: services.voiceover.availability()},
  ];
  const rail = tone === 'rail';
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className={cn('text-[11px] font-semibold uppercase tracking-wider', rail ? 'text-rail-muted' : 'text-muted')}>Integrations</p>
        <button
          type="button"
          onClick={recheckConnection}
          disabled={connection.state === 'checking'}
          className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium disabled:opacity-50', rail ? 'text-rail-muted hover:text-rail-ink' : 'text-muted hover:text-ink')}
        >
          <RefreshCw className={cn('h-3 w-3', connection.state === 'checking' && 'animate-spin')} aria-hidden />
          Check again
        </button>
      </div>
      <ul className="space-y-1.5">
        {rows.map(({label, availability}) => (
          <li key={label} className="flex items-start gap-2 text-[13px]" title={availability.status === 'unavailable' ? `${availability.reason} ${availability.howToEnable ?? ''}` : undefined}>
            <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', dot(availability))} aria-hidden />
            <span className="min-w-0">
              <span className={rail ? 'text-rail-ink' : 'text-ink'}>{label}</span>
              <span className={cn('block text-[11px]', rail ? 'text-rail-muted' : 'text-muted')}>
                {availability.status === 'available' ? `Connected${availability.detail ? ` · ${availability.detail}` : ''}` : availability.status === 'checking' ? 'Checking…' : 'Not connected'}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

