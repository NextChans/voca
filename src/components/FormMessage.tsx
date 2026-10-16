import type { ActionState } from '@/app/actions';

export function FormMessage({ state }: { state: ActionState | undefined }) {
  if (!state?.error && !state?.message) return null;
  return (
    <p
      role={state.error ? 'alert' : 'status'}
      className={`mt-3 rounded-xl px-3 py-2 text-sm ${
        state.error ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
      }`}
    >
      {state.error ?? state.message}
    </p>
  );
}
