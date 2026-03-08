import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface CopyTrackingButtonProps {
  tracking: string;
}

const CopyTrackingButton: React.FC<CopyTrackingButtonProps> = ({ tracking }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(tracking);
      setCopied(true);
      toast.success('Tracking copié !');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Échec de la copie');
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded hover:bg-muted transition-colors shrink-0"
      title="Copier le tracking"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-500" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
      )}
    </button>
  );
};

export default CopyTrackingButton;
