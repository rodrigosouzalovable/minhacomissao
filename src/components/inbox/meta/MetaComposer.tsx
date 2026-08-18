import { memo, useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
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
  initialText?: string;
  onInitialTextConsumed?: () => void;
}

export interface MetaComposerHandle {
  appendText: (t: string) => void;
  focus: () => void;
}

const MAX_HEIGHT = 96; // ~4 linhas

const MetaComposerImpl = forwardRef<MetaComposerHandle, Props>(function MetaComposerImpl(
  { disabled, enviando, placeholder, onSend, onPaste, onEscape, initialText, onInitialTextConsumed },
  ref,
) {
  const [texto, setTexto] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  const ajustarAltura = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const next = Math.min(ta.scrollHeight, MAX_HEIGHT);
    ta.style.height = `${next}px`;
    ta.style.overflowY = ta.scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden';
  }, []);

  useEffect(() => {
    ajustarAltura();
  }, [texto, ajustarAltura]);

  const submit = useCallback(() => {
    const t = texto.trim();
    if (!t) return;
    setTexto('');
    onSend(t);
    // Altura é resetada pelo useEffect ao limpar texto
  }, [texto, onSend]);

  const doAppend = useCallback((t: string) => {
    setTexto(prev => (prev ? `${prev} ${t}` : t));
    const focus = () => taRef.current?.focus();
    requestAnimationFrame(focus);
    setTimeout(focus, 50);
  }, []);

  useImperativeHandle(ref, () => ({
    appendText: doAppend,
    focus: () => taRef.current?.focus(),
  }), [doAppend]);

  // Fallback: apply text passed via prop when ref wasn't available at call site.
  useEffect(() => {
    if (initialText && initialText.trim()) {
      doAppend(initialText);
      onInitialTextConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialText]);

  return (
    <>
      <Textarea
        ref={taRef}
        value={texto}
        onChange={e => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
          else if (e.key === 'Escape') onEscape?.();
        }}
        onPaste={onPaste}
        placeholder={placeholder}
        disabled={disabled}
        className="min-h-[40px] max-h-[96px] resize-none py-2 leading-5"
        rows={1}
      />
      <Button onClick={submit} disabled={disabled || !texto.trim()} size="icon" className="shrink-0">
        {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </>
  );
});

export const MetaComposer = memo(MetaComposerImpl);

