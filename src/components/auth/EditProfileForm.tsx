import { zodResolver } from '@hookform/resolvers/zod';
import { actions, isInputError } from 'astro:actions';
import { z } from 'astro/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
// Not '@/auth': that would pull the server code into the browser bundle.
import { userNameSchema } from '@/auth/name';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const formSchema = z.object({ name: userNameSchema });

const fallbackMessage = 'Something went wrong. Please try again.';

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
      <div className="grid gap-2">
        <Label htmlFor="profile-name">Name</Label>
        <Input
          id="profile-name"
          autoComplete="name"
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'profile-name-error' : undefined}
          {...register('name')}
        />
        {errors.name && (
          <p id="profile-name-error" className="text-sm text-destructive">
            {errors.name.message}
          </p>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="profile-email">Email</Label>
        <Input
          id="profile-email"
          value={email}
          readOnly
          aria-describedby="profile-email-hint"
        />
        <p id="profile-email-hint" className="text-sm text-muted-foreground">
          Your email comes from the Provider you sign in with.
        </p>
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" /> Updating...
          </>
        ) : (
          'Update Profile'
        )}
      </Button>
    </form>
  );
}
