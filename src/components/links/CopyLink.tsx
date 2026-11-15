import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function CopyLink({ id, url }: { id: string; url: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex gap-2">
      <Input id={id} type="text" readOnly value={url} />
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={copied ? 'Copied' : 'Copy'}
        onClick={copy}
      >
        {copied ? <Check className="text-green-500" /> : <Copy />}
      </Button>
    </div>
  );
}
