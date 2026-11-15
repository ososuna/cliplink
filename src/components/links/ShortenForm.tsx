import { zodResolver } from '@hookform/resolvers/zod';
import { actions, isInputError } from 'astro:actions';
import { navigate } from 'astro:transitions/client';
import { z } from 'astro/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// Not '@/links': that would pull the database code into the browser bundle.
import { destinationSchema } from '@/links/destination';

const formSchema = z.object({ destination: destinationSchema });

export default function ShortenForm() {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { destination: '' },
  });

  const onSubmit = handleSubmit(async (input) => {
    const { data, error } = await actions.links.create(input);
    if (data) return navigate(`/short/${data.code}`);
    const message = isInputError(error)
      ? error.fields.destination?.[0]
      : error.message;
    setError('destination', {
      message: message ?? 'Something went wrong. Please try again.',
    });
  });

  const errorMessage = errors.destination?.message;

  return (
    <form onSubmit={onSubmit} noValidate>
      <CardContent className="grid gap-2">
        <Label htmlFor="destination">Long URL</Label>
        <Input
          id="destination"
          autoComplete="off"
          placeholder="https://example/long/url"
          aria-invalid={!!errorMessage}
          aria-describedby={errorMessage ? 'destination-error' : undefined}
          {...register('destination')}
        />
        {errorMessage && (
          <p id="destination-error" className="text-sm text-destructive">
            {errorMessage}
          </p>
        )}
      </CardContent>
      <CardFooter className="mt-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" /> Shortening...
            </>
          ) : (
            'Shorten URL'
          )}
        </Button>
      </CardFooter>
    </form>
  );
}
