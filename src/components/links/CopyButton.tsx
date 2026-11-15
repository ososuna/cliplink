import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={copied ? 'Copied' : 'Copy'}
      onClick={copy}
    >
      {copied ? <Check className="text-green-500" /> : <Copy />}
    </Button>
  );
}
