import { zodResolver } from '@hookform/resolvers/zod';
import { actions, isInputError } from 'astro:actions';
import { navigate } from 'astro:transitions/client';
import { z } from 'astro/zod';
import { TextCursorInput } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  fallbackMessage,
  Field,
  fieldAria,
  PendingButton,
} from '@/components/form';
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
// Not '@/links': that would pull the database code into the browser bundle.
import { nameSchema } from '@/links/name';

const formSchema = z.object({ name: nameSchema });

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

  const fieldId = `rename-${linkId}`;

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
          <DialogTitle>Rename Link</DialogTitle>
          <DialogDescription>
            Enter a new name, or leave it blank to remove the name.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <Field id={fieldId} label="Name" error={errors.name?.message}>
            <Input
              id={fieldId}
              autoComplete="off"
              {...fieldAria({ id: fieldId, error: errors.name?.message })}
              {...register('name')}
            />
          </Field>
          <DialogFooter>
            <PendingButton
              type="submit"
              pending={isSubmitting}
              pendingLabel="Renaming..."
              className="w-full"
            >
              Rename
            </PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
