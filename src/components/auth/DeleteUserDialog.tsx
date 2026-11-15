import { Trash } from 'lucide-react';
import { useState } from 'react';
import { authClient } from '@/auth/client';
import { fallbackMessage, Field, PendingButton } from '@/components/form';
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

const confirmation = 'Delete my User';

// Better Auth only deletes a User whose session is recent (a day, by default).
const staleSessionMessage =
  'For your security, log out and sign in again before deleting your User.';

export default function DeleteUserDialog() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const confirmed = typed.trim().toLowerCase() === confirmation.toLowerCase();

  const onOpenChange = (next: boolean) => {
    if (next) {
      setTyped('');
      setFailure(null);
    }
    setOpen(next);
  };

  const onConfirm = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    if (!confirmed) return;
    setDeleting(true);
    const { error } = await authClient.deleteUser();
    if (error) {
      setDeleting(false);
      setFailure(
        error.code === 'SESSION_EXPIRED'
          ? staleSessionMessage
          : error.message || fallbackMessage,
      );
      return;
    }
    // A full load, so the persisted navbar and every island drop the old session.
    window.location.assign('/');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="border-destructive text-destructive"
        >
          <Trash /> Delete User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you absolutely sure?</DialogTitle>
          <DialogDescription>
            This deletes your User and every Link you own. Those Links stop
            working. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onConfirm} noValidate className="grid gap-4">
          <Field
            id="delete-user-confirmation"
            label={<>Type &quot;{confirmation}&quot; to confirm</>}
          >
            <Input
              id="delete-user-confirmation"
              autoComplete="off"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
            />
          </Field>
          {failure && (
            <p role="alert" className="text-sm text-destructive">
              {failure}
            </p>
          )}
          <DialogFooter>
            <PendingButton
              type="submit"
              variant="destructive"
              pending={deleting}
              pendingLabel="Deleting..."
              disabled={!confirmed}
              className="w-full"
            >
              Delete User
            </PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
