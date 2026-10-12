import {useMemo, useState, type FC} from 'react';
import {Bot, Check, ClipboardCopy, ClipboardPaste, FileText, ListChecks, Minus, Plus, RotateCcw, ShieldCheck, Wand2} from 'lucide-react';
import {TEMPLATE_NAMES, collectText, type TemplateName} from '@ai-video-studio/schema';
import {useConfirm} from '../components/ConfirmDialog';
import {SceneEditor} from '../components/script/SceneEditor';
import {TEMPLATE_LABEL} from '../components/script/sceneFields';
import {Badge, Button, EmptyState, fieldId, Notice, ProgressBar, Section, SelectField, TextField} from '../components/ui';
import {SECTION_LABEL, SOURCE_LABEL} from '../domain/mapping';
import {SCRIPT_SECTIONS} from '../domain/schemas';
import {sceneCountRange, validateScript} from '../domain/validation';
import {cn} from '../lib/utils';
import type {Availability, ScriptGenerationMode} from '../services/types';
import {isApproved, isRendering, isScriptOutdated} from '../workflow/machine';
import {useWorkflow} from '../workflow/WorkflowProvider';

const AvailabilityLine: FC<{availability: Availability}> = ({availability}) => {
  if (availability.status === 'available') return <Badge tone="ok">Connected{availability.detail ? ` · ${availability.detail}` : ''}</Badge>;
  if (availability.status === 'checking') return <Badge>Checking…</Badge>;
  return <Badge tone="warn">Not connected</Badge>;
};

export const ScriptStep: FC = () => {
  const {state} = useWorkflow();
  return (
    <>
      <GenerationPanel />
      {state.script ? <ScriptEditor /> : null}
    </>
  );
};

// ---------------------------------------------------------------- generate / import

const GenerationPanel: FC = () => {
  const {state, services, actions, recheckConnection} = useWorkflow();
  const confirm = useConfirm();
  const [lastMode, setLastMode] = useState<ScriptGenerationMode>('claude-api');
  const [pasted, setPasted] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<{tone: 'ok' | 'error'; text: string} | null>(null);
  const [copying, setCopying] = useState(false);
  const [open, setOpen] = useState(!state.script);
  const busy = state.busy.script;
  const locked = busy || isRendering(state);
  const api = services.script.availability('claude-api');
  const draft = services.script.availability('template-draft');
  const chat = services.script.chatPromptAvailability();

  const replaceOk = async () =>
    !state.script ||
    confirm({
      title: 'Replace the current script?',
      body: 'Your storyboard and every edit you made to it will be replaced, and any approval will be cleared.',
      confirmLabel: 'Replace script',
    });

  const run = async (mode: ScriptGenerationMode) => {
    if (!(await replaceOk())) return;
    setLastMode(mode);
    await actions.generateScript(mode);
  };

  const copyPrompt = async () => {
    setCopying(true);
    setCopyState(null);
    try {
      const prompt = await actions.chatPrompt();
      await navigator.clipboard.writeText(prompt);
      setCopyState({tone: 'ok', text: `Copied ${prompt.length.toLocaleString()} characters. Paste it into a new chat on claude.ai.`});
    } catch (error) {
      setCopyState({tone: 'error', text: (error as Error).message || 'Could not copy to the clipboard.'});
    } finally {
      setCopying(false);
    }
  };

  const usePasted = async () => {
    if (!(await replaceOk())) return;
    const problem = actions.importPastedPlan(pasted);
    setPasteError(problem);
    if (!problem) {
      setPasted('');
      setOpen(false);
    }
  };

  if (busy) {
    return (
      <Section id="generating" title="Writing your script…" description="The script writer is planning scenes from your product details and checking them against the template rules. This can take up to a minute.">
        <ProgressBar value={0} indeterminate label="Generating script" />
        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={actions.cancelScript}>
            Cancel
          </Button>
        </div>
      </Section>
    );
  }

  const header = state.script ? (
    <Button variant="secondary" size="sm" aria-expanded={open} aria-controls="gen-options" onClick={() => setOpen((o) => !o)}>
      <RotateCcw className="h-3.5 w-3.5" aria-hidden /> {open ? 'Hide options' : 'Regenerate or import'}
    </Button>
  ) : null;

  return (
    <Section id="generate-script" title={state.script ? 'Script source' : 'Create the script'} description={state.script ? SOURCE_LABEL[state.script.source] : 'Choose how to write the first draft. You can edit every scene afterwards.'} aside={header}>
      {state.scriptError ? (
        <Notice
          tone="error"
          live
          className="mb-5"
          title="The script could not be generated"
          actions={
            <Button size="sm" variant="secondary" onClick={() => void run(lastMode)} disabled={locked}>
              Try again
            </Button>
          }
        >
          <span className="whitespace-pre-wrap">{state.scriptError}</span>
        </Notice>
      ) : null}

      {open ? (
        <div id="gen-options" className="grid gap-4">
          <div className="rounded-xl border border-line p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-signal-soft text-signal">
                  <Bot className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">Generate with Claude</p>
                  <p className="text-[13px] text-muted">Uses the AI provider configured on your API server. Screenshots are analysed first.</p>
                </div>
              </div>
              <AvailabilityLine availability={api} />
            </div>
            {api.status === 'unavailable' ? (
              <Notice tone="warning" className="mt-3" title="AI script generation is not connected" actions={<Button size="sm" variant="secondary" onClick={recheckConnection}>Check again</Button>}>
                {api.reason} {api.howToEnable}
              </Notice>
            ) : null}
            <Button className="mt-4" disabled={api.status !== 'available' || locked} onClick={() => void run('claude-api')}>
              <Wand2 className="h-4 w-4" aria-hidden /> Generate script
            </Button>
          </div>

          <div className="rounded-xl border border-line p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-signal-soft text-signal">
                  <ClipboardPaste className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">Use Claude in a chat (no API key)</p>
                  <p className="text-[13px] text-muted">Copy the full instructions, paste them into claude.ai, then paste Claude's JSON reply back here.</p>
                </div>
              </div>
            </div>
            <ol className="mt-4 space-y-4 text-sm">
              <li>
                <p className="mb-2 font-medium text-ink">1. Copy the prompt</p>
                <Button variant="secondary" size="sm" loading={copying} disabled={chat.status !== 'available'} onClick={() => void copyPrompt()}>
                  <ClipboardCopy className="h-3.5 w-3.5" aria-hidden /> Copy prompt
                </Button>
                {chat.status === 'unavailable' ? <p className="mt-2 text-[13px] text-warn">Building the prompt needs the API server. {chat.howToEnable}</p> : null}
                {copyState ? (
                  <p role="status" className={cn('mt-2 text-[13px]', copyState.tone === 'ok' ? 'text-ok' : 'text-bad')}>
                    {copyState.text}
                  </p>
                ) : null}
              </li>
              <li>
                <p className="font-medium text-ink">2. Send it in a new chat on claude.ai and copy the JSON reply</p>
              </li>
              <li>
                <TextField
                  id={fieldId('paste')}
                  label="3. Paste Claude's reply"
                  multiline
                  rows={5}
                  value={pasted}
                  onChange={(v) => {
                    setPasted(v);
                    setPasteError(null);
                  }}
                  error={pasteError ?? undefined}
                  placeholder='{"title": "…", "scenes": [ … ]}'
                  textareaProps={{className: 'font-mono text-xs', spellCheck: false}}
                />
                <Button className="mt-3" variant="secondary" disabled={pasted.trim().length < 2 || locked} onClick={() => void usePasted()}>
                  Use pasted plan
                </Button>
              </li>
            </ol>
          </div>

          <div className="rounded-xl border border-dashed border-line bg-sunken/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-muted ring-1 ring-line">
                  <FileText className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">Template draft</p>
                  <p className="text-[13px] text-muted">Not AI. Fills a fixed scene structure with your own text, as a starting point to edit by hand.</p>
                </div>
              </div>
              <AvailabilityLine availability={draft} />
            </div>
            <Button className="mt-4" variant="secondary" disabled={draft.status !== 'available' || locked} onClick={() => void run('template-draft')}>
              Create template draft
            </Button>
          </div>
        </div>
      ) : null}
    </Section>
  );
};

// ---------------------------------------------------------------- review and edit

const ScriptEditor: FC = () => {
  const {state, dispatch} = useWorkflow();
  const confirm = useConfirm();
  const script = state.script!;
  const issues = useMemo(() => validateScript(script, state.config), [script, state.config]);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(script.scenes.filter((s) => Object.keys(issues.scenes[s.id]?.fields ?? {}).length > 0).map((s) => s.id)));
  const [showAll, setShowAll] = useState(false);
  const [addTemplate, setAddTemplate] = useState<TemplateName>('FeatureSpotlight');
  const approved = isApproved(state);
  const outdated = isScriptOutdated(state);
  const locked = state.busy.script || isRendering(state);
  const [min, max] = sceneCountRange(state.config.video.durationSec);
  const totalSec = script.scenes.reduce((sum, s) => sum + (Number.isFinite(s.durationSec) ? s.durationSec : 0), 0);
  const covered = new Set(script.scenes.map((s) => s.section));

  const toggle = (id: string) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const approve = async () => {
    setShowAll(true);
    if (!issues.valid) {
      setExpanded(new Set(script.scenes.filter((s) => (issues.scenes[s.id] && (Object.keys(issues.scenes[s.id]!.fields).length > 0 || issues.scenes[s.id]!.messages.length > 0))).map((s) => s.id)));
      dispatch({type: 'script/approve'});
      return;
    }
    if (outdated) {
      const ok = await confirm({
        title: 'Approve a script written for older details?',
        body: 'Your product details changed after this script was written. Approve only if you reviewed every scene and it still matches your product.',
        confirmLabel: 'I reviewed it, approve',
        tone: 'primary',
      });
      if (!ok) return;
      dispatch({type: 'script/approve', acknowledgeOutdated: true});
      return;
    }
    dispatch({type: 'script/approve'});
  };

  const removeScene = async (id: string, index: number) => {
    const ok = await confirm({title: `Delete scene ${index + 1}?`, body: 'The scene and its text will be removed from the storyboard.', confirmLabel: 'Delete scene'});
    if (ok) dispatch({type: 'scene/remove', id});
  };

  const discard = async () => {
    const ok = await confirm({title: 'Discard this script?', body: 'The storyboard and all your edits will be deleted. You can generate a new one afterwards.', confirmLabel: 'Discard script'});
    if (ok) dispatch({type: 'script/discard'});
  };

  const status = approved ? (
    <Badge tone="ok">
      <Check className="h-3 w-3" aria-hidden /> Approved
    </Badge>
  ) : outdated ? (
    <Badge tone="warn">Outdated</Badge>
  ) : issues.valid ? (
    <Badge tone="signal">Ready to approve</Badge>
  ) : (
    <Badge tone="bad">Needs fixes</Badge>
  );

  return (
    <>
      {outdated ? (
        <Notice tone="warning" title="Product details changed after this script was written">
          Regenerate the script, or review every scene and approve it again. The previous approval no longer applies.
        </Notice>
      ) : null}
      {locked ? <Notice tone="info">Editing is paused while {state.busy.script ? 'a script is being generated' : 'the video is rendering'}.</Notice> : null}

      <Section id="overview" title="Script outline" description="The story from hook to call to action, as it reads on screen." aside={status}>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Scenes', `${script.scenes.length}`, `${min}–${max} for ${state.config.video.durationSec}s`],
            ['Planned length', `${totalSec.toFixed(1)}s`, 'Adjusted to fit reading time'],
            ['Format', state.config.video.aspectRatio, state.config.video.subtype.replace(/-/g, ' ')],
            ['Source', script.source === 'template-draft' ? 'Template' : 'Claude', script.source === 'claude-chat' ? 'Pasted from chat' : script.source === 'claude-api' ? 'API' : 'Rule-based, not AI'],
          ].map(([label, value, sub]) => (
            <div key={label} className="rounded-xl bg-sunken p-3 ring-1 ring-line">
              <dt className="text-[12px] text-muted">{label}</dt>
              <dd className="mt-0.5 font-display text-lg font-semibold capitalize text-ink">{value}</dd>
              <dd className="text-[12px] text-muted">{sub}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-5">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
            <ListChecks className="h-3.5 w-3.5" aria-hidden /> Story coverage
          </p>
          <ul className="flex flex-wrap gap-2">
            {SCRIPT_SECTIONS.map((section) => (
              <li key={section}>
                <Badge tone={covered.has(section) ? 'ok' : 'neutral'}>
                  {covered.has(section) ? <Check className="h-3 w-3" aria-hidden /> : <Minus className="h-3 w-3" aria-hidden />}
                  {SECTION_LABEL[section]}
                  <span className="sr-only">{covered.has(section) ? ' covered' : ' not covered'}</span>
                </Badge>
              </li>
            ))}
          </ul>
        </div>

        <ol className="mt-5 divide-y divide-line rounded-xl border border-line">
          {script.scenes.map((scene, i) => {
            const text = collectText(scene.props);
            return (
              <li key={scene.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
                <span className="text-[12px] font-semibold uppercase tracking-wider text-muted">
                  {i + 1}. {SECTION_LABEL[scene.section]}
                </span>
                <span className="min-w-0 text-sm text-ink">
                  {text.length > 0 ? text.join(' · ') : <em className="text-faint">No on-screen text</em>}
                  {scene.narration.trim() ? <span className="mt-1 block text-[13px] italic text-muted">Narration: {scene.narration.trim()}</span> : null}
                </span>
              </li>
            );
          })}
        </ol>
      </Section>

      {(issues.errors.length > 0 || issues.warnings.length > 0 || script.warnings.length > 0) && !approved ? (
        <div className="space-y-3">
          {issues.errors.length > 0 ? (
            <Notice tone="error" title="Fix before approving">
              <ul className="list-disc space-y-0.5 pl-4">
                {issues.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </Notice>
          ) : null}
          {[...issues.warnings, ...script.warnings].length > 0 ? (
            <Notice tone="warning" title="Suggestions">
              <ul className="list-disc space-y-0.5 pl-4">
                {[...new Set([...issues.warnings, ...script.warnings])].map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </Notice>
          ) : null}
        </div>
      ) : null}

      <Section
        id="storyboard"
        title="Storyboard"
        description="Scene by scene: on-screen text, visual direction, narration and timing."
        aside={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setExpanded(new Set(script.scenes.map((s) => s.id)))}>
              Expand all
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setExpanded(new Set())}>
              Collapse all
            </Button>
          </div>
        }
      >
        <TextField
          id={fieldId('script.title')}
          label="Storyboard title"
          required
          max={80}
          value={script.title}
          disabled={locked}
          error={!script.title.trim() && showAll ? 'Give the storyboard a title.' : undefined}
          onChange={(title) => dispatch({type: 'script/title', title})}
          className="mb-5"
        />
        {script.scenes.length === 0 ? (
          <EmptyState icon={<FileText className="h-5 w-5" aria-hidden />} title="No scenes">
            Add scenes below or generate a new script. An empty storyboard cannot be approved.
          </EmptyState>
        ) : (
          <ol className="space-y-3">
            {script.scenes.map((scene, index) => (
              <SceneEditor
                key={scene.id}
                scene={scene}
                index={index}
                total={script.scenes.length}
                issues={issues.scenes[scene.id]}
                config={state.config}
                disabled={locked}
                expanded={expanded.has(scene.id)}
                showAllErrors={showAll}
                onToggle={() => toggle(scene.id)}
                onChange={(patch) => dispatch({type: 'scene/update', id: scene.id, patch})}
                onMove={(direction) => dispatch({type: 'scene/move', id: scene.id, direction})}
                onRemove={() => void removeScene(scene.id, index)}
              />
            ))}
          </ol>
        )}

        <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-line pt-5">
          <SelectField
            id={fieldId('add-template')}
            className="min-w-[14rem] flex-1 sm:flex-none"
            label="Add a scene"
            required
            value={addTemplate}
            disabled={locked}
            options={TEMPLATE_NAMES.map((t) => ({value: t, label: TEMPLATE_LABEL[t]}))}
            onChange={(v) => setAddTemplate(v as TemplateName)}
          />
          <Button
            variant="secondary"
            disabled={locked || script.scenes.length >= 14}
            onClick={() => {
              const lastIsCta = script.scenes.at(-1)?.template === 'CTAEndCard';
              const after = lastIsCta && addTemplate !== 'CTAEndCard' ? script.scenes.at(-2)?.id : undefined;
              dispatch({type: 'scene/add', template: addTemplate, afterId: after});
            }}
          >
            <Plus className="h-4 w-4" aria-hidden /> Add scene
          </Button>
          <p className="w-full text-[12px] text-muted">New scenes are placed before the call-to-action end card. Use the arrows to reorder.</p>
        </div>
      </Section>

      <Section id="approval" title="Approval" description="The video can only be generated from an approved storyboard. Any later edit to the script, product details or format clears the approval.">
        {approved ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm text-ok">
              <ShieldCheck className="h-4 w-4" aria-hidden /> Approved {state.approval ? new Date(state.approval.at).toLocaleString() : ''}
            </p>
            <Button variant="secondary" disabled={locked} onClick={() => dispatch({type: 'script/revoke'})}>
              Revoke approval
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {issues.valid ? (outdated ? 'Review every scene before approving: the product details changed.' : 'Everything checks out. Approve to continue.') : `${issues.errors.length} problem${issues.errors.length === 1 ? '' : 's'} must be fixed first.`}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="quiet-danger" disabled={locked} onClick={() => void discard()}>
                Discard script
              </Button>
              <Button onClick={() => void approve()} disabled={locked} aria-describedby="approve-why">
                <ShieldCheck className="h-4 w-4" aria-hidden /> Approve script
              </Button>
            </div>
            <span id="approve-why" className="sr-only">
              {issues.valid ? '' : 'The storyboard has errors and cannot be approved yet.'}
            </span>
          </div>
        )}
      </Section>
    </>
  );
};
