import {useRef, useState, type DragEvent, type FC} from 'react';
import {ImagePlus, Trash2, Upload} from 'lucide-react';
import {cn} from '../lib/utils';
import {useWorkflow} from '../workflow/WorkflowProvider';
import {useConfirm} from './ConfirmDialog';
import {Button, fieldId, Notice, TextField} from './ui';
import type {FieldErrors} from '../domain/validation';
import {LIMITS} from '../domain/validation';

const assetSrc = (url: string) => (/^(https?:|data:|blob:)/.test(url) ? url : `/${url.replace(/^\//, '')}`);

const Unavailable: FC<{what: string}> = ({what}) => {
  const {services, recheckConnection} = useWorkflow();
  const availability = services.assets.availability();
  if (availability.status !== 'unavailable') return null;
  return (
    <Notice
      tone="warning"
      title={`${what} need the upload service`}
      actions={
        <Button variant="secondary" size="sm" onClick={recheckConnection}>
          Check again
        </Button>
      }
    >
      {availability.reason} {availability.howToEnable}
    </Notice>
  );
};

export const LogoUpload: FC = () => {
  const {state, dispatch, services, actions} = useWorkflow();
  const confirm = useConfirm();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const available = services.assets.availability().status === 'available';
  const logo = state.config.brand.logoUrl;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(await actions.uploadLogo(file));
    setBusy(false);
    if (input.current) input.current.value = '';
  };

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-ink">
        Logo <span className="ml-1 text-xs font-normal text-faint">optional</span>
      </p>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3">
        <div className="flex h-12 w-24 items-center justify-center rounded-lg bg-sunken ring-1 ring-line">
          {logo ? <img src={assetSrc(logo)} alt="Current logo" className="max-h-9 max-w-[80px] object-contain" /> : <ImagePlus className="h-5 w-5 text-faint" aria-hidden />}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" loading={busy} disabled={!available} onClick={() => input.current?.click()}>
            <Upload className="h-3.5 w-3.5" aria-hidden /> {logo ? 'Replace' : 'Upload logo'}
          </Button>
          {logo ? (
            <Button
              variant="quiet-danger"
              size="sm"
              onClick={async () => {
                if (await confirm({title: 'Remove the logo?', body: 'The brand name will be shown as text instead.', confirmLabel: 'Remove logo'})) {
                  dispatch({type: 'config/update', section: 'brand', update: (c) => ({...c, brand: {...c.brand, logoUrl: ''}})});
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove
            </Button>
          ) : null}
        </div>
        <p className="w-full text-[13px] text-muted sm:w-auto sm:flex-1">PNG, JPG or WebP. Without a logo the brand name is shown as text.</p>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void pick(e.target.files?.[0])} />
      </div>
      {error ? <p role="alert" className="mt-1.5 text-[13px] text-bad">{error}</p> : null}
      <div className="mt-2">
        <Unavailable what="Logo uploads" />
      </div>
    </div>
  );
};

export const ScreenshotManager: FC<{errors: FieldErrors; showError: (key: string) => string | undefined; touch: (key: string) => () => void}> = ({showError, touch}) => {
  const {state, dispatch, services, actions} = useWorkflow();
  const confirm = useConfirm();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const available = services.assets.availability().status === 'available';
  const assets = state.config.assets;
  const uploading = state.busy.uploads > 0;

  const add = async (files: FileList | File[]) => {
    setProblems(await actions.uploadScreenshots(Array.from(files)));
    if (input.current) input.current.value = '';
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (available) void add(event.dataTransfer.files);
  };

  const usedBy = (id: string) => state.script?.scenes.filter((scene) => scene.assetId === id).length ?? 0;

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (available) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn('flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors', dragging ? 'border-signal bg-signal-soft/60' : 'border-line bg-sunken/60')}
      >
        <ImagePlus className="h-6 w-6 text-faint" aria-hidden />
        <p className="text-sm text-muted">{uploading ? 'Uploading…' : 'Drag screenshots here, or'}</p>
        <Button variant="secondary" size="sm" loading={uploading} disabled={!available || assets.length >= 10} onClick={() => input.current?.click()}>
          Choose images
        </Button>
        <p className="text-[12px] text-faint">Up to 10 images · PNG, JPG or WebP · large images are resized before upload</p>
        <input ref={input} type="file" multiple accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => e.target.files && void add(e.target.files)} />
      </div>
      <Unavailable what="Screenshot uploads" />
      {problems.length > 0 ? (
        <Notice tone="error" live title="Some files were not uploaded">
          <ul className="list-disc pl-4">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Notice>
      ) : null}
      {assets.length > 0 ? (
        <ul className="space-y-3">
          {assets.map((asset) => {
            const key = `assets.${asset.id}.label`;
            return (
              <li key={asset.id} className="flex flex-col gap-3 rounded-xl border border-line p-3 sm:flex-row sm:items-start">
                <img src={assetSrc(asset.url)} alt={asset.label} className="h-20 w-full rounded-lg object-cover ring-1 ring-line sm:w-32" />
                <TextField
                  id={fieldId(key)}
                  className="flex-1"
                  label="Label"
                  required
                  max={LIMITS.assetLabel.max}
                  value={asset.label}
                  error={showError(key)}
                  onBlur={touch(key)}
                  hint={`${asset.width ?? '?'}×${asset.height ?? '?'} px. A short label helps the script pick the right image.`}
                  onChange={(label) => dispatch({type: 'assets/set', assets: assets.map((a) => (a.id === asset.id ? {...a, label} : a))})}
                />
                <Button
                  variant="quiet-danger"
                  size="sm"
                  className="self-end sm:self-start"
                  aria-label={`Remove screenshot ${asset.label}`}
                  onClick={async () => {
                    const uses = usedBy(asset.id);
                    const ok = await confirm({
                      title: 'Remove this screenshot?',
                      body: uses > 0 ? `It is used by ${uses} scene${uses === 1 ? '' : 's'} in your storyboard. Those scenes will need a different image, and the script approval will be cleared.` : 'It will be removed from this project.',
                      confirmLabel: 'Remove screenshot',
                    });
                    if (ok) dispatch({type: 'assets/set', assets: assets.filter((a) => a.id !== asset.id)});
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
};
