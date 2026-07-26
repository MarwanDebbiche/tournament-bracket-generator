import { create } from 'zustand';
import { cn } from '../../lib/cn';
import { Modal } from './Modal';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style the confirm button as destructive (red). */
  danger?: boolean;
}

interface ConfirmRequest extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

interface ConfirmState {
  request: ConfirmRequest | null;
  open: (options: ConfirmOptions) => Promise<boolean>;
  settle: (confirmed: boolean) => void;
}

const useConfirmStore = create<ConfirmState>((set, get) => ({
  request: null,
  open: (options) =>
    new Promise<boolean>((resolve) => {
      // If a dialog is somehow already open, cancel it first.
      get().request?.resolve(false);
      set({ request: { ...options, resolve } });
    }),
  settle: (confirmed) => {
    get().request?.resolve(confirmed);
    set({ request: null });
  },
}));

/** Show an in-app confirmation dialog. Resolves true if confirmed, false otherwise. */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return useConfirmStore.getState().open(options);
}

/** Render once near the app root so `confirm()` has a place to appear. */
export function ConfirmHost() {
  const request = useConfirmStore((s) => s.request);
  const settle = useConfirmStore((s) => s.settle);

  if (!request) return null;

  return (
    <Modal title={request.title} onClose={() => settle(false)}>
      {request.message && (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {request.message}
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => settle(false)}
          className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {request.cancelLabel ?? 'Cancel'}
        </button>
        <button
          type="button"
          autoFocus
          onClick={() => settle(true)}
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition',
            request.danger
              ? 'bg-red-600 hover:bg-red-500'
              : 'bg-indigo-600 hover:bg-indigo-500',
          )}
        >
          {request.confirmLabel ?? 'Confirm'}
        </button>
      </div>
    </Modal>
  );
}
