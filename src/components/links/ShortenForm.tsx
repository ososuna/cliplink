import { zodResolver } from '@hookform/resolvers/zod';
import { isInputError } from 'astro:actions';
import { navigate } from 'astro:transitions/client';
import { z } from 'astro/zod';
import { useForm } from 'react-hook-form';
import {
  fallbackMessage,
  Field,
  fieldAria,
  PendingButton,
} from '@/components/form';
import { CardContent, CardFooter } from '@/components/ui/card';
import { createLink } from '@/components/links/create-link';
import { Input } from '@/components/ui/input';
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
    const { data, error } = await createLink(input);
    if (data) return navigate(`/short/${data.code}`);
    const message = isInputError(error)
      ? error.fields.destination?.[0]
      : error.message;
    setError('destination', { message: message || fallbackMessage });
  });

  const errorMessage = errors.destination?.message;

  return (
    <form onSubmit={onSubmit} noValidate>
      <CardContent>
        <Field id="destination" label="Long URL" error={errorMessage}>
          <Input
            id="destination"
            autoComplete="off"
            placeholder="https://example/long/url"
            {...fieldAria({ id: 'destination', error: errorMessage })}
            {...register('destination')}
          />
        </Field>
      </CardContent>
      <CardFooter className="mt-4">
        <PendingButton
          type="submit"
          pending={isSubmitting}
          pendingLabel="Shortening..."
        >
          Shorten URL
        </PendingButton>
      </CardFooter>
    </form>
  );
}
