import {useEffect, useRef, useState, type FC} from 'react';
import {CloudUpload, FilePlus2, FolderOpen, Sparkles, X} from 'lucide-react';
import {cn} from '../lib/utils';
import type {SavedProjectSummary} from '../services/types';
import {productValid} from '../workflow/machine';
import {useWorkflow} from '../workflow/WorkflowProvider';
import {useConfirm} from './ConfirmDialog';
import {Button, Notice} from './ui';

const hasWork = (state: ReturnType<typeof useWorkflow>['state']) =>
  Boolean(state.script) || state.config.product.productName.trim() !== '' || state.config.product.problem.trim() !== '' || state.config.assets.length > 0;

/** New / sample / open / save actions. Destructive ones ask first. */
export const ProjectMenu: FC<{tone: 'rail' | 'light'; onDone?: () => void}> = ({tone, onDone}) => {
  const {state, dispatch, services, actions} = useWorkflow();
  const confirm = useConfirm();
  const [openList, setOpenList] = useState(false);
  const [saving, setSaving] = useState(false);
  const serverAvailable = services.projects.availability().status === 'available';
  const rail = tone === 'rail';

  const item = cn(
    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40',
    rail ? 'text-rail-ink hover:bg-white/[0.06]' : 'text-ink hover:bg-sunken',
  );
  const icon = cn('h-4 w-4 shrink-0', rail ? 'text-rail-muted' : 'text-muted');

  const replaceGuard = async (title: string, confirmLabel: string) =>
    !hasWork(state) ||
    confirm({
      title,
      body: 'Your current inputs, script and any approval will be replaced. This cannot be undone unless you saved the project to the server.',
      confirmLabel,
    });

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        className={item}
        onClick={async () => {
          if (await replaceGuard('Start a new project?', 'Start new project')) {
            dispatch({type: 'project/reset'});
            onDone?.();
          }
        }}
      >
        <FilePlus2 className={icon} aria-hidden /> New project
      </button>
      <button
        type="button"
        className={item}
        onClick={async () => {
          if (await replaceGuard('Load the sample inputs?', 'Load sample')) {
            dispatch({type: 'project/sample'});
            onDone?.();
          }
        }}
      >
        <Sparkles className={icon} aria-hidden /> Load sample inputs
      </button>
      <button type="button" className={item} disabled={!serverAvailable} onClick={() => setOpenList(true)} title={serverAvailable ? undefined : 'Needs the API server'}>
        <FolderOpen className={icon} aria-hidden /> Open saved project…
      </button>
      <button
        type="button"
        className={item}
        disabled={!serverAvailable || saving || !productValid(state)}
        title={!serverAvailable ? 'Needs the API server' : !productValid(state) ? 'Complete the product details first' : undefined}
        onClick={async () => {
          setSaving(true);
          await actions.saveToServer();
          setSaving(false);
          onDone?.();
        }}
      >
        <CloudUpload className={icon} aria-hidden /> {saving ? 'Saving…' : state.serverProjectId ? 'Save to server' : 'Save to server…'}
      </button>
      {openList ? (
        <SavedProjectsDialog
          onClose={() => setOpenList(false)}
          onOpen={async (id) => {
            if (await replaceGuard('Open this saved project?', 'Open project')) {
              await actions.openFromServer(id);
              setOpenList(false);
              onDone?.();
            }
          }}
        />
      ) : null}
    </div>
  );
};

const SavedProjectsDialog: FC<{onClose: () => void; onOpen: (id: string) => void}> = ({onClose, onOpen}) => {
  const {services} = useWorkflow();
  const dialog = useRef<HTMLDialogElement>(null);
  const [items, setItems] = useState<SavedProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialog.current?.showModal();
    services.projects
      .list()
      .then(setItems)
      .catch((e: Error) => setError(e.message));
  }, [services]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="saved-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="w-[min(30rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-ink shadow-lift"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 id="saved-title" className="font-display text-base font-semibold">
          Saved projects
        </h2>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </div>
      <div className="max-h-[60vh] overflow-y-auto p-3">
        {error ? <Notice tone="error" title="Could not load saved projects">{error}</Notice> : null}
        {!error && items === null ? <p className="p-3 text-sm text-muted">Loading…</p> : null}
        {items && items.length === 0 ? <p className="p-3 text-sm text-muted">No saved projects on the server yet.</p> : null}
        <ul>
          {items?.map((project) => (
            <li key={project.id}>
              <button type="button" onClick={() => onOpen(project.id)} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-sunken">
                <span className="truncate text-sm font-medium">{project.name}</span>
                <span className="shrink-0 text-xs text-muted">{new Date(project.updatedAt).toLocaleString()}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </dialog>
  );
};
