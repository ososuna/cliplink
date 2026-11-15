import CopyButton from '@/components/links/CopyButton';
import { Input } from '@/components/ui/input';

export default function CopyLink({ id, url }: { id: string; url: string }) {
  return (
    <div className="flex gap-2">
      <Input id={id} type="text" readOnly value={url} />
      <CopyButton url={url} />
    </div>
  );
}
