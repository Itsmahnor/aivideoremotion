import {useEffect, useState, type FC} from 'react';
import {ArrowDown, ArrowUp, ChevronDown, Plus, Trash2, X} from 'lucide-react';
import {TEMPLATE_META, collectText} from '@ai-video-studio/schema';
import type {EditableScene, ProjectConfig, ScriptSection} from '../../domain/schemas';
import {SCRIPT_SECTIONS} from '../../domain/schemas';
import {SECTION_LABEL} from '../../domain/mapping';
import {LIMITS, SCENE_SECONDS, type SceneIssues} from '../../domain/validation';
import {cn} from '../../lib/utils';
import {Badge, Button, describedBy, FieldShell, fieldId, SelectField, TextField} from '../ui';
import {TEMPLATE_FIELDS, TEMPLATE_LABEL, itemRangeOf, maxLengthOf, optionLabel, optionsOf, type FieldSpec} from './sceneFields';

type Props = {
  scene: EditableScene;
  index: number;
  total: number;
  issues: SceneIssues | undefined;
  config: ProjectConfig;
  disabled: boolean;
  expanded: boolean;
  showAllErrors: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<EditableScene>) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
};

/** Optional text props are removed when emptied, so the template's defaults apply. */
const withProp = (props: Record<string, unknown>, key: string, value: unknown, optional: boolean): Record<string, unknown> => {
  const next = {...props};
  if (optional && (value === '' || value === undefined)) delete next[key];
  else next[key] = value;
  return next;
};

export const SceneEditor: FC<Props> = ({scene, index, total, issues, config, disabled, expanded, showAllErrors, onToggle, onChange, onMove, onRemove}) => {
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const touch = (key: string) => () => setTouched((t) => (t.has(key) ? t : new Set(t).add(key)));
  const fieldError = (key: string) => (showAllErrors || touched.has(key) ? issues?.fields[key] : undefined);
  const problemCount = Object.keys(issues?.fields ?? {}).length + (issues?.messages.length ?? 0);
  const idBase = `scene-${scene.id}`;
  const fid = (key: string) => fieldId(`${idBase}.${key}`);
  const setProps = (props: Record<string, unknown>) => onChange({props});
  const preview = collectText(scene.props).join(' · ');
  const usesScreenshot = TEMPLATE_META[scene.template].usesScreenshot;
  const screenshots = config.assets.filter((a) => a.kind !== 'logo');
  const asset = screenshots.find((a) => a.id === scene.assetId);

  const renderField = (spec: FieldSpec) => {
    switch (spec.kind) {
      case 'text': {
        const value = typeof scene.props[spec.key] === 'string' ? (scene.props[spec.key] as string) : '';
        return (
          <TextField
            key={spec.key}
            id={fid(spec.key)}
            label={spec.label}
            required={spec.required}
            multiline={spec.multiline}
            rows={2}
            max={maxLengthOf(scene.template, spec.key)}
            value={value}
            hint={spec.hint}
            disabled={disabled}
            error={fieldError(spec.key)}
            onBlur={touch(spec.key)}
            onChange={(v) => setProps(withProp(scene.props, spec.key, v, !spec.required))}
            className={spec.multiline ? 'sm:col-span-2' : undefined}
          />
        );
      }
      case 'select': {
        const options = optionsOf(scene.template, spec.key);
        const value = typeof scene.props[spec.key] === 'string' ? (scene.props[spec.key] as string) : (options[0] ?? '');
        return (
          <SelectField
            key={spec.key}
            id={fid(spec.key)}
            label={spec.label}
            required
            value={value}
            disabled={disabled}
            error={fieldError(spec.key)}
            options={options.map((o) => ({value: o, label: optionLabel(o)}))}
            onChange={(v) => setProps({...scene.props, [spec.key]: v})}
          />
        );
      }
      case 'bool':
        return (
          <label key={spec.key} className="flex items-center gap-2 self-end pb-2 text-sm text-ink">
            <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--signal))]" disabled={disabled} checked={scene.props[spec.key] !== false} onChange={(e) => setProps({...scene.props, [spec.key]: e.target.checked})} />
            {spec.label}
          </label>
        );
      case 'words':
        return <WordsField key={spec.key} id={fid(spec.key)} spec={spec} scene={scene} disabled={disabled} error={fieldError(spec.key) ?? fieldError(`${spec.key}.0`)} onBlur={touch(spec.key)} onChange={setProps} />;
      case 'callout': {
        const callout = scene.props.callout as {label?: string; position?: string} | undefined;
        return (
          <TextField
            key="callout"
            id={fid('callout.label')}
            label={spec.label}
            max={maxLengthOf(scene.template, 'callout.label')}
            value={callout?.label ?? ''}
            disabled={disabled}
            error={fieldError('callout.label') ?? fieldError('callout')}
            onBlur={touch('callout.label')}
            hint="A short label pointing at the highlighted area."
            onChange={(v) => setProps(withProp(scene.props, 'callout', v ? {label: v, position: callout?.position ?? 'auto'} : '', true))}
          />
        );
      }
      case 'steps':
        return <StepsField key="steps" scene={scene} idBase={idBase} disabled={disabled} fieldError={fieldError} touch={touch} onChange={setProps} />;
    }
  };

  return (
    <li className={cn('rounded-2xl border bg-surface shadow-card', problemCount > 0 ? 'border-bad/40' : 'border-line')}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3 sm:p-4">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sunken text-xs font-semibold tabular-nums text-muted ring-1 ring-line">{index + 1}</span>
        <button type="button" onClick={onToggle} aria-expanded={expanded} aria-controls={`${idBase}-body`} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-ink">{TEMPLATE_LABEL[scene.template]}</span>
              <Badge>{SECTION_LABEL[scene.section]}</Badge>
              <span className="text-xs tabular-nums text-muted">{scene.durationSec}s</span>
              {problemCount > 0 ? <Badge tone="bad">{problemCount} issue{problemCount === 1 ? '' : 's'}</Badge> : null}
            </span>
            {!expanded ? <span className="mt-0.5 block truncate text-[13px] text-muted">{preview || 'No on-screen text yet'}</span> : null}
          </span>
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted transition-transform', expanded && 'rotate-180')} aria-hidden />
        </button>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="sm" disabled={disabled || index === 0} onClick={() => onMove(-1)} aria-label={`Move scene ${index + 1} up`}>
            <ArrowUp className="h-4 w-4" aria-hidden />
          </Button>
          <Button variant="ghost" size="sm" disabled={disabled || index === total - 1} onClick={() => onMove(1)} aria-label={`Move scene ${index + 1} down`}>
            <ArrowDown className="h-4 w-4" aria-hidden />
          </Button>
          <Button variant="quiet-danger" size="sm" disabled={disabled} onClick={onRemove} aria-label={`Delete scene ${index + 1}`}>
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>

      {expanded ? (
        <div id={`${idBase}-body`} className="space-y-5 border-t border-line p-4 sm:p-5">
          {issues?.messages.map((m) => (
            <p key={m} className="text-[13px] text-bad">
              {m}
            </p>
          ))}
          <fieldset className="space-y-4">
            <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">On-screen text</legend>
            <div className="grid gap-4 sm:grid-cols-2">{TEMPLATE_FIELDS[scene.template].map(renderField)}</div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Direction and timing</legend>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8rem]">
              <SelectField
                id={fid('section')}
                label="Script part"
                required
                value={scene.section}
                disabled={disabled}
                options={SCRIPT_SECTIONS.map((s) => ({value: s, label: SECTION_LABEL[s]}))}
                onChange={(v) => onChange({section: v as ScriptSection})}
              />
              {usesScreenshot ? (
                <SelectField
                  id={fid('assetId')}
                  label="Screenshot"
                  required
                  value={scene.assetId && asset ? scene.assetId : ''}
                  disabled={disabled}
                  hint={screenshots.length === 0 ? 'No screenshots uploaded. A stylised interface is shown.' : undefined}
                  options={[{value: '', label: 'None (stylised interface)'}, ...screenshots.map((a) => ({value: a.id, label: a.label}))]}
                  onChange={(v) => onChange(v ? {assetId: v, focusRegionLabel: undefined} : {assetId: undefined, focusRegionLabel: undefined})}
                />
              ) : (
                <div className="hidden sm:block" />
              )}
              <DurationField id={fid('durationSec')} value={scene.durationSec} disabled={disabled} error={fieldError('durationSec')} onChange={(durationSec) => onChange({durationSec})} />
              {scene.template === 'ScreenshotShowcase' && asset && asset.focusRegions.length > 0 ? (
                <SelectField
                  id={fid('focusRegionLabel')}
                  label="Zoom to area"
                  required
                  value={scene.focusRegionLabel ?? ''}
                  disabled={disabled}
                  options={[{value: '', label: 'Whole screen'}, ...asset.focusRegions.map((r) => ({value: r.label, label: r.label}))]}
                  onChange={(v) => onChange({focusRegionLabel: v || undefined})}
                />
              ) : null}
              <TextField
                id={fid('purpose')}
                className="sm:col-span-3"
                label="Visual direction"
                multiline
                rows={2}
                max={LIMITS.purpose.max}
                value={scene.purpose}
                disabled={disabled}
                error={fieldError('purpose')}
                onBlur={touch('purpose')}
                onChange={(purpose) => onChange({purpose})}
                hint="Why this scene exists and what it should show. Guides edits; not shown in the video."
              />
              <TextField
                id={fid('narration')}
                className="sm:col-span-3"
                label="Narration"
                multiline
                rows={2}
                max={LIMITS.narration.max}
                value={scene.narration}
                disabled={disabled}
                error={fieldError('narration')}
                onBlur={touch('narration')}
                onChange={(narration) => onChange({narration})}
              hint="Shown as a caption at the bottom of the scene when captions are on in Customize. Keep it under about 140 characters."/>
            </div>
          </fieldset>
        </div>
      ) : null}
    </li>
  );
};

const DurationField: FC<{id: string; value: number; disabled: boolean; error?: string; onChange: (v: number) => void}> = ({id, value, disabled, error, onChange}) => {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <FieldShell id={id} label="Seconds" required error={error}>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={SCENE_SECONDS.min}
        max={SCENE_SECONDS.max}
        step={0.5}
        value={text}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, {error})}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value.trim() !== '' && Number.isFinite(n)) onChange(n);
        }}
        className={cn('h-10 w-full rounded-lg border bg-surface px-3 text-sm tabular-nums focus:outline-none focus:ring-4', error ? 'border-bad focus:ring-bad/15' : 'border-line focus:border-signal focus:ring-signal/15')}
      />
    </FieldShell>
  );
};

const WordsField: FC<{id: string; spec: Extract<FieldSpec, {kind: 'words'}>; scene: EditableScene; disabled: boolean; error?: string; onBlur: () => void; onChange: (props: Record<string, unknown>) => void}> = ({
  id,
  spec,
  scene,
  disabled,
  error,
  onBlur,
  onChange,
}) => {
  const current = Array.isArray(scene.props[spec.key]) ? (scene.props[spec.key] as unknown[]).filter((w): w is string => typeof w === 'string') : [];
  const [text, setText] = useState(current.join(', '));
  // Re-sync only when switching scenes, so typing a trailing comma is not overwritten.
  useEffect(() => setText(current.join(', ')), [scene.id]);
  return (
    <TextField
      id={id}
      label={spec.label}
      value={text}
      hint={spec.hint}
      disabled={disabled}
      error={error}
      onBlur={onBlur}
      onChange={(v) => {
        setText(v);
        const words = v
          .split(',')
          .map((w) => w.trim())
          .filter(Boolean);
        onChange({...scene.props, [spec.key]: words});
      }}
    />
  );
};

const StepsField: FC<{
  scene: EditableScene;
  idBase: string;
  disabled: boolean;
  fieldError: (key: string) => string | undefined;
  touch: (key: string) => () => void;
  onChange: (props: Record<string, unknown>) => void;
}> = ({scene, idBase, disabled, fieldError, touch, onChange}) => {
  const steps = Array.isArray(scene.props.steps) ? (scene.props.steps as {label?: string; description?: string}[]) : [];
  const [min, max] = itemRangeOf(scene.template, 'steps');
  const set = (next: {label?: string; description?: string}[]) => onChange({...scene.props, steps: next});
  return (
    <fieldset className="sm:col-span-2">
      <legend className="mb-2 text-sm font-medium text-ink">
        Steps <span className="text-xs font-normal text-muted">({min} to {max})</span>
      </legend>
      {fieldError('steps') ? <p className="mb-2 text-[13px] text-bad">{fieldError('steps')}</p> : null}
      <ol className="space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="grid gap-3 rounded-xl bg-sunken/70 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
            <TextField
              id={fieldId(`${idBase}.steps.${i}.label`)}
              label={`Step ${i + 1}`}
              required
              max={maxLengthOf(scene.template, 'steps.label')}
              value={step.label ?? ''}
              disabled={disabled}
              error={fieldError(`steps.${i}.label`)}
              onBlur={touch(`steps.${i}.label`)}
              onChange={(label) => set(steps.map((s, j) => (j === i ? {...s, label} : s)))}
            />
            <TextField
              id={fieldId(`${idBase}.steps.${i}.description`)}
              label="Detail"
              max={maxLengthOf(scene.template, 'steps.description')}
              value={step.description ?? ''}
              disabled={disabled}
              error={fieldError(`steps.${i}.description`)}
              onChange={(description) => set(steps.map((s, j) => (j === i ? (description ? {...s, description} : {label: s.label}) : s)))}
            />
            <Button variant="quiet-danger" size="sm" className="self-end" disabled={disabled || steps.length <= min} onClick={() => set(steps.filter((_, j) => j !== i))} aria-label={`Remove step ${i + 1}`}>
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </li>
        ))}
      </ol>
      <Button variant="secondary" size="sm" className="mt-3" disabled={disabled || steps.length >= max} onClick={() => set([...steps, {label: ''}])}>
        <Plus className="h-3.5 w-3.5" aria-hidden /> Add step
      </Button>
    </fieldset>
  );
};
