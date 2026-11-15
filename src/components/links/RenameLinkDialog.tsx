import { zodResolver } from '@hookform/resolvers/zod';
import { actions, isInputError } from 'astro:actions';
import { navigate } from 'astro:transitions/client';
import { z } from 'astro/zod';
import { Loader2, TextCursorInput } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// Not '@/links': that would pull the database code into the browser bundle.
import { nameSchema } from '@/links/name';

const formSchema = z.object({ name: nameSchema });

const fallbackMessage = 'Something went wrong. Please try again.';

export default function RenameLinkDialog({
  linkId,
  name,
}: {
  linkId: string;
  name: string | null;
}) {
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { name: name ?? '' },
  });

  const onOpenChange = (next: boolean) => {
    if (next) reset({ name: name ?? '' });
    setOpen(next);
  };

  const onSubmit = handleSubmit(async (input) => {
    const { error } = await actions.links.rename({ linkId, ...input });
    if (!error) {
      setOpen(false);
      return navigate(window.location.href);
    }
    const message = isInputError(error)
      ? error.fields.name?.[0]
      : error.message;
    setError('name', { message: message || fallbackMessage });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Rename">
          <TextCursorInput />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename URL</DialogTitle>
          <DialogDescription>
            Enter a new name, or leave it blank to remove the name.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor={`rename-${linkId}`}>Name</Label>
            <Input
              id={`rename-${linkId}`}
              autoComplete="off"
              aria-invalid={!!errors.name}
              aria-describedby={
                errors.name ? `rename-${linkId}-error` : undefined
              }
              {...register('name')}
            />
            {errors.name && (
              <p
                id={`rename-${linkId}-error`}
                className="text-sm text-destructive"
              >
                {errors.name.message}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" /> Renaming...
                </>
              ) : (
                'Rename'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
