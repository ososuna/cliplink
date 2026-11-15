import { actions } from 'astro:actions';
import { navigate } from 'astro:transitions/client';
import { Loader2, Trash } from 'lucide-react';
import { useState } from 'react';
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

const fallbackMessage = 'Something went wrong. Please try again.';

export default function DeleteLinkDialog({ linkId }: { linkId: string }) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const onOpenChange = (next: boolean) => {
    if (next) setFailure(null);
    setOpen(next);
  };

  const onConfirm = async () => {
    setDeleting(true);
    const { error } = await actions.links.delete({ linkId });
    setDeleting(false);
    if (error) {
      setFailure(error.message || fallbackMessage);
      return;
    }
    setOpen(false);
    return navigate(window.location.href);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label="Delete"
          className="ml-auto border-destructive text-destructive"
        >
          <Trash />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Are you sure you want to delete this short URL?
          </DialogTitle>
          <DialogDescription>This action cannot be undone.</DialogDescription>
        </DialogHeader>
        {failure && (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="destructive"
            disabled={deleting}
            className="w-full"
            onClick={onConfirm}
          >
            {deleting ? (
              <>
                <Loader2 className="animate-spin" /> Deleting...
              </>
            ) : (
              'Delete URL'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
