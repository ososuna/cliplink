import { zodResolver } from '@hookform/resolvers/zod';
import { actions, isInputError } from 'astro:actions';
import { z } from 'astro/zod';
import { useForm } from 'react-hook-form';
// Not '@/auth': that would pull the server code into the browser bundle.
import { userNameSchema } from '@/auth/name';
import {
  fallbackMessage,
  Field,
  fieldAria,
  PendingButton,
} from '@/components/form';
import { Input } from '@/components/ui/input';

const formSchema = z.object({ name: userNameSchema });

export default function EditProfileForm({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { name },
  });

  const onSubmit = handleSubmit(async (input) => {
    const { error } = await actions.user.rename(input);
    if (!error) {
      // A full load, because the persisted navbar shows the name too.
      window.location.reload();
      return;
    }
    const message = isInputError(error)
      ? error.fields.name?.[0]
      : error.message;
    setError('name', { message: message || fallbackMessage });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <Field id="profile-name" label="Name" error={errors.name?.message}>
        <Input
          id="profile-name"
          autoComplete="name"
          {...fieldAria({ id: 'profile-name', error: errors.name?.message })}
          {...register('name')}
        />
      </Field>
      <Field id="profile-email" label="Email">
        <Input
          id="profile-email"
          value={email}
          readOnly
          aria-describedby="profile-email-hint"
        />
        <p id="profile-email-hint" className="text-sm text-muted-foreground">
          Your email comes from the Provider you sign in with.
        </p>
      </Field>
      <PendingButton
        type="submit"
        pending={isSubmitting}
        pendingLabel="Updating..."
      >
        Update Profile
      </PendingButton>
    </form>
  );
}
