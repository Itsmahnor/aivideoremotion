import {createContext, useCallback, useContext, useEffect, useRef, useState, type FC, type ReactNode} from 'react';
import {AlertTriangle} from 'lucide-react';
import {Button} from './ui';

type ConfirmOptions = {title: string; body: ReactNode; confirmLabel: string; cancelLabel?: string; tone?: 'danger' | 'primary'};
type Pending = ConfirmOptions & {resolve: (ok: boolean) => void};

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

/** `const confirm = useConfirm(); if (await confirm({...})) ...` for destructive actions. */
export const useConfirm = () => {
  const value = useContext(ConfirmContext);
  if (!value) throw new Error('useConfirm must be used inside <ConfirmProvider>.');
  return value;
};

/** Native <dialog>: modal, focus-trapped, closes on Escape, returns focus to the trigger. */
export const ConfirmProvider: FC<{children: ReactNode}> = ({children}) => {
  const [pending, setPending] = useState<Pending | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        opener.current = document.activeElement as HTMLElement | null;
        setPending({...options, resolve});
      }),
    [],
  );

  useEffect(() => {
    if (pending && dialog.current && !dialog.current.open) {
      dialog.current.showModal();
      cancelButton.current?.focus();
    }
  }, [pending]);

  const close = (ok: boolean) => {
    pending?.resolve(ok);
    dialog.current?.close();
    setPending(null);
    opener.current?.focus?.();
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <dialog
        ref={dialog}
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        onCancel={(event) => {
          event.preventDefault();
          close(false);
        }}
        className="w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-ink shadow-lift"
      >
        {pending ? (
          <div className="p-6">
            <div className="flex gap-3">
              {pending.tone !== 'primary' ? (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bad-soft text-bad">
                  <AlertTriangle className="h-4 w-4" aria-hidden />
                </div>
              ) : null}
              <div>
                <h2 id="confirm-title" className="font-display text-base font-semibold">
                  {pending.title}
                </h2>
                <div id="confirm-body" className="mt-1.5 text-sm text-muted">
                  {pending.body}
                </div>
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button ref={cancelButton} variant="secondary" onClick={() => close(false)}>
                {pending.cancelLabel ?? 'Cancel'}
              </Button>
              <Button variant={pending.tone === 'primary' ? 'primary' : 'danger'} onClick={() => close(true)}>
                {pending.confirmLabel}
              </Button>
            </div>
          </div>
        ) : null}
      </dialog>
    </ConfirmContext.Provider>
  );
};
