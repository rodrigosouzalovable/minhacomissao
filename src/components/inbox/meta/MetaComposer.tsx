import { memo, useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle, useMemo } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Send, Zap } from 'lucide-react';
import type { MetaMsgRapida } from './MetaMensagensRapidasDialog';

interface Props {
  disabled: boolean;
  enviando: boolean;
  placeholder: string;
  onSend: (texto: string) => void;
  onPaste?: (e: React.ClipboardEvent) => void;
  onEscape?: () => void;
  initialText?: string;
  onInitialTextConsumed?: () => void;
  mensagensRapidas?: MetaMsgRapida[];
  conversationKey?: string;
}

export interface MetaComposerHandle {
  appendText: (t: string) => void;
  focus: () => void;
}

const LINHAS_AUTO = 4;

const MetaComposerImpl = forwardRef<MetaComposerHandle, Props>(function MetaComposerImpl(
  { disabled, enviando, placeholder, onSend, onPaste, onEscape, initialText, onInitialTextConsumed, mensagensRapidas = [], conversationKey },
  ref,
) {
  const [texto, setTexto] = useState('');
  const [atalhoSelecionado, setAtalhoSelecionado] = useState(0);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const termoAtalho = texto.startsWith('/') && !texto.includes('\n') ? texto.slice(1).trim().toLocaleLowerCase('pt-BR') : null;
  const atalhosFiltrados = useMemo(() => {
    if (termoAtalho === null) return [];
    return mensagensRapidas.filter((item) => {
      const busca = `${item.titulo} ${item.conteudo || ''}`.toLocaleLowerCase('pt-BR');
      return !termoAtalho || busca.includes(termoAtalho);
    });
  }, [mensagensRapidas, termoAtalho]);
  const listaAtalhosAberta = termoAtalho !== null && atalhosFiltrados.length > 0 && !disabled;
  // Altura máxima definida manualmente pelo usuário (arraste). null = automático (4 linhas)
  const tetoManualRef = useRef<number | null>(null);

  // Métricas reais do campo (linha, padding, borda) medidas em runtime
  const metricas = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return { linha: 20, extra: 18 };
    const cs = window.getComputedStyle(ta);
    const lhRaw = parseFloat(cs.lineHeight);
    const fs = parseFloat(cs.fontSize) || 14;
    const linha = Number.isFinite(lhRaw) && lhRaw > 0 ? lhRaw : fs * 1.4;
    const extra =
      (parseFloat(cs.paddingTop) || 0) +
      (parseFloat(cs.paddingBottom) || 0) +
      (parseFloat(cs.borderTopWidth) || 0) +
      (parseFloat(cs.borderBottomWidth) || 0);
    return { linha, extra };
  }, []);

  const alturaMin = useCallback(() => {
    const { linha, extra } = metricas();
    return Math.round(linha + extra);
  }, [metricas]);

  const tetoAtual = useCallback(() => {
    if (tetoManualRef.current != null) return tetoManualRef.current;
    const { linha, extra } = metricas();
    return Math.round(linha * LINHAS_AUTO + extra);
  }, [metricas]);

  const ajustarAltura = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    const min = alturaMin();
    const teto = Math.max(min, tetoAtual());
    const prev = ta.style.height;
    ta.style.height = '0px';
    const conteudo = ta.scrollHeight;
    ta.style.height = prev;
    const next = Math.min(Math.max(conteudo, min), teto);
    ta.style.height = `${next}px`;
    ta.style.overflowY = conteudo > teto ? 'auto' : 'hidden';
  }, [alturaMin, tetoAtual]);

  useEffect(() => {
    ajustarAltura();
  }, [texto, ajustarAltura]);

  useEffect(() => { setAtalhoSelecionado(0); }, [termoAtalho]);

  useEffect(() => { setTexto(''); }, [conversationKey]);

  // Reagir a mudanças de largura (abrir/fechar painéis) e carregamento de fontes
  useEffect(() => {
    const ta = taRef.current;
    if (!ta || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => ajustarAltura());
    ro.observe(ta);
    const raf = requestAnimationFrame(() => ajustarAltura());
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [ajustarAltura]);

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

  const escolherAtalho = useCallback((item: MetaMsgRapida) => {
    setTexto(item.conteudo || '');
    requestAnimationFrame(() => taRef.current?.focus());
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

  // --- Redimensionamento manual pela borda de cima ---
  const aplicarTeto = useCallback((altura: number) => {
    const min = alturaMin();
    const max = Math.round(window.innerHeight * 0.5);
    tetoManualRef.current = Math.min(Math.max(Math.round(altura), min), max);
    const ta = taRef.current;
    if (ta) {
      ta.style.height = `${tetoManualRef.current}px`;
      ta.style.overflowY = ta.scrollHeight > tetoManualRef.current ? 'auto' : 'hidden';
    }
  }, [alturaMin]);

  const onHandlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const ta = taRef.current;
    if (!ta) return;
    e.preventDefault();
    const startY = e.clientY;
    const startH = ta.getBoundingClientRect().height;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      aplicarTeto(startH + (startY - ev.clientY));
    };
    const onUp = (ev: PointerEvent) => {
      el.releasePointerCapture?.(ev.pointerId);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  }, [aplicarTeto]);

  const onHandleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const ta = taRef.current;
    if (!ta) return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const h = ta.getBoundingClientRect().height;
      aplicarTeto(e.key === 'ArrowUp' ? h + 20 : h - 20);
    }
  }, [aplicarTeto]);

  const resetarAltura = useCallback(() => {
    tetoManualRef.current = null;
    ajustarAltura();
  }, [ajustarAltura]);

  return (
    <>
      <div className="relative flex-1 min-w-0 flex flex-col">
        {listaAtalhosAberta && (
          <div
            role="listbox"
            aria-label="Respostas rápidas"
            className="absolute bottom-full left-0 right-0 z-30 mb-2 max-h-64 overflow-y-auto overscroll-contain rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          >
            {atalhosFiltrados.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={index === atalhoSelecionado}
                className={`flex w-full items-start gap-2 rounded-sm px-3 py-2 text-left ${index === atalhoSelecionado ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60'}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => escolherAtalho(item)}
              >
                <Zap className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">/{item.titulo}</span>
                  <span className="block truncate text-xs text-muted-foreground">{item.conteudo}</span>
                </span>
              </button>
            ))}
          </div>
        )}
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Arraste para redimensionar o campo de mensagem"
          tabIndex={0}
          onPointerDown={onHandlePointerDown}
          onKeyDown={onHandleKeyDown}
          onDoubleClick={resetarAltura}
          title="Arraste para redimensionar (duplo clique para automático)"
          className="group mx-auto mb-0.5 h-2 w-16 shrink-0 cursor-ns-resize touch-none flex items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="h-1 w-full rounded-full bg-border group-hover:bg-muted-foreground/60 transition-colors" />
        </div>
        <Textarea
          ref={taRef}
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (listaAtalhosAberta && e.key === 'ArrowDown') {
              e.preventDefault();
              setAtalhoSelecionado((atual) => Math.min(atual + 1, atalhosFiltrados.length - 1));
            } else if (listaAtalhosAberta && e.key === 'ArrowUp') {
              e.preventDefault();
              setAtalhoSelecionado((atual) => Math.max(atual - 1, 0));
            } else if (listaAtalhosAberta && (e.key === 'Enter' || e.key === 'Tab')) {
              e.preventDefault();
              const item = atalhosFiltrados[atalhoSelecionado];
              if (item) escolherAtalho(item);
            } else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
            else if (e.key === 'Escape' && listaAtalhosAberta) { e.preventDefault(); setTexto(''); }
            else if (e.key === 'Escape') onEscape?.();
          }}
          onPaste={onPaste}
          placeholder={placeholder}
          disabled={disabled}
          className="min-h-0 w-full resize-none py-2 leading-5 overflow-hidden"
          rows={1}
        />
      </div>
      <Button onClick={submit} disabled={disabled || !texto.trim()} size="icon" className="shrink-0">
        {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </>
  );
});

export const MetaComposer = memo(MetaComposerImpl);
