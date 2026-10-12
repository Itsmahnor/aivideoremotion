import {useEffect, useRef, useState, type FC} from 'react';
import {ArrowLeft, ArrowRight, Clapperboard, Menu, X} from 'lucide-react';
import {supportedFontNames} from '@ai-video-studio/video/player';
import {ConfirmProvider} from './components/ConfirmDialog';
import {ProjectMenu} from './components/ProjectMenu';
import {ServiceList, STEP_META, Stepper} from './components/shell';
import {Badge, Button, Notice} from './components/ui';
import {STEP_IDS} from './domain/schemas';
import {cn} from './lib/utils';
import {CustomizeStep} from './steps/CustomizeStep';
import {ExportStep} from './steps/ExportStep';
import {GenerateStep} from './steps/GenerateStep';
import {ProductStep} from './steps/ProductStep';
import {ScriptStep} from './steps/ScriptStep';
import {deriveStatus, STATUS_LABEL, type WorkflowStatus} from './workflow/machine';
import {useWorkflow, WorkflowProvider} from './workflow/WorkflowProvider';

export const App: FC = () => (
  <ConfirmProvider>
    <WorkflowProvider fonts={supportedFontNames}>
      <Studio />
    </WorkflowProvider>
  </ConfirmProvider>
);

const STATUS_TONE: Record<WorkflowStatus, 'neutral' | 'signal' | 'ok' | 'warn' | 'bad'> = {
  draft: 'neutral',
  validating: 'signal',
  ready_for_review: 'warn',
  awaiting_approval: 'signal',
  approved: 'ok',
  generating: 'signal',
  completed: 'ok',
  failed: 'bad',
};

const Wordmark: FC<{dark?: boolean}> = ({dark}) => (
  <div className="flex items-center gap-2.5">
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-signal text-white">
      <Clapperboard className="h-4 w-4" aria-hidden />
    </span>
    <span className={cn('font-display text-[15px] font-bold tracking-tight', dark ? 'text-rail-ink' : 'text-ink')}>AI Video Studio</span>
  </div>
);

const SaveIndicator: FC<{dark?: boolean}> = ({dark}) => {
  const {saveStatus} = useWorkflow();
  if (saveStatus.state === 'error') return <span className="text-[12px] text-[#F5A524]">Not saved: {saveStatus.error}</span>;
  if (saveStatus.state === 'saved')
    return <span className={cn('text-[12px]', dark ? 'text-rail-muted' : 'text-muted')}>Saved in this browser · {new Date(saveStatus.at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</span>;
  return null;
};

const Studio: FC = () => {
  const {state, dispatch} = useWorkflow();
  const status = deriveStatus(state);
  const heading = useRef<HTMLHeadingElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const firstRender = useRef(true);

  // Move focus to the new step's heading so keyboard and screen-reader users land in the right place.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({top: 0});
    heading.current?.focus();
  }, [state.step]);

  const meta = STEP_META[state.step];
  const index = STEP_IDS.indexOf(state.step);
  const productName = state.config.product.productName.trim();

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:shadow-lift">
        Skip to content
      </a>

      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-screen flex-col overflow-y-auto bg-rail px-4 py-5 lg:flex" aria-label="Project">
        <Wordmark dark />
        <div className="mt-6 rounded-xl border border-rail-line p-3">
          <p className="truncate text-sm font-semibold text-rail-ink">{productName || 'Untitled project'}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
            {state.sampleLoaded ? <Badge tone="warn">Sample data</Badge> : null}
          </div>
          <div className="mt-2">
            <SaveIndicator dark />
          </div>
        </div>
        <div className="mt-6">
          <Stepper orientation="vertical" />
        </div>
        <div className="mt-auto space-y-5 pt-8">
          <ServiceList tone="rail" />
          <div className="border-t border-rail-line pt-3">
            <ProjectMenu tone="rail" />
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        {/* Mobile / tablet header */}
        <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <Wordmark />
            <div className="flex items-center gap-2">
              <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
              <Button variant="secondary" size="sm" aria-expanded={menuOpen} aria-controls="mobile-menu" onClick={() => setMenuOpen((open) => !open)} aria-label="Project menu">
                {menuOpen ? <X className="h-4 w-4" aria-hidden /> : <Menu className="h-4 w-4" aria-hidden />}
              </Button>
            </div>
          </div>
          {menuOpen ? (
            <div id="mobile-menu" className="space-y-5 border-t border-line px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{productName || 'Untitled project'}</span>
                {state.sampleLoaded ? <Badge tone="warn">Sample data</Badge> : null}
                <SaveIndicator />
              </div>
              <ServiceList tone="light" />
              <ProjectMenu tone="light" onDone={() => setMenuOpen(false)} />
            </div>
          ) : null}
          <div className="px-2 pb-2">
            <Stepper orientation="horizontal" />
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-[60rem] px-4 pb-36 pt-6 sm:px-8 sm:pt-10">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-signal">
            Step {index + 1} of {STEP_IDS.length}
          </p>
          <h1 ref={heading} tabIndex={-1} className="mt-1 font-display text-2xl font-bold tracking-tight text-ink focus:outline-none sm:text-[28px]">
            {meta.heading}
          </h1>
          <p className="mt-1.5 max-w-2xl text-[15px] text-muted">{meta.description}</p>

          {state.sampleLoaded ? (
            <Notice tone="warning" className="mt-5" title="Sample inputs (fictional product)">
              These example inputs are only for trying the workflow. Replace them with your own product before you generate anything you plan to use.
            </Notice>
          ) : null}

          {state.notice ? (
            <Notice
              key={state.notice.id}
              live
              tone={state.notice.tone}
              className="mt-5"
              actions={
                <Button variant="secondary" size="sm" onClick={() => dispatch({type: 'notice/set', notice: null})}>
                  Dismiss
                </Button>
              }
            >
              {state.notice.text}
            </Notice>
          ) : null}

          <div className="mt-6 space-y-5">
            {state.step === 'product' ? <ProductStep /> : null}
            {state.step === 'customize' ? <CustomizeStep /> : null}
            {state.step === 'script' ? <ScriptStep /> : null}
            {state.step === 'generate' ? <GenerateStep /> : null}
            {state.step === 'export' ? <ExportStep /> : null}
          </div>
        </main>

        <ActionBar />
      </div>
    </div>
  );
};

const NEXT_LABEL: Record<string, string> = {product: 'Continue to customize', customize: 'Continue to script', script: 'Continue to video', generate: 'Continue to export'};

/** Sticky Back / Next. Next is never a dead end: if the step is incomplete it explains why and focuses the first problem. */
const ActionBar: FC = () => {
  const {state, dispatch} = useWorkflow();
  const index = STEP_IDS.indexOf(state.step);
  const isLast = index === STEP_IDS.length - 1;

  const next = () => {
    dispatch({type: 'step/next'});
    // If the step stayed the same, its form now shows every error: focus the first one.
    requestAnimationFrame(() => {
      const invalid = document.querySelector<HTMLElement>('main [aria-invalid="true"]');
      invalid?.focus();
    });
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur lg:left-[17.5rem]">
      <div className="mx-auto flex w-full max-w-[60rem] items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <Button variant="secondary" onClick={() => dispatch({type: 'step/back'})} disabled={index === 0}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back
        </Button>
        {!isLast ? (
          <Button onClick={next}>
            <span className="hidden sm:inline">{NEXT_LABEL[state.step]}</span>
            <span className="sm:hidden">Next</span>
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        ) : null}
      </div>
    </div>
  );
};
