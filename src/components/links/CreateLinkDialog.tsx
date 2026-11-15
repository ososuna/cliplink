import { zodResolver } from '@hookform/resolvers/zod';
import { actions, isInputError } from 'astro:actions';
import { navigate } from 'astro:transitions/client';
import { z } from 'astro/zod';
import { Loader2 } from 'lucide-react';
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
import { destinationSchema } from '@/links/destination';
import { nameSchema } from '@/links/name';

const formSchema = z.object({
  name: nameSchema,
  destination: destinationSchema,
});

const fallbackMessage = 'Something went wrong. Please try again.';

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
    const { data, error } = await actions.links.create(input);
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
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'name-error' : undefined}
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
              aria-invalid={!!errors.destination}
              aria-describedby={
                errors.destination ? 'destination-error' : undefined
              }
              {...register('destination')}
            />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" /> Shortening...
                </>
              ) : (
                'Shorten URL'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error: string | undefined;
  children: React.ReactNode;
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
