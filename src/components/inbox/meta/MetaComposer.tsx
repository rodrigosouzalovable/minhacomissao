import { memo, useState, useRef, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Send } from 'lucide-react';

interface Props {
  disabled: boolean;
  enviando: boolean;
  placeholder: string;
  onSend: (texto: string) => void;
  onPaste?: (e: React.ClipboardEvent) => void;
  onEscape?: () => void;
}

function MetaComposerImpl({ disabled, enviando, placeholder, onSend, onPaste, onEscape }: Props) {
  const [texto, setTexto] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  const submit = useCallback(() => {
    const t = texto.trim();
    if (!t) return;
    setTexto('');
    onSend(t);
  }, [texto, onSend]);

  return (
    <>
      <Textarea
        ref={ref}
        value={texto}
        onChange={e => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
          else if (e.key === 'Escape') onEscape?.();
        }}
        onPaste={onPaste}
        placeholder={placeholder}
        disabled={disabled}
        className="min-h-[44px] max-h-[120px] resize-none"
        rows={1}
      />
      <Button onClick={submit} disabled={disabled || !texto.trim()} size="icon" className="shrink-0">
        {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </>
  );
}

export const MetaComposer = memo(MetaComposerImpl);
