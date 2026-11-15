import { zodResolver } from '@hookform/resolvers/zod';
import { isInputError } from 'astro:actions';
import { navigate } from 'astro:transitions/client';
import { z } from 'astro/zod';
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
import { createLink } from '@/components/links/create-link';
import { Input } from '@/components/ui/input';
// Not '@/links': that would pull the database code into the browser bundle.
import { destinationSchema } from '@/links/destination';
import { nameSchema } from '@/links/name';

const formSchema = z.object({
  name: nameSchema,
  destination: destinationSchema,
});

export default function CreateLinkDialog() {
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', destination: '' },
  });

  const onSubmit = handleSubmit(async (input) => {
    const { data, error } = await createLink(input);
    if (data) {
      setOpen(false);
      reset();
      return navigate(window.location.href);
    }
    if (!isInputError(error)) {
      setError('destination', { message: error.message || fallbackMessage });
      return;
    }
    const { name, destination } = error.fields;
    if (name?.[0]) setError('name', { message: name[0] });
    if (destination?.[0] || !name?.[0]) {
      setError('destination', { message: destination?.[0] ?? fallbackMessage });
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="whitespace-nowrap">Shorten URL</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Shorten URL</DialogTitle>
          <DialogDescription>
            Enter a long URL to get a shortened version.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <Field id="name" label="Name (Optional)" error={errors.name?.message}>
            <Input
              id="name"
              autoComplete="off"
              {...fieldAria({ id: 'name', error: errors.name?.message })}
              {...register('name')}
            />
          </Field>
          <Field
            id="destination"
            label="Long URL"
            error={errors.destination?.message}
          >
            <Input
              id="destination"
              autoComplete="off"
              placeholder="https://example/long/url"
              {...fieldAria({
                id: 'destination',
                error: errors.destination?.message,
              })}
              {...register('destination')}
            />
          </Field>
          <DialogFooter>
            <PendingButton
              type="submit"
              pending={isSubmitting}
              pendingLabel="Shortening..."
              className="w-full"
            >
              Shorten URL
            </PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
