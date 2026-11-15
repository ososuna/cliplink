import { Loader2 } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

/** For failures the server explains no better, such as a network error. */
export const fallbackMessage = 'Something went wrong. Please try again.';

/** The accessibility props that tie an input to the error a Field shows for it. */
export function fieldAria(opts: { id: string; error: string | undefined }) {
  return {
    'aria-invalid': !!opts.error,
    'aria-describedby': opts.error ? `${opts.id}-error` : undefined,
  };
}

export function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function PendingButton({
  pending,
  pendingLabel,
  disabled,
  children,
  ...props
}: ComponentProps<typeof Button> & { pending: boolean; pendingLabel: string }) {
  return (
    <Button disabled={pending || disabled} {...props}>
      {pending ? (
        <>
          <Loader2 className="animate-spin" /> {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
